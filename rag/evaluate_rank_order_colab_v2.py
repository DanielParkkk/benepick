"""Colab-safe rank-order evaluation for BenePick recommendations.

This evaluator checks whether manually labeled expected policies appear in the
actual ranked recommendation list. It avoids importing the answer-generation
pipeline so Colab does not need the LLM/reranker stack just to score ordering.

Metrics:
- Hit@1: expected policy is ranked first.
- Hit@3: expected policy is within the top 3.
- Hit@5: expected policy is within the top 5.
- MRR: rewards earlier matching ranks.
- Rank Score: 1st=1.0, 2nd=0.8, 3rd=0.6, 4th=0.4, 5th=0.2, miss=0.
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


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DEFAULT_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate BenePick ranked policy ordering.")
    parser.add_argument("--labels", default="rag/eval_labels_template_100.csv")
    parser.add_argument("--output-dir", default="rag/rank_order_outputs_100")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--candidate-k", type=int, default=25)
    parser.add_argument("--alpha", type=float, default=0.5)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--expected-min-labels", type=int, default=30)
    parser.add_argument(
        "--modes",
        nargs="+",
        default=["search_only"],
        choices=["search_only"],
        help="search_only matches the current non-reranker production ordering.",
    )
    return parser.parse_args()


def parse_list(value: object) -> list[str]:
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return []
    return [part.strip() for part in re.split(r"[|,;/]+", text) if part.strip()]


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def has_label(row: pd.Series) -> bool:
    return bool(parse_list(row.get("expected_policy_ids")) or parse_list(row.get("expected_policy_names")))


def dedupe_by_policy(docs: Iterable[dict], top_k: int) -> list[dict]:
    output: list[dict] = []
    seen: set[str] = set()

    for doc in docs:
        key = str(doc.get("policy_id") or doc.get("policy_name") or "").strip()
        if not key:
            key = normalize_text(doc.get("evidence_text", ""))
        if key in seen:
            continue
        seen.add(key)
        output.append(doc)
        if len(output) >= top_k:
            break

    return output


def first_match_rank(
    docs: list[dict],
    expected_ids: list[str],
    expected_names: list[str],
) -> tuple[int | None, str, str]:
    expected_id_set = {str(item).strip() for item in expected_ids if str(item).strip()}
    expected_name_norm = [normalize_text(item) for item in expected_names if normalize_text(item)]

    for rank, doc in enumerate(docs, start=1):
        policy_id = str(doc.get("policy_id", "")).strip()
        policy_name = str(doc.get("policy_name", "")).strip()
        policy_name_norm = normalize_text(policy_name)

        if policy_id and policy_id in expected_id_set:
            return rank, "policy_id", policy_id

        for expected_name in expected_name_norm:
            if expected_name and (
                expected_name in policy_name_norm or policy_name_norm in expected_name
            ):
                return rank, "policy_name", policy_name

    return None, "", ""


def rank_score(rank: int | None, top_k: int) -> float:
    weights = DEFAULT_WEIGHTS[:top_k]
    if len(weights) < top_k:
        weights.extend([0.0] * (top_k - len(weights)))
    if rank is None or rank < 1 or rank > top_k:
        return 0.0
    return weights[rank - 1]


def classify_rank_issue(rank: int | None, top_k: int) -> str:
    if rank is None:
        return "miss_topk"
    if rank == 1:
        return "rank1_hit"
    if 1 < rank <= top_k:
        return "in_topk_not_rank1"
    return "miss_topk"


def summarize(details: list[dict], top_k: int) -> dict:
    n = len(details)
    if n == 0:
        return {
            "num_questions": 0,
            "hit_at_1": 0.0,
            "hit_at_3": 0.0,
            "hit_at_5": 0.0,
            "mrr": 0.0,
            "avg_rank_score": 0.0,
            "avg_latency_ms": 0.0,
        }

    ranks = [item["first_hit_rank"] for item in details]
    hit1 = sum(1 for rank in ranks if rank == 1)
    hit3 = sum(1 for rank in ranks if isinstance(rank, int) and rank <= 3)
    hit5 = sum(1 for rank in ranks if isinstance(rank, int) and rank <= top_k)
    mrr = sum((1.0 / rank) for rank in ranks if isinstance(rank, int) and rank > 0) / n

    return {
        "num_questions": n,
        "hit_at_1": round(hit1 / n, 4),
        "hit_at_3": round(hit3 / n, 4),
        "hit_at_5": round(hit5 / n, 4),
        "mrr": round(mrr, 4),
        "avg_rank_score": round(sum(float(item["rank_score"]) for item in details) / n, 4),
        "avg_latency_ms": round(sum(float(item["latency_ms"]) for item in details) / n, 2),
    }


def run_search_only(row: pd.Series, searcher, top_k: int, candidate_k: int, alpha: float) -> tuple[list[dict], float]:
    question = str(row.get("question", "")).strip()
    region = str(row.get("region", "") or "").strip()

    started = time.perf_counter()
    raw_docs = searcher.search(
        query=question,
        top_k=max(candidate_k, top_k),
        alpha=alpha,
        user_region=region,
    )
    docs = dedupe_by_policy(raw_docs, top_k)
    latency_ms = (time.perf_counter() - started) * 1000.0
    return docs, latency_ms


def build_category_summary(detail_df: pd.DataFrame, top_k: int) -> pd.DataFrame:
    if detail_df.empty:
        return pd.DataFrame()

    numeric_rank = pd.to_numeric(detail_df["first_hit_rank"], errors="coerce")
    return (
        detail_df.assign(
            hit_at_1=numeric_rank.eq(1),
            hit_at_3=numeric_rank.le(3),
            hit_at_5=numeric_rank.le(top_k),
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


def main() -> None:
    args = parse_args()
    labels_path = Path(args.labels)
    if not labels_path.exists():
        raise FileNotFoundError(f"labels file not found: {labels_path}")

    os.environ.setdefault("BENEPICK_SKIP_CHROMA", "1")

    df_all = pd.read_csv(labels_path)
    labeled_mask = df_all.apply(has_label, axis=1)
    label_coverage = {
        "total_rows": int(len(df_all)),
        "labeled_rows": int(labeled_mask.sum()),
        "unlabeled_rows": int((~labeled_mask).sum()),
        "coverage_rate": round(float(labeled_mask.mean()), 4) if len(df_all) else 0.0,
    }
    print("Label coverage:")
    print(json.dumps(label_coverage, ensure_ascii=False, indent=2))

    df = df_all[labeled_mask].copy()
    if args.limit and args.limit > 0:
        df = df.head(args.limit).copy()

    if len(df) < args.expected_min_labels:
        print(
            "[WARN] Labeled rows are fewer than expected. "
            f"Current={len(df)}, expected_min={args.expected_min_labels}. "
            "Scores are useful for smoke testing but not final reporting."
        )

    from rag.searcher import HybridSearcher

    searcher = HybridSearcher()
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    summaries: list[dict] = []
    details_all: list[dict] = []

    for mode in args.modes:
        print("=" * 72)
        print(f"Rank order evaluation mode: {mode}")
        print("=" * 72)
        mode_details: list[dict] = []

        for row_index, row in df.iterrows():
            expected_ids = parse_list(row.get("expected_policy_ids"))
            expected_names = parse_list(row.get("expected_policy_names"))
            docs, latency_ms = run_search_only(row, searcher, args.top_k, args.candidate_k, args.alpha)
            rank, match_type, matched_value = first_match_rank(docs, expected_ids, expected_names)

            detail = {
                "mode": mode,
                "row_index": int(row_index),
                "question": str(row.get("question", "")).strip(),
                "category": str(row.get("category", "")).strip(),
                "query_type": str(row.get("query_type", "")).strip(),
                "expected_policy_ids": "|".join(expected_ids),
                "expected_policy_names": "|".join(expected_names),
                "first_hit_rank": rank if rank is not None else "",
                "rank_issue": classify_rank_issue(rank, args.top_k),
                "rank_score": round(rank_score(rank, args.top_k), 4),
                "match_type": match_type,
                "matched_value": matched_value,
                "predicted_policy_ids_topk": "|".join(str(doc.get("policy_id", "")).strip() for doc in docs),
                "predicted_policy_names_topk": "|".join(str(doc.get("policy_name", "")).strip() for doc in docs),
                "top1_policy_name": str(docs[0].get("policy_name", "") if len(docs) > 0 else ""),
                "top2_policy_name": str(docs[1].get("policy_name", "") if len(docs) > 1 else ""),
                "top3_policy_name": str(docs[2].get("policy_name", "") if len(docs) > 2 else ""),
                "latency_ms": round(latency_ms, 2),
            }
            mode_details.append(detail)
            details_all.append(detail)

        summary = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "labels_path": str(labels_path),
            "mode": mode,
            "top_k": args.top_k,
            "candidate_k": args.candidate_k,
            "alpha": args.alpha,
            **label_coverage,
            **summarize(mode_details, args.top_k),
        }
        summaries.append(summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    detail_df = pd.DataFrame(details_all)
    summary_df = pd.DataFrame(summaries)
    category_df = build_category_summary(detail_df, args.top_k)
    issue_df = (
        detail_df.groupby(["mode", "rank_issue"], dropna=False)
        .size()
        .reset_index(name="count")
        if not detail_df.empty
        else pd.DataFrame()
    )

    summary_path = out_dir / f"rank_order_summary_{stamp}.csv"
    detail_path = out_dir / f"rank_order_detail_{stamp}.csv"
    xlsx_path = out_dir / f"rank_order_report_{stamp}.xlsx"

    summary_df.to_csv(summary_path, index=False, encoding="utf-8-sig")
    detail_df.to_csv(detail_path, index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        summary_df.to_excel(writer, sheet_name="summary", index=False)
        detail_df.to_excel(writer, sheet_name="detail", index=False)
        category_df.to_excel(writer, sheet_name="category_summary", index=False)
        issue_df.to_excel(writer, sheet_name="issue_summary", index=False)

    print("-" * 72)
    print(f"summary_csv: {summary_path}")
    print(f"detail_csv: {detail_path}")
    print(f"xlsx_report: {xlsx_path}")


if __name__ == "__main__":
    main()
