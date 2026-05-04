
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from anthropic import Anthropic
from openai import OpenAI

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DEFAULT_INPUT = PROJECT_ROOT / "rag" / "eval_questions_100.csv"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "rag" / "llm_compare_outputs"

OPENAI_COMPARE_MODEL = os.getenv("OPENAI_COMPARE_MODEL", os.getenv("OPENAI_MODEL", "gpt-5.2-chat-latest"))
ANTHROPIC_COMPARE_MODEL = os.getenv("ANTHROPIC_COMPARE_MODEL", "claude-sonnet-4-20250514")
GEMINI_COMPARE_MODEL = os.getenv("GEMINI_COMPARE_MODEL", "gemini-3-pro-preview")


def _env_any(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _load_questions(input_path: str | Path) -> pd.DataFrame:
    frame = pd.read_csv(input_path).fillna("")
    required = {"question", "category"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"input csv missing columns: {sorted(missing)}")
    return frame


def _build_evidence_context(docs: list[dict[str, Any]], limit: int = 3) -> str:
    lines = []
    for i, doc in enumerate(docs[:limit], start=1):
        lines.append(
            "\n".join(
                [
                    f"[{i}] 정책명: {str(doc.get('policy_name', '')).strip()}",
                    f"근거: {str(doc.get('evidence_text', '')).strip()}",
                    f"출처: {str(doc.get('source_url', '')).strip()}",
                ]
            )
        )
    return "\n\n".join(lines)


def _build_answer_system_prompt(prompt_variant: str = "B") -> str:
    if str(prompt_variant or "B").upper() == "B":
        return """당신은 복지 정책 추천 답변 AI입니다.
반드시 제공된 근거 문서 안에서만 답변하세요.

답변은 아래 구조를 유지하세요.
핵심 답변:
- 사용자가 받을 수 있는 가능성 요약

근거 정책:
- 정책명
- 사용자의 조건과 연결되는 근거

신청/확인 방법:
- 신청 가능한 곳
- 신청/확인 전에 볼 항목
- 다음에 해야 할 행동

확인 필요:
- 문서에 명확하지 않은 정보
- 금액/기간/세부조건 중 근거가 부족한 정보

출처:
- 정책명: URL

규칙:
- 근거 문서에 없는 내용은 추측하지 마세요.
- 문서에 없는 금액, 대상, 기간, 조건은 만들지 마세요.
- 확실하지 않은 내용은 '확인 필요'로 분리하세요.
- 공식 출처를 반드시 포함하세요.
- 사용자가 바로 행동할 수 있도록 신청/확인 방법을 2개 이상 제시하세요."""
    return """당신은 복지 정책 추천 답변 AI입니다.
제공된 근거 문서만 사용해서 핵심 답변, 근거 정책, 신청/확인 방법, 확인 필요, 출처를 간결하게 작성하세요."""


def _build_direct_prompt(question: str) -> str:
    return (
        "당신은 한국 복지 정책을 설명하는 AI입니다.\n"
        "사용자 질문에 답하세요.\n"
        "근거가 불확실하면 확인 필요라고 말하세요.\n\n"
        f"질문: {question}"
    )


def _build_evidence_prompt(question: str, docs: list[dict[str, Any]], prompt_variant: str) -> tuple[str, str]:
    system_prompt = _build_answer_system_prompt(prompt_variant)
    human_prompt = f"질문: {question}\n\n근거 문서:\n{_build_evidence_context(docs)}\n\n답변:"
    return system_prompt, human_prompt


def _extract_json(text: object) -> dict[str, Any]:
    raw = str(text or "").strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"JSON object not found: {raw[:200]}")
    return json.loads(match.group(0))


