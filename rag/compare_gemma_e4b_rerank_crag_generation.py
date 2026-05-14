"""Evaluate Gemma 4 E4B generation with BenePick rerank + CRAG evidence.

This script is intended for Colab experiments where the evaluation should use
the same stronger retrieval path as the service:

Hybrid search -> rerank -> CRAG quality check -> Gemma answer -> OpenAI judge.

It is deliberately separate from compare_ollama_generation.py, whose evidence
mode uses raw search Top-K evidence.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from rag.compare_ollama_generation import (  # noqa: E402
    DEFAULT_INPUT,
    DEFAULT_JUDGE_MODEL,
    build_prompt,
    judge_with_openai,
    load_questions,
    ollama_chat,
    safe_metric,
    should_use_openai_judge,
    summarize,
)


DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "rag" / "gemma_e4b_rerank_crag_generation"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate Gemma 4 E4B with rerank + CRAG evidence.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--model", default="gemma4:e4b")
    parser.add_argument("--provider", default="gemma")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--candidate-k", type=int, default=25)
    parser.add_argument("--evidence-k", type=int, default=3)
    parser.add_argument("--alpha", type=float, default=0.5)
    parser.add_argument("--ollama-url", default=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    parser.add_argument("--judge", default="auto", choices=["auto", "openai", "none"])
    parser.add_argument("--judge-model", default=DEFAULT_JUDGE_MODEL)
    parser.add_argument("--prompt-variant", default="B", choices=["A", "B"])
    parser.add_argument("--timeout", type=int, default=240)
    parser.add_argument("--num-predict", type=int, default=220)
    parser.add_argument("--num-ctx", type=int, default=4096)
    return parser.parse_args()


def dedupe_by_policy(docs: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[str] = set()
    for doc in docs:
        key = str(doc.get("policy_id") or doc.get("policy_name") or doc.get("evidence_text") or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(doc)
        if len(output) >= top_k:
            break
    return output


def get_pipeline_components():
    print("[setup] importing BenePick pipeline components", flush=True)
    from rag.pipeline import crag_quality_check, get_searcher, rerank

    print("[setup] initializing BenePick searcher", flush=True)
    searcher = get_searcher()
    print("[setup] BenePick searcher ready", flush=True)
    return searcher, rerank, crag_quality_check


def retrieve_rerank_crag_docs(
    searcher: Any,
    rerank_fn: Any,
    crag_fn: Any,
    question: str,
    top_k: int,
    candidate_k: int,
    alpha: float,
) -> tuple[list[dict[str, Any]], dict[str, float]]:
    timings: dict[str, float] = {}

    started = time.perf_counter()
    raw_docs = searcher.search(question, top_k=max(candidate_k, top_k), alpha=alpha)
    timings["search_time_ms"] = round((time.perf_counter() - started) * 1000.0, 2)

    started = time.perf_counter()
    reranked = rerank_fn(question, raw_docs, top_k=top_k)
    timings["rerank_time_ms"] = round((time.perf_counter() - started) * 1000.0, 2)

    started = time.perf_counter()
    final_docs = crag_fn(question, reranked)
    timings["crag_time_ms"] = round((time.perf_counter() - started) * 1000.0, 2)

    timings["retrieval_time_ms"] = round(
        timings["search_time_ms"] + timings["rerank_time_ms"] + timings["crag_time_ms"],
        2,
    )
    return dedupe_by_policy(final_docs, top_k), timings


def write_outputs(detail: pd.DataFrame, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    summary = summarize(detail)
    detail_path = output_dir / f"gemma_e4b_rerank_crag_detail_{stamp}.csv"
    summary_path = output_dir / f"gemma_e4b_rerank_crag_summary_{stamp}.csv"
    report_path = output_dir / f"gemma_e4b_rerank_crag_report_{stamp}.xlsx"

    detail.to_csv(detail_path, index=False, encoding="utf-8-sig")
    summary.to_csv(summary_path, index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(report_path, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="summary", index=False)
        detail.to_excel(writer, sheet_name="detail", index=False)
    return {"detail": detail_path, "summary": summary_path, "report": report_path}


def main() -> None:
    args = parse_args()
    print(
        f"[setup] gemma_e4b_rerank_crag_generation started input={args.input} "
        f"output_dir={args.output_dir} model={args.model} judge={args.judge} limit={args.limit}",
        flush=True,
    )

    os.environ.setdefault("BENEPICK_SKIP_CHROMA", "1")
    os.environ.setdefault("BENEPICK_ENABLE_RERANKER", "1")

    questions = load_questions(args.input, args.limit)
    use_judge = should_use_openai_judge(args.judge)
    searcher, rerank_fn, crag_fn = get_pipeline_components()

    rows: list[dict[str, Any]] = []
    total_runs = len(questions)
    for run_index, (question_index, row) in enumerate(questions.iterrows(), start=1):
        question = str(row.get("question", "")).strip()
        category = str(row.get("category", "")).strip()
        print(
            f"[{run_index}/{total_runs}] retrieval start row={question_index} question={question[:60]}",
            flush=True,
        )
        docs, retrieval_timings = retrieve_rerank_crag_docs(
            searcher,
            rerank_fn,
            crag_fn,
            question,
            args.top_k,
            args.candidate_k,
            args.alpha,
        )

        prompt = build_prompt(question, docs, "evidence", args.prompt_variant, args.evidence_k)
        answer = ""
        error = ""
        judge_result: dict[str, Any] = {}
        started = time.perf_counter()
        try:
            print(f"[{run_index}/{total_runs}] generation start model={args.model}", flush=True)
            answer = ollama_chat(args.ollama_url, args.model, prompt, args.timeout, args.num_predict, args.num_ctx)
            if use_judge:
                judge_result = judge_with_openai(question, answer, docs, args.judge_model)
        except Exception as exc:
            error = str(exc)

        answer_time_ms = round((time.perf_counter() - started) * 1000.0, 2)
        print(
            f"[{run_index}/{total_runs}] done answer_chars={len(answer)} "
            f"answer_time_ms={answer_time_ms} error={bool(error)}",
            flush=True,
        )

        if error:
            judge_result = {
                "groundedness": 1,
                "relevance": 1,
                "coverage": 1,
                "actionability": 1,
                "hallucination_risk": 5,
                "overall": 1,
                "verdict": "FAIL",
                "rationale": f"run error: {error}",
            }
        elif not use_judge:
            judge_result = {
                "groundedness": 0,
                "relevance": 0,
                "coverage": 0,
                "actionability": 0,
                "hallucination_risk": 0,
                "overall": 0,
                "verdict": "UNJUDGED",
                "rationale": "Judge disabled; rerun with OPENAI_API_KEY for scored output.",
            }

        rows.append(
            {
                "provider": args.provider,
                "model": args.model,
                "mode": "evidence",
                "retrieval_mode": "rerank_crag",
                "question": question,
                "category": category,
                "answer": answer,
                "evidence_policy_names": " | ".join(str(doc.get("policy_name", "")) for doc in docs[: args.evidence_k]),
                "evidence_policy_ids": " | ".join(str(doc.get("policy_id", "")) for doc in docs[: args.evidence_k]),
                "latency_ms": answer_time_ms,
                **retrieval_timings,
                "total_time_ms": round(retrieval_timings["retrieval_time_ms"] + answer_time_ms, 2),
                "groundedness": safe_metric(judge_result.get("groundedness"), 0),
                "relevance": safe_metric(judge_result.get("relevance"), 0),
                "coverage": safe_metric(judge_result.get("coverage"), 0),
                "actionability": safe_metric(judge_result.get("actionability"), 0),
                "hallucination_risk": safe_metric(judge_result.get("hallucination_risk"), 0),
                "overall": safe_metric(judge_result.get("overall"), 0),
                "verdict": str(judge_result.get("verdict", "")),
                "rationale": str(judge_result.get("rationale", "")),
            }
        )

    paths = write_outputs(pd.DataFrame(rows), Path(args.output_dir))
    for key, path in paths.items():
        print(f"{key}_path: {path}")


if __name__ == "__main__":
    main()
