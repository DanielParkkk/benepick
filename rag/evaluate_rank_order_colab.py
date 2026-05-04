"""Evaluate BenePick retrieval/rerank ordering with labeled expected policies.

This script is intentionally Colab-friendly. It reports whether the expected
policy appears at rank 1/3/5 and how far down the ranked list it appears.

Example:
  python -u rag/evaluate_rank_order_colab.py \
    --labels rag/eval_labels_template_30.csv \
    --output-dir rag/rank_order_outputs \
    --modes search_only rerank_crag
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd


DEFAULT_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate BenePick Top-K rank ordering.")
    parser.add_argument("--labels", default="rag/eval_labels_template_30.csv")
    parser.add_argument("--output-dir", default="rag/rank_order_outputs")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--candidate-k", type=int, default=25)
    parser.add_argument("--alpha", type=float, default=0.5)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument(
        "--modes",
        nargs="+",
        default=["search_only", "rerank_crag"],
        choices=["search_only", "rerank_only", "rerank_crag"],
    )
    return parser.parse_args()


def parse_list(value: object) -> list[str]:
    if value is None:
        return []
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return []
    parts = re.split(r"[|,;/]+", text)
    return [p.strip() for p in parts if p.strip()]


def normalize_text(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def dedupe_by_policy(docs: Iterable[dict], top_k: int) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for doc in docs:
        key = str(doc.get("policy_id") or doc.get("policy_name") or "").strip()
        if not key:
            key = normalize_text(doc.get("evidence_text", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(doc)
        if len(out) >= top_k:
            break
    return out


def first_match_rank(
    docs: list[dict],
    expected_ids: list[str],
    expected_names: list[str],
) -> tuple[int | None, str, str]:
    expected_id_set = {str(x).strip() for x in expected_ids if str(x).strip()}
    expected_name_norm = [normalize_text(x) for x in expected_names if normalize_text(x)]

    for idx, doc in enumerate(docs, start=1):
        policy_id = str(doc.get("policy_id", "")).strip()
        policy_name = str(doc.get("policy_name", "")).strip()
        policy_name_norm = normalize_text(policy_name)

        if policy_id and policy_id in expected_id_set:
            return idx, "policy_id", policy_id

        for expected_name in expected_name_norm:
            if expected_name and (
                expected_name in policy_name_norm or policy_name_norm in expected_name
            ):
                return idx, "policy_name", policy_name

    return None, "", ""


def rank_score(rank: int | None, top_k: int) -> float:
    weights = DEFAULT_WEIGHTS[:top_k]
    if len(weights) < top_k:
        weights.extend([0.0] * (top_k - len(weights)))
    if rank is None or rank < 1 or rank > top_k:
        return 0.0
    return weights[rank - 1]


def run_mode(
    mode: str,
    row: pd.Series,
    searcher,
    top_k: int,
    candidate_k: int,
    alpha: float,
) -> tuple[list[dict], float]:
    from rag.pipeline import crag_quality_check, rerank

    question = str(row.get("question", "")).strip()
    region = str(row.get("region", "") or "").strip()

    started = time.perf_counter()
    raw_docs = searcher.search(
        query=question,
        top_k=max(candidate_k, top_k),
        alpha=alpha,
        user_region=region,
    )

    if mode == "search_only":
        docs = dedupe_by_policy(raw_docs, top_k)
    elif mode == "rerank_only":
        docs = dedupe_by_policy(rerank(question, raw_docs, top_k=top_k), top_k)
    else:
        reranked = rerank(question, raw_docs, top_k=top_k)
        docs = dedupe_by_policy(crag_quality_check(question, reranked), top_k)

    latency_ms = (time.perf_counter() - started) * 1000.0
    return docs, latency_ms


def summarize(details: list[dict], top_k: int) -> dict:
    n = len(details)
    if n == 0:
        return {}

    ranks = [d["first_hit_rank"] for d in details]
    hit1 = sum(1 for r in ranks if r == 1)
    hit3 = sum(1 for r in ranks if isinstance(r, int) and r <= 3)
    hit5 = sum(1 for r in ranks if isinstance(r, int) and r <= top_k)
    mrr = sum((1.0 / r) for r in ranks if isinstance(r, int) and r > 0) / n
    avg_rank_score = sum(float(d["rank_score"]) for d in details) / n
    avg_latency_ms = sum(float(d["latency_ms"]) for d in details) / n

    return {
        "num_questions": n,
        "hit_at_1": round(hit1 / n, 4),
        "hit_at_3": round(hit3 / n, 4),
        "hit_at_5": round(hit5 / n, 4),
        "mrr": round(mrr, 4),
        "avg_rank_score": round(avg_rank_score, 4),
        "avg_latency_ms": round(avg_latency_ms, 2),
    }


def classify_rank_issue(rank: int | str | None, top_k: int) -> str:
    if isinstance(rank, str) and not rank:
        return "miss_topk"
    if rank in (None, ""):
        return "miss_topk"
    try:
        rank_int = int(rank)
    except (TypeError, ValueError):
        return "miss_topk"
    if rank_int == 1:
        return "rank1_hit"
    if 1 < rank_int <= top_k:
        return "in_topk_not_rank1"
    return "miss_topk"


def main() -> None:
    args = parse_args()
    labels_path = Path(args.labels)
    if not labels_path.exists():
        raise FileNotFoundError(f"labels file not found: {labels_path}")

    # Keep Chroma optional in Colab bundles. The numpy dense fallback is enough
    # for this controlled rank-order experiment.
    os.environ.setdefault("BENEPICK_SKIP_CHROMA", "1")

    from rag.pipeline import get_searcher

    df = pd.read_csv(labels_path)
    df = df[df["expected_policy_ids"].fillna("").astype(str).str.strip().ne("")]
    if args.limit and args.limit > 0:
        df = df.head(args.limit).copy()

    searcher = get_searcher()
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    summaries: list[dict] = []
    all_details: list[dict] = []

    for mode in args.modes:
        print("=" * 72)
        print(f"Rank order evaluation mode: {mode}")
        print("=" * 72)
        details: list[dict] = []

        for row_index, row in df.iterrows():
            question = str(row.get("question", "")).strip()
            expected_ids = parse_list(row.get("expected_policy_ids", ""))
            expected_names = parse_list(row.get("expected_policy_names", ""))
            docs, latency_ms = run_mode(
                mode=mode,
                row=row,
                searcher=searcher,
                top_k=args.top_k,
                candidate_k=args.candidate_k,
                alpha=args.alpha,
            )
            rank, match_type, matched_value = first_match_rank(
                docs, expected_ids, expected_names
            )
            detail = {
                "mode": mode,
                "row_index": int(row_index),
                "question": question,
                "category": str(row.get("category", "")).strip(),
                "query_type": str(row.get("query_type", "")).strip(),
                "expected_policy_ids": "|".join(expected_ids),
                "expected_policy_names": "|".join(expected_names),
                "first_hit_rank": rank if rank is not None else "",
                "rank_issue": classify_rank_issue(rank, args.top_k),
                "rank_score": round(rank_score(rank, args.top_k), 4),
                "match_type": match_type,
                "matched_value": matched_value,
                "predicted_policy_ids_topk": "|".join(
                    str(d.get("policy_id", "")).strip() for d in docs
                ),
                "predicted_policy_names_topk": "|".join(
                    str(d.get("policy_name", "")).strip() for d in docs
                ),
                "latency_ms": round(latency_ms, 2),
            }
            details.append(detail)
            all_details.append(detail)

        summary = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "labels_path": str(labels_path),
            "mode": mode,
            "top_k": args.top_k,
            "candidate_k": args.candidate_k,
            "alpha": args.alpha,
            **summarize(details, args.top_k),
        }
        summaries.append(summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    detail_path = out_dir / f"rank_order_detail_{stamp}.csv"
    summary_path = out_dir / f"rank_order_summary_{stamp}.csv"
    xlsx_path = out_dir / f"rank_order_report_{stamp}.xlsx"

    pd.DataFrame(all_details).to_csv(detail_path, index=False, encoding="utf-8-sig")
    pd.DataFrame(summaries).to_csv(summary_path, index=False, encoding="utf-8-sig")
    detail_df = pd.DataFrame(all_details)
    category_summary = (
        detail_df.assign(
            hit_at_1=detail_df["first_hit_rank"].eq(1),
            hit_at_3=pd.to_numeric(detail_df["first_hit_rank"], errors="coerce").le(3),
            hit_at_5=pd.to_numeric(detail_df["first_hit_rank"], errors="coerce").le(args.top_k),
        )
        .groupby(["mode", "category"], dropna=False)
        .agg(
            num_questions=("question", "count"),
            hit_at_1=("hit_at_1", "mean"),
            hit_at_3=("hit_at_3", "mean"),
            hit_at_5=("hit_at_5", "mean"),
            avg_rank_score=("rank_score", "mean"),
            avg_latency_ms=("latency_ms", "mean"),
        )
        .reset_index()
    )
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        pd.DataFrame(summaries).to_excel(writer, sheet_name="summary", index=False)
        detail_df.to_excel(writer, sheet_name="detail", index=False)
        category_summary.to_excel(writer, sheet_name="category_summary", index=False)

    print("-" * 72)
    print(f"summary_csv: {summary_path}")
    print(f"detail_csv: {detail_path}")
    print(f"xlsx_report: {xlsx_path}")


if __name__ == "__main__":
    main()