def _judge_answer(question: str, answer: str, docs: list[dict[str, Any]]) -> dict[str, Any]:
    # Lazy import avoids initializing the RAG pipeline for direct-only runs.
    from rag.pipeline import llm as judge_llm

    evidence = _build_evidence_context(docs)
    messages = [
        {
            "role": "system",
            "content": """당신은 복지 RAG 답변 품질을 평가하는 심사자입니다.
질문, 근거 문서, 답변을 보고 평가하세요.

평가 기준:
- groundedness: 답변이 근거 문서에 실제로 있는 내용만 말했는가
- relevance: 사용자 질문에 직접 답했는가
- coverage: 지원 대상, 지원 내용, 신청 방법 등 핵심 정보를 충분히 포함했는가
- actionability: 사용자가 다음 행동을 할 수 있게 안내했는가
- hallucination_risk: 문서에 없는 금액/대상/조건을 지어냈는가
- overall: 종합 점수

반드시 아래 JSON만 반환하세요.
{
  "groundedness": 1-5 숫자,
  "relevance": 1-5 숫자,
  "coverage": 1-5 숫자,
  "actionability": 1-5 숫자,
  "hallucination_risk": 1-5 숫자,
  "overall": 1-5 숫자,
  "verdict": "PASS" 또는 "FAIL",
  "rationale": "짧은 한국어 설명"
}

주의:
- hallucination_risk는 낮을수록 좋습니다.
- 문서 밖 내용을 만들면 groundedness를 낮추고 hallucination_risk를 높이세요.
- 답변이 너무 짧아 행동에 도움이 안 되면 coverage와 actionability를 낮추세요.""",
        },
        {
            "role": "user",
            "content": (
                f"질문:\n{question}\n\n"
                f"근거 문서:\n{evidence}\n\n"
                f"모델 답변:\n{answer}\n\n"
                "평가 JSON:"
            ),
        },
    ]
    response = judge_llm.invoke(messages)
    return _extract_json(getattr(response, "content", response))


