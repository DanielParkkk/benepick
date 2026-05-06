"""Compare BGE-M3 vs EmbeddingGemma on labeled rank-order metrics.

This is a thin orchestrator around evaluate_rank_order_colab_v2.py so the same
Hit@K/MRR scoring logic is used for both embedding models.

Example:
    python rag/compare_embedding_rank_order.py \
      --labels rag/eval_labels_template_100_filled.csv \
      --expected-min-labels 90
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare embedding models for rank-order evaluation.")
    parser.add_argument("--labels", default="rag/eval_labels_template_100_filled.csv")
    parser.add_argument("--output-dir", default="rag/rank_order_embedding_compare")
    parser.add_argument("--expected-min-labels", type=int, default=90)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--candidate-k", type=int, default=25)
    parser.add_argument("--alpha", type=float, default=0.5)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--embeddinggemma-model", default=os.getenv("EMBEDDINGGEMMA_MODEL", "google/embeddinggemma-300m"))
    return parser.parse_args()


def run_eval(args: argparse.Namespace, name: str, embed_model: str) -> Path:
    out_dir = Path(args.output_dir) / name
    out_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["BENEPICK_SKIP_CHROMA"] = "1"
    env["BENEPICK_EMBED_MODEL"] = embed_model
    if "embeddinggemma" in embed_model.lower() or "gemma" in embed_model.lower():
        env.setdefault("BENEPICK_EMBED_TRUST_REMOTE_CODE", "0")

    cmd = [
        sys.executable,
        "-u",
        "rag/evaluate_rank_order_colab_v2.py",
        "--labels",
        args.labels,
        "--output-dir",
        str(out_dir),
        "--top-k",
        str(args.top_k),
        "--candidate-k",
        str(args.candidate_k),
        "--alpha",
        str(args.alpha),
        "--expected-min-labels",
        str(args.expected_min_labels),
    ]
    if args.limit:
        cmd.extend(["--limit", str(args.limit)])

    print("Running:", " ".join(cmd))
    print("BENEPICK_EMBED_MODEL =", embed_model)
    subprocess.run(cmd, check=True, cwd=PROJECT_ROOT, env=env)

    summary_files = sorted(out_dir.glob("rank_order_summary_*.csv"))
    if not summary_files:
        raise FileNotFoundError(f"No summary CSV created in {out_dir}")
    return summary_files[-1]


def main() -> None:
    args = parse_args()
    outputs = [
        ("bge_m3", "BAAI/bge-m3"),
        ("embeddinggemma", args.embeddinggemma_model),
    ]

    rows = []
    for name, model in outputs:
        summary_path = run_eval(args, name, model)
        frame = pd.read_csv(summary_path)
        frame.insert(0, "embedding_model", model)
        frame.insert(0, "embedding_variant", name)
        frame.insert(0, "source_summary_path", str(summary_path))
        rows.append(frame)

    combined = pd.concat(rows, ignore_index=True)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    combined_csv = output_dir / "embedding_rank_order_compare_summary.csv"
    combined_xlsx = output_dir / "embedding_rank_order_compare_summary.xlsx"
    combined.to_csv(combined_csv, index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(combined_xlsx, engine="openpyxl") as writer:
        combined.to_excel(writer, index=False, sheet_name="summary")

    print("combined_csv:", combined_csv)
    print("combined_xlsx:", combined_xlsx)


if __name__ == "__main__":
    main()
