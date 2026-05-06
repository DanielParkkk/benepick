"""Compare local Ollama generation models for BenePick RAG experiments.

This script is intentionally Colab-friendly. It can compare Qwen and Gemma
through the local Ollama API, optionally using BenePick retrieval evidence and
an OpenAI judge for the same metrics used in earlier RAG experiments.
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
from typing import Any

import pandas as pd
import requests


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DEFAULT_INPUT = PROJECT_ROOT / "rag" / "eval_questions_100.csv"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "rag" / "ollama_generation_compare"
DEFAULT_JUDGE_MODEL = os.getenv("OPENAI_JUDGE_MODEL", "gpt-4o-mini")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare Qwen/Gemma generation through Ollama.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--models", nargs="+", default=["qwen=qwen3.5:4b", "gemma=gemma4:e2b"])
    parser.add_argument("--modes", nargs="+", default=["direct", "evidence"], choices=["direct", "evidence"])
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--evidence-k", type=int, default=3)
    parser.add_argument("--alpha", type=float, default=0.5)
    parser.add_argument("--ollama-url", default=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    parser.add_argument("--judge", default="auto", choices=["auto", "openai", "none"])
    parser.add_argument("--judge-model", default=DEFAULT_JUDGE_MODEL)
    parser.add_argument("--prompt-variant", default="B", choices=["A", "B"])
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--num-predict", type=int, default=450)
    parser.add_argument("--num-ctx", type=int, default=4096)
    return parser.parse_args()


def parse_model_specs(values: list[str]) -> list[tuple[str, str]]:
    specs: list[tuple[str, str]] = []
    for value in values:
        if "=" in value:
            label, model = value.split("=", 1)
        else:
            label, model = value, value
        label = label.strip()
        model = model.strip()
        if not label or not model:
            raise ValueError(f"Invalid model spec: {value!r}")
        specs.append((label, model))
    return specs


def load_questions(path: str | Path, limit: int = 0) -> pd.DataFrame:
    frame = pd.read_csv(path).fillna("")
    if "question" not in frame.columns:
        raise ValueError("input csv must contain a question column")
    if "category" not in frame.columns:
        frame["category"] = ""
    if limit and limit > 0:
        frame = frame.head(limit)
    return frame


def build_evidence_context(docs: list[dict[str, Any]], evidence_k: int = 3) -> str:
    blocks: list[str] = []
    for idx, doc in enumerate(docs[:evidence_k], start=1):
        blocks.append(
            "\n".join(
                [
                    f"[{idx}] Policy: {str(doc.get('policy_name', '')).strip()}",
                    f"Evidence: {str(doc.get('evidence_text', '')).strip()}",
                    f"Source: {str(doc.get('source_url', '')).strip()}",
                ]
            )
        )
    return "\n\n".join(blocks)


def build_system_prompt(prompt_variant: str) -> str:
    if prompt_variant.upper() == "A":
        return (
            "You are BenePick, a Korean welfare policy assistant. Answer only from the provided "
            "evidence. If an amount, period, eligibility condition, or application method is not "
            "in the evidence, mark it as needing confirmation. Include sources."
        )
    return (
        "You are BenePick, a Korean welfare policy assistant.\n"
        "Use only the provided evidence. Do not invent amounts, dates, eligibility rules, or application paths.\n"
        "If something is uncertain, separate it under '확인 필요'.\n"
        "Write the answer in Korean with this structure:\n"
        "1. 핵심 답변\n"
        "2. 근거 정책\n"
        "3. 신청/확인 방법\n"
        "4. 확인 필요\n"
        "5. 출처\n"
        "Make the answer actionable: tell the user what to check next and where to apply."
    )


def build_prompt(question: str, docs: list[dict[str, Any]], mode: str, prompt_variant: str, evidence_k: int) -> str:
    if mode == "direct":
        return (
            "You are a Korean welfare policy assistant. Answer in Korean.\n"
            "If you are not sure, say '확인 필요' instead of guessing.\n\n"
            f"Question: {question}"
        )
    return (
        f"{build_system_prompt(prompt_variant)}\n\n"
        f"Question: {question}\n\n"
        f"Evidence documents:\n{build_evidence_context(docs, evidence_k)}\n\n"
        "Answer:"
    )


def ollama_chat(base_url: str, model: str, prompt: str, timeout: int, num_predict: int, num_ctx: int) -> str:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": num_predict,
            "num_ctx": num_ctx,
        },
    }
    response = requests.post(f"{base_url.rstrip('/')}/api/chat", json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    return str(data.get("message", {}).get("content", "")).strip()


def get_searcher():
    from rag.searcher import HybridSearcher

    return HybridSearcher()


def retrieve_docs(searcher: Any, question: str, top_k: int, alpha: float) -> list[dict[str, Any]]:
    if searcher is None:
        return []
    return searcher.search(question, top_k=top_k, alpha=alpha)


def extract_json(text: str) -> dict[str, Any]:
    raw = str(text or "").strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"JSON object not found in judge response: {raw[:300]}")
    return json.loads(match.group(0))


def should_use_openai_judge(judge_mode: str) -> bool:
    if judge_mode == "none":
        return False
    has_key = bool(os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY"))
    if judge_mode == "openai" and not has_key:
        raise RuntimeError("OPENAI_API_KEY or GPT_API_KEY is required when --judge openai")
    return has_key


def judge_with_openai(question: str, answer: str, docs: list[dict[str, Any]], model: str) -> dict[str, Any]:
    from openai import OpenAI

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY"), timeout=90, max_retries=0)
    evidence = build_evidence_context(docs, evidence_k=3)
    prompt = f"""
