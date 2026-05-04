from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from langchain_core.messages import HumanMessage, SystemMessage

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from rag.pipeline import generate_answer, llm, retrieve_rag_documents


DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "rag" / "judge_outputs"
DEFAULT_QUESTIONS = [
    "서울 청년 월세 지원 받을 수 있나요?",
    "미취업 청년 구직 지원 정책이 있나요?",
    "암환자 의료비 지원 정책이 있나요?",
    "한부모가정 지원 정책이 있나요?",
    "차상위계층 지원 정책을 알려주세요.",
]


def _extract_json(text: str) -> dict[str, Any]:
    normalized = str(text or "").strip()
    match = re.search(r"\{.*\}", normalized, re.DOTALL)
    if not match:
        raise ValueError("judge response does not contain JSON")
    return json.loads(match.group(0))


def _judge_answer(question: str, answer: str, docs: list[dict[str, Any]]) -> dict[str, Any]:
    evidence = "\n\n".join(
        [
            (
                f"[{i+1}] 정책명: {doc.get('policy_name', '')}\n"
                f"근거: {str(doc.get('evidence_text', '')).strip()}\n"
                f"출처: {str(doc.get('source_url', '')).strip()}"
            )
            for i, doc in enumerate(docs[:3])
        ]
    )

    messages = [
        SystemMessage(
            content="""너는 복지 정책 RAG 응답을 평가하는 심사자다.
제공된 근거 문서와 답변만 보고 평가하라.

평가 항목:
- groundedness: 답변이 근거 문서에 실제로 있는 내용만 말하는가
- relevance: 질문에 직접적으로 답하는가
- coverage: 지원 대상, 지원 내용, 신청 방법 등 핵심을 적절히 담는가
- actionability: 사용자가 다음 행동을 할 수 있을 만큼 안내가 되는가
- hallucination_risk: 문서에 없는 조건/금액/기간을 지어냈을 위험
- overall: 종합 점수

반드시 아래 JSON만 반환하라.
{
  "groundedness": 1-5 정수,
  "relevance": 1-5 정수,
  "coverage": 1-5 정수,
  "actionability": 1-5 정수,
  "hallucination_risk": 1-5 정수,
  "overall": 1-5 정수,
  "verdict": "PASS" 또는 "FAIL",
  "rationale": "한두 문장 요약"
}

규칙:
- hallucination_risk는 높을수록 위험이 큰 점수다.
- 근거 문서에 없는 내용을 단정하면 groundedness를 낮추고 hallucination_risk를 높여라.
- 답변이 비어 있거나 지나치게 모호하면 relevance와 coverage를 낮춰라."""
        ),
        HumanMessage(
            content=(
                f"질문:\n{question}\n\n"
                f"근거 문서:\n{evidence}\n\n"
                f"모델 답변:\n{answer}\n\n"
                "평가 JSON:"
            )
        ),
    ]
    response = llm.invoke(messages)
    parsed = _extract_json(getattr(response, "content", response))
    return parsed


def _load_questions(input_path: str | None) -> list[str]:
    if not input_path:
        return DEFAULT_QUESTIONS
    frame = pd.read_csv(input_path).fillna("")
    if "question" not in frame.columns:
        raise ValueError("input csv must include a 'question' column")
    return [str(q).strip() for q in frame["question"].tolist() if str(q).strip()]


def run_judge(questions: list[str], output_dir: Path, prompt_variant: str = "A") -> tuple[Path, Path]:
    rows: list[dict[str, Any]] = []
    prompt_variant = str(prompt_variant or "A").upper()

    for question in questions:
        try:
            retrieval = retrieve_rag_documents(question, {})
            if not retrieval.get("success"):
                rows.append(
                    {
                        "question": question,
                        "prompt_variant": prompt_variant,
                        "answer": "",
                        "doc_count": 0,
                        "groundedness": 1,
                        "relevance": 1,
                        "coverage": 1,
                        "actionability": 1,
                        "hallucination_risk": 5,
                        "overall": 1,
                        "verdict": "FAIL",
                        "rationale": retrieval.get("error_message") or "retrieval failed",
                    }
                )
                continue

            data = retrieval.get("data") or {}
            docs = data.get("final_docs") or []
            answer = generate_answer(question, docs, "ko", prompt_variant=prompt_variant)
            judged = _judge_answer(question, answer, docs)
            rows.append(
                {
                    "question": question,
                    "prompt_variant": prompt_variant,
                    "answer": answer,
                    "doc_count": len(docs),
                    "top_policy_names": " | ".join([str(doc.get("policy_name", "")).strip() for doc in docs[:3]]),
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
            rows.append(
                {
                    "question": question,
                    "prompt_variant": prompt_variant,
                    "answer": "",
                    "doc_count": 0,
                    "groundedness": 1,
                    "relevance": 1,
                    "coverage": 1,
                    "actionability": 1,
                    "hallucination_risk": 5,
                    "overall": 1,
                    "verdict": "FAIL",
                    "rationale": f"judge error: {exc}",
                }
            )

    frame = pd.DataFrame(rows)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir.mkdir(parents=True, exist_ok=True)

    detail_path = output_dir / f"llm_judge_detail_{prompt_variant}_{timestamp}.csv"
    summary_path = output_dir / f"llm_judge_summary_{prompt_variant}_{timestamp}.json"
    frame.to_csv(detail_path, index=False, encoding="utf-8-sig")

    summary = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "prompt_variant": prompt_variant,
        "num_questions": len(frame),
        "avg_groundedness": round(float(frame["groundedness"].mean()), 4) if not frame.empty else 0.0,
        "avg_relevance": round(float(frame["relevance"].mean()), 4) if not frame.empty else 0.0,
        "avg_coverage": round(float(frame["coverage"].mean()), 4) if not frame.empty else 0.0,
        "avg_actionability": round(float(frame["actionability"].mean()), 4) if not frame.empty else 0.0,
        "avg_hallucination_risk": round(float(frame["hallucination_risk"].mean()), 4) if not frame.empty else 0.0,
        "avg_overall": round(float(frame["overall"].mean()), 4) if not frame.empty else 0.0,
        "pass_rate": round(float((frame["verdict"] == "PASS").mean()), 4) if not frame.empty else 0.0,
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return detail_path, summary_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Reference-free LLM judge evaluation for BenePick RAG answers")
    parser.add_argument("--input", help="CSV path with a 'question' column", default=None)
    parser.add_argument("--output-dir", help="directory to save outputs", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--prompt-variant", help="answer prompt variant to test (A or B)", default="A")
    args = parser.parse_args()

    questions = _load_questions(args.input)
    detail_path, summary_path = run_judge(questions, Path(args.output_dir), prompt_variant=args.prompt_variant)
    print("detail_csv:", detail_path)
    print("summary_json:", summary_path)


if __name__ == "__main__":
    main()