def _invoke_openai_direct(question: str) -> str:
    client = OpenAI(api_key=_env_any("OPENAI_API_KEY", "GPT_API_KEY"), timeout=90, max_retries=0)
    response = client.chat.completions.create(
        model=OPENAI_COMPARE_MODEL,
        max_completion_tokens=700,
        messages=[
            {"role": "system", "content": "당신은 한국 복지 정책을 설명하는 AI입니다. 정확하고 간결하게 답하세요."},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content or ""


def _invoke_openai_evidence(question: str, docs: list[dict[str, Any]], prompt_variant: str) -> str:
    client = OpenAI(api_key=_env_any("OPENAI_API_KEY", "GPT_API_KEY"), timeout=90, max_retries=0)
    system_prompt, human_prompt = _build_evidence_prompt(question, docs, prompt_variant)
    response = client.chat.completions.create(
        model=OPENAI_COMPARE_MODEL,
        max_completion_tokens=900,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": human_prompt},
        ],
    )
    return response.choices[0].message.content or ""


def _invoke_claude_direct(question: str) -> str:
    client = Anthropic(api_key=_env_any("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"), timeout=90, max_retries=0)
    response = client.messages.create(
        model=ANTHROPIC_COMPARE_MODEL,
        max_tokens=700,
        system="당신은 한국 복지 정책을 설명하는 AI입니다. 정확하고 간결하게 답하세요.",
        messages=[{"role": "user", "content": question}],
    )
    parts = [block.text for block in response.content if getattr(block, "type", "") == "text"]
    return "\n".join(parts).strip()


def _invoke_claude_evidence(question: str, docs: list[dict[str, Any]], prompt_variant: str) -> str:
    client = Anthropic(api_key=_env_any("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"), timeout=90, max_retries=0)
    system_prompt, human_prompt = _build_evidence_prompt(question, docs, prompt_variant)
    response = client.messages.create(
        model=ANTHROPIC_COMPARE_MODEL,
        max_tokens=900,
        system=system_prompt,
        messages=[{"role": "user", "content": human_prompt}],
    )
    parts = [block.text for block in response.content if getattr(block, "type", "") == "text"]
    return "\n".join(parts).strip()


def _invoke_gemini(question: str, *, docs: list[dict[str, Any]] | None = None, prompt_variant: str = "B") -> str:
    api_key = _env_any("GEMINI_API_KEY", "Gemini_API_Key", "GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY/Gemini_API_Key is not set")
    if docs:
        system_prompt, human_prompt = _build_evidence_prompt(question, docs, prompt_variant)
        prompt = f"{system_prompt}\n\n{human_prompt}"
    else:
        prompt = _build_direct_prompt(question)

    url = "https://generativelanguage.googleapis.com/v1beta/models/" f"{GEMINI_COMPARE_MODEL}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "\n".join(str(part.get("text", "")) for part in parts).strip()


def _available_targets() -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = [("benepick", "full_rag")]
    if _env_any("OPENAI_API_KEY", "GPT_API_KEY"):
        targets.extend([("openai", "direct"), ("openai", "evidence")])
    if _env_any("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"):
        targets.extend([("claude", "direct"), ("claude", "evidence")])
    if _env_any("GEMINI_API_KEY", "Gemini_API_Key", "GOOGLE_API_KEY"):
        targets.extend([("gemini", "direct"), ("gemini", "evidence")])
    return targets


def _needs_retrieval(targets: list[tuple[str, str]]) -> bool:
    return any(provider == "benepick" or mode == "evidence" for provider, mode in targets)


def _retrieve_docs(question: str) -> list[dict[str, Any]]:
    from rag.pipeline import retrieve_rag_documents

    retrieval = retrieve_rag_documents(question, {})
    data = retrieval.get("data") or {}
    return data.get("final_docs") or []


def _generate_answer(provider: str, mode: str, question: str, docs: list[dict[str, Any]], prompt_variant: str) -> str:
    if provider == "benepick" and mode == "full_rag":
        from rag.pipeline import generate_answer

        return generate_answer(question, docs, "ko", prompt_variant=prompt_variant)
    if provider == "openai" and mode == "direct":
        return _invoke_openai_direct(question)
    if provider == "openai" and mode == "evidence":
        return _invoke_openai_evidence(question, docs, prompt_variant)
    if provider == "claude" and mode == "direct":
        return _invoke_claude_direct(question)
    if provider == "claude" and mode == "evidence":
        return _invoke_claude_evidence(question, docs, prompt_variant)
    if provider == "gemini" and mode == "direct":
        return _invoke_gemini(question)
    if provider == "gemini" and mode == "evidence":
        return _invoke_gemini(question, docs=docs, prompt_variant=prompt_variant)
    raise ValueError(f"unsupported provider/mode: {provider}/{mode}")


def _fallback_judge_for_direct_error(reason: str) -> dict[str, Any]:
    return {
        "groundedness": 1,
        "relevance": 1,
        "coverage": 1,
        "actionability": 1,
        "hallucination_risk": 5,
        "overall": 1,
        "verdict": "FAIL",
        "rationale": reason,
    }


def run_comparison(
    input_csv: Path,
    output_dir: Path,
    prompt_variant: str = "B",
    limit: int | None = None,
    targets: list[tuple[str, str]] | None = None,
) -> tuple[Path, Path]:
    frame = _load_questions(input_csv)
    if limit:
        frame = frame.head(limit)
    targets = targets or _available_targets()
    if not targets:
        raise RuntimeError("No available targets. Set at least one provider API key.")

    output_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    retrieval_cache: dict[str, list[dict[str, Any]]] = {}
    should_retrieve = _needs_retrieval(targets)

    for row_index, row in frame.iterrows():
        question = str(row["question"]).strip()
        category = str(row.get("category", "")).strip()
        query_type = str(row.get("query_type", "")).strip()
        print(f"[Question {row_index + 1}/{len(frame)}] {question}", flush=True)

        docs: list[dict[str, Any]] = []
        if should_retrieve:
            if question not in retrieval_cache:
                print("  retrieving evidence...", flush=True)
                retrieval_cache[question] = _retrieve_docs(question)
            docs = retrieval_cache[question]
        top_policy_names = " | ".join(str(doc.get("policy_name", "")).strip() for doc in docs[:3])

        for provider, mode in targets:
            print(f"  running {provider}:{mode}", flush=True)
            try:
                if provider != "benepick" and mode == "evidence" and not docs:
                    raise RuntimeError("no evidence docs retrieved")
                answer = _generate_answer(provider, mode, question, docs, prompt_variant)
                judged = _judge_answer(question, answer, docs[:3])
                rows.append(
                    {
                        "question": question,
                        "category": category,
                        "query_type": query_type,
                        "provider": provider,
                        "mode": mode,
                        "prompt_variant": prompt_variant,
                        "answer": answer,
                        "doc_count": len(docs),
                        "top_policy_names": top_policy_names,
                        "groundedness": judged.get("groundedness"),
                        "relevance": judged.get("relevance"),
                        "coverage": judged.get("coverage"),
                        "actionability": judged.get("actionability"),
                        "hallucination_risk": judged.get("hallucination_risk"),
                        "overall": judged.get("overall"),
                        "verdict": judged.get("verdict"),
                        "rationale": judged.get("rationale"),
                    }
                )
            except Exception as exc:
                reason = f"run error: {exc}"
                print(f"  ERROR {provider}:{mode}: {exc}", flush=True)
                judged = _fallback_judge_for_direct_error(reason)
                rows.append(
                    {
                        "question": question,
                        "category": category,
                        "query_type": query_type,
                        "provider": provider,
                        "mode": mode,
                        "prompt_variant": prompt_variant,
                        "answer": "",
                        "doc_count": len(docs),
                        "top_policy_names": top_policy_names,
                        **judged,
                    }
                )

    detail = pd.DataFrame(rows)
    summary_rows: list[dict[str, Any]] = []
    for (provider, mode), group in detail.groupby(["provider", "mode"], dropna=False):
        summary_rows.append(
            {
                "provider": provider,
                "mode": mode,
                "num_questions": int(len(group)),
                "avg_groundedness": round(float(group["groundedness"].mean()), 4),
                "avg_relevance": round(float(group["relevance"].mean()), 4),
                "avg_coverage": round(float(group["coverage"].mean()), 4),
                "avg_actionability": round(float(group["actionability"].mean()), 4),
                "avg_hallucination_risk": round(float(group["hallucination_risk"].mean()), 4),
                "avg_overall": round(float(group["overall"].mean()), 4),
                "pass_rate": round(float((group["verdict"] == "PASS").mean()), 4),
            }
        )
    summary = pd.DataFrame(summary_rows).sort_values(["mode", "avg_overall"], ascending=[True, False])

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    detail_path = output_dir / f"llm_compare_detail_{timestamp}.csv"
    summary_path = output_dir / f"llm_compare_summary_{timestamp}.csv"
    detail.to_csv(detail_path, index=False, encoding="utf-8-sig")
    summary.to_csv(summary_path, index=False, encoding="utf-8-sig")
    return detail_path, summary_path


def parse_targets(raw_targets: list[str] | None) -> list[tuple[str, str]] | None:
    if not raw_targets:
        return None
    parsed: list[tuple[str, str]] = []
    for item in raw_targets:
        provider, _, mode = item.partition(":")
        provider = provider.strip().lower()
        mode = mode.strip().lower()
        if not provider or not mode:
            raise ValueError(f"invalid target: {item} (use provider:mode)")
        parsed.append((provider, mode))
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare BenePick RAG against GPT / Claude / Gemini")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="CSV path with question/category/query_type")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="directory to save outputs")
    parser.add_argument("--prompt-variant", default="B", help="prompt variant for evidence/full-rag generation")
    parser.add_argument("--limit", type=int, default=None, help="only run first N questions")
    parser.add_argument(
        "--targets",
        nargs="*",
        help="optional targets like benepick:full_rag openai:direct openai:evidence claude:direct gemini:evidence",
    )
    args = parser.parse_args()

    detail_path, summary_path = run_comparison(
        input_csv=Path(args.input),
        output_dir=Path(args.output_dir),
        prompt_variant=str(args.prompt_variant or "B").upper(),
        limit=args.limit,
        targets=parse_targets(args.targets),
    )
    print("detail_csv:", detail_path)
    print("summary_csv:", summary_path)


if __name__ == "__main__":
    main()