Evaluate the welfare-policy answer below.

Question:
{question}

Evidence:
{evidence}

Answer:
{answer}

Return only JSON with:
groundedness, relevance, coverage, actionability, hallucination_risk, overall, verdict, rationale.

Scoring:
- groundedness: 1-5, higher means better supported by evidence.
- relevance: 1-5, higher means more directly answers the question.
- coverage: 1-5, higher means covers eligibility, benefit, application/check path.
- actionability: 1-5, higher means user can take next steps.
- hallucination_risk: 1-5, lower is better. 1 means low risk, 5 means high risk.
- overall: 1-5.
- verdict: PASS if overall >= 4 and hallucination_risk <= 2, else FAIL.
""".strip()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a strict RAG evaluation judge. Return JSON only."},
            {"role": "user", "content": prompt},
        ],
    )
    return extract_json(response.choices[0].message.content or "")


def safe_metric(value: Any, default: float = 1.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def summarize(detail: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for (label, mode), group in detail.groupby(["provider", "mode"], dropna=False):
        rows.append(
            {
                "provider": label,
                "model": group["model"].iloc[0],
                "mode": mode,
                "num_questions": len(group),
                "avg_groundedness": round(group["groundedness"].astype(float).mean(), 4),
                "avg_relevance": round(group["relevance"].astype(float).mean(), 4),
                "avg_coverage": round(group["coverage"].astype(float).mean(), 4),
                "avg_actionability": round(group["actionability"].astype(float).mean(), 4),
                "avg_hallucination_risk": round(group["hallucination_risk"].astype(float).mean(), 4),
                "avg_overall": round(group["overall"].astype(float).mean(), 4),
                "pass_rate": round((group["verdict"] == "PASS").mean(), 4),
                "avg_latency_ms": round(group["latency_ms"].astype(float).mean(), 2),
            }
        )
    return pd.DataFrame(rows).sort_values(["mode", "avg_overall"], ascending=[True, False])


def write_outputs(detail: pd.DataFrame, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    summary = summarize(detail)
    detail_path = output_dir / f"ollama_generation_compare_detail_{stamp}.csv"
    summary_path = output_dir / f"ollama_generation_compare_summary_{stamp}.csv"
    report_path = output_dir / f"ollama_generation_compare_report_{stamp}.xlsx"

    detail.to_csv(detail_path, index=False, encoding="utf-8-sig")
    summary.to_csv(summary_path, index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(report_path, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="summary", index=False)
        detail.to_excel(writer, sheet_name="detail", index=False)
    return {"detail": detail_path, "summary": summary_path, "report": report_path}


def main() -> None:
    args = parse_args()
    questions = load_questions(args.input, args.limit)
    model_specs = parse_model_specs(args.models)
    use_judge = should_use_openai_judge(args.judge)
    need_retrieval = "evidence" in args.modes

    searcher = None
    if need_retrieval:
        os.environ.setdefault("BENEPICK_SKIP_CHROMA", "1")
        searcher = get_searcher()

    rows: list[dict[str, Any]] = []
    total_runs = len(questions) * len(model_specs) * len(args.modes)
    run_index = 0
    for question_index, row in questions.iterrows():
        question = str(row.get("question", "")).strip()
        category = str(row.get("category", "")).strip()
        docs = retrieve_docs(searcher, question, args.top_k, args.alpha) if need_retrieval else []
        for label, model in model_specs:
            for mode in args.modes:
                run_index += 1
                mode_docs = docs if mode == "evidence" else []
                prompt = build_prompt(question, mode_docs, mode, args.prompt_variant, args.evidence_k)
                start = time.perf_counter()
                error = ""
                answer = ""
                judge_result: dict[str, Any] = {}
                try:
                    print(
                        f"[{run_index}/{total_runs}] start provider={label} model={model} "
                        f"mode={mode} row={question_index} question={question[:60]}",
                        flush=True,
                    )
                    answer = ollama_chat(
                        args.ollama_url,
                        model,
                        prompt,
                        args.timeout,
                        args.num_predict,
                        args.num_ctx,
                    )
                    if use_judge:
                        judge_result = judge_with_openai(question, answer, mode_docs, args.judge_model)
                except Exception as exc:
                    error = str(exc)
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                print(
                    f"[{run_index}/{total_runs}] done provider={label} mode={mode} "
                    f"latency_ms={latency_ms} error={bool(error)}",
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
                        "rationale": "Judge disabled; inspect answers manually or rerun with OPENAI_API_KEY.",
                    }

                rows.append(
                    {
                        "provider": label,
                        "model": model,
                        "mode": mode,
                        "question": question,
                        "category": category,
                        "answer": answer,
                        "evidence_policy_names": " | ".join(str(doc.get("policy_name", "")) for doc in mode_docs[: args.evidence_k]),
                        "evidence_policy_ids": " | ".join(str(doc.get("policy_id", "")) for doc in mode_docs[: args.evidence_k]),
                        "latency_ms": latency_ms,
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
