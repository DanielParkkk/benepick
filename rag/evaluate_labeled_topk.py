"""
Labeled Top-K retrieval evaluator for BenePick RAG.

Purpose:
- Replace "similarity-only" evaluation with "ground-truth-in-TopK" evaluation.
- Support small, fast validation sets (20-30 labeled questions).

How to run (from project root):
  python -m rag.evaluate_labeled_topk --labels rag/eval_labels_template_30.csv --top-k 5 --alpha 0.6

Optional:
  python -m rag.evaluate_labeled_topk --labels rag/eval_labels_template_30.csv --use-enriched-query
  python -m rag.evaluate_labeled_topk --write-template rag/eval_labels_template_30.csv
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd


DEFAULT_TOPK = 5
DEFAULT_ALPHA = 0.5
DEFAULT_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]

INTEREST_TAG_LABELS = {
    "housing": "주거",
    "finance": "금융",
    "employment": "취업",
    "medical": "의료",
    "education": "교육",
    "care": "돌봄",
}

HOUSEHOLD_LABELS = {
    "SINGLE": "1인 가구",
    "COUPLE": "부부 가구",
    "MULTI_CHILD": "다자녀 가구",
    "MULTI_GENERATION": "다세대 가구",
}

EMPLOYMENT_LABELS = {
    "UNEMPLOYED": "미취업",
    "EMPLOYED": "재직",
    "SELF_EMPLOYED": "자영업",
    "STUDENT": "학생",
}

INCOME_BAND_LABELS = {
    "LOW_0_50": "중위소득 0~50%",
    "MID_50_60": "중위소득 50~60%",
    "MID_60_80": "중위소득 60~80%",
    "MID_80_100": "중위소득 80~100%",
    "MID_100_120": "중위소득 100~120%",
    "MID_120_150": "중위소득 120~150%",
}

QUESTION_HINTS = {
    "housing": [
        "월세",
        "전세",
        "주택",
        "주거",
        "임대",
        "보증금",
        "housing",
        "rent",
        "lease",
        "house",
        "home",
    ],
    "employment": [
        "취업",
        "구직",
        "일자리",
        "면접",
        "직업훈련",
        "도약",
        "employment",
        "job",
        "career",
        "work",
        "unemployed",
    ],
    "education": [
        "장학",
        "교육",
        "훈련",
        "국비",
        "평생교육",
        "역량",
        "education",
        "training",
        "scholarship",
        "study",
    ],
    "medical": [
        "의료",
        "의료비",
        "치료",
        "검진",
        "암환자",
        "정신건강",
        "임산부",
        "medical",
        "health",
        "hospital",
        "care",
    ],
    "finance": [
        "저소득",
        "기초생활수급",
        "차상위",
        "긴급복지",
        "생활안정",
        "한부모",
        "다문화",
        "finance",
        "income",
        "voucher",
        "benefit",
        "welfare",
    ],
}

DEFAULT_QUESTIONS_30 = [
    "서울 청년 월세 지원 받을 수 있나요?",
    "1인 가구 청년 주거비 지원 정책이 있나요?",
    "전세사기 피해자 주거 지원 정책이 있나요?",
    "주거급여 신청 자격이 궁금합니다.",
    "무주택 청년 전월세 지원 제도가 있나요?",
    "서울시 청년 주택 관련 지원을 알려주세요.",
    "미취업 청년 구직 지원 정책이 있나요?",
    "청년 취업성공패키지나 유사한 지원이 있나요?",
    "직업훈련비를 지원하는 정책이 궁금합니다.",
    "청년 일자리 도약 관련 지원이 있나요?",
    "중장년 재취업 훈련 지원 정책이 있나요?",
    "경력단절 여성 취업 지원이 궁금합니다.",
    "청년 교육훈련 장학 지원이 있나요?",
    "국비 교육과정 수강 지원 정책이 있나요?",
    "대학생 장학금 성격의 복지 정책이 있나요?",
    "평생교육 바우처 관련 정책이 있나요?",
    "디지털 역량 교육 지원 정책이 있나요?",
    "의료비 부담 완화 정책이 궁금합니다.",
    "암환자 의료비 지원 정책이 있나요?",
    "장애인 의료비 지원 정책이 있나요?",
    "임산부 의료/검진 지원 정책이 있나요?",
    "정신건강 상담/치료 지원 정책이 있나요?",
    "기초생활수급자 대상 주요 지원 정책은?",
    "차상위계층 지원 정책을 알려주세요.",
    "긴급복지 지원제도 신청 조건이 궁금합니다.",
    "저소득층 생활안정 지원 정책이 있나요?",
    "한부모가정 지원 정책이 있나요?",
    "다문화가정 지원 정책이 있나요?",
    "고령자 돌봄 지원 정책이 궁금합니다.",
    "서울 지역 청년 맞춤 복지 정책을 알려주세요.",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate Top-K retrieval with labeled ground truth.")
    parser.add_argument("--labels", type=str, default="rag/eval_labels_template_30.csv")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOPK)
    parser.add_argument("--alpha", type=float, default=DEFAULT_ALPHA)
    parser.add_argument("--weights", type=str, default="1.0,0.8,0.6,0.4,0.2")
    parser.add_argument("--output-dir", type=str, default="rag/eval_outputs")
    parser.add_argument("--use-enriched-query", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="0 means all rows.")
    parser.add_argument("--write-template", type=str, default="")
    return parser.parse_args()


def load_pipeline_api():
    try:
        from rag.pipeline import build_search_query, get_searcher
    except ImportError:
        from pipeline import build_search_query, get_searcher
    return build_search_query, get_searcher


def parse_list(value: object) -> list[str]:
    if value is None:
        return []
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return []
    parts = re.split(r"[|,;/]+", text)
    return [p.strip() for p in parts if p.strip()]


def parse_weights(raw: str, top_k: int) -> list[float]:
    vals = [v.strip() for v in raw.split(",") if v.strip()]
    weights = []
    for v in vals:
        try:
            weights.append(float(v))
        except ValueError:
            continue
    if not weights:
        weights = DEFAULT_WEIGHTS[:]
    if len(weights) < top_k:
        weights += [0.0] * (top_k - len(weights))
    return weights[:top_k]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def dedupe_terms(items: Iterable[object]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = str(item).strip()
        if not text or text.lower() == "nan":
            continue
        key = normalize_text(text)
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def parse_region_from_question(question: str) -> str:
    normalized_q = normalize_text(question)
    region_patterns = [
        "서울특별시",
        "서울시",
        "서울",
        "부산",
        "대구",
        "인천",
        "광주",
        "대전",
        "울산",
        "세종",
        "경기",
        "강원",
        "충북",
        "충남",
        "전북",
        "전남",
        "경북",
        "경남",
        "제주",
    ]
    for region in region_patterns:
        if region in question:
            if region in ("서울", "서울시"):
                return "서울특별시"
            return region
    if "seoul" in normalized_q:
        return "서울특별시"
    return ""


def infer_interest_tags(question: str) -> list[str]:
    normalized_q = normalize_text(question)
    tags: list[str] = []
    for tag, keywords in QUESTION_HINTS.items():
        if any(k in normalized_q for k in keywords):
            tags.append(tag)
    return tags


def normalize_user_condition(condition: dict) -> dict:
    normalized = dict(condition or {})

    household = str(normalized.get("household_type", "")).strip()
    if household:
        normalized["household_type"] = HOUSEHOLD_LABELS.get(household, household)

    employment = str(normalized.get("employment_status", "")).strip()
    if employment:
        normalized["employment_status"] = EMPLOYMENT_LABELS.get(employment, employment)

    income_band = str(normalized.get("income_band", "")).strip()
    if income_band:
        normalized["income_band"] = INCOME_BAND_LABELS.get(income_band, income_band)

    tags = normalized.get("interest_tags", [])
    if isinstance(tags, str):
        tags = parse_list(tags)
    if isinstance(tags, list):
        normalized["interest_tags"] = [
            INTEREST_TAG_LABELS.get(str(t).strip(), str(t).strip())
            for t in tags
            if str(t).strip()
        ]

    return normalized


def build_eval_enriched_query(
    question: str,
    user_condition: dict,
    build_search_query_fn,
) -> str:
    question = re.sub(r"\s+", " ", str(question).strip())
    normalized_condition = normalize_user_condition(user_condition)
    enriched = re.sub(r"\s+", " ", str(build_search_query_fn(question, normalized_condition)).strip())

    # If pipeline enrichment didn't change the text, add semantic hints in evaluator.
    if normalize_text(enriched) == normalize_text(question):
        hints: list[str] = []
        if normalized_condition.get("region"):
            hints.append(str(normalized_condition["region"]))
        if normalized_condition.get("age"):
            hints.append(f"만 {normalized_condition['age']}세")
        if normalized_condition.get("income_band"):
            hints.append(str(normalized_condition["income_band"]))
        if normalized_condition.get("income_level"):
            hints.append(str(normalized_condition["income_level"]))
        if normalized_condition.get("household_type"):
            hints.append(str(normalized_condition["household_type"]))
        if normalized_condition.get("employment_status"):
            hints.append(str(normalized_condition["employment_status"]))

        tags = normalized_condition.get("interest_tags", [])
        if isinstance(tags, str):
            tags = parse_list(tags)
        hints.extend(tags if isinstance(tags, list) else [])
        hints.extend(infer_interest_tags(question))

        hints = dedupe_terms(hints)
        if not hints:
            hints = ["복지", "지원", "정책"]
        if hints:
            enriched = f"{question} {' '.join(hints)}"

    return re.sub(r"\s+", " ", enriched).strip()


def build_user_condition(row: pd.Series, question: str) -> dict:
    condition: dict = {}

    raw_json = str(row.get("user_condition_json", "")).strip()
    if raw_json and raw_json.lower() != "nan":
        try:
            parsed = json.loads(raw_json)
            if isinstance(parsed, dict):
                condition.update(parsed)
        except json.JSONDecodeError:
            pass

    field_map = {
        "region": "region",
        "age": "age",
        "income_level": "income_level",
        "income_band": "income_band",
        "household_type": "household_type",
        "employment_status": "employment_status",
    }
    for src, dst in field_map.items():
        value = row.get(src)
        if value is None:
            continue
        text = str(value).strip()
        if text and text.lower() != "nan":
            if dst == "age":
                try:
                    condition[dst] = int(float(text))
                except ValueError:
                    condition[dst] = text
            else:
                condition[dst] = text

    interest_tags = parse_list(row.get("interest_tags", ""))
    if not interest_tags:
        interest_tags = infer_interest_tags(question)
    if interest_tags:
        condition["interest_tags"] = dedupe_terms(interest_tags)

    if not condition.get("region"):
        inferred_region = parse_region_from_question(question)
        if inferred_region:
            condition["region"] = inferred_region

    return condition


def dedupe_by_policy(results: list[dict], top_k: int) -> list[dict]:
    deduped: list[dict] = []
    seen: set[str] = set()

    for item in results:
        policy_id = str(item.get("policy_id", "")).strip()
        chunk_id = str(item.get("chunk_id", "")).strip()
        key = policy_id if policy_id else f"chunk:{chunk_id}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= top_k:
            break
    return deduped


def rank_score(rank: int | None, weights: list[float]) -> float:
    if rank is None:
        return 0.0
    if rank <= 0 or rank > len(weights):
        return 0.0
    return float(weights[rank - 1])


def first_match_rank(
    docs: list[dict],
    expected_ids: Iterable[str],
    expected_names: Iterable[str],
) -> tuple[int | None, str, str]:
    expected_id_set = {str(x).strip() for x in expected_ids if str(x).strip()}
    expected_name_list = [normalize_text(str(x)) for x in expected_names if str(x).strip()]

    for idx, doc in enumerate(docs, start=1):
        policy_id = str(doc.get("policy_id", "")).strip()
        policy_name = str(doc.get("policy_name", "")).strip()
        norm_name = normalize_text(policy_name)

        if expected_id_set and policy_id in expected_id_set:
            return idx, "policy_id", policy_id

        if expected_name_list and norm_name:
            if any(name in norm_name or norm_name in name for name in expected_name_list):
                return idx, "policy_name", policy_name

    return None, "", ""


def validate_labels(df: pd.DataFrame) -> pd.DataFrame:
    if "question" not in df.columns:
        raise ValueError("labels file must include 'question' column.")

    for required in ["expected_policy_ids", "expected_policy_names"]:
        if required not in df.columns:
            df[required] = ""

    mask = df["question"].astype(str).str.strip().ne("")
    df = df.loc[mask].copy()
    if df.empty:
        raise ValueError("labels file has no non-empty questions.")
    return df


def write_template(path: Path) -> None:
    rows = []
    for q in DEFAULT_QUESTIONS_30:
        rows.append(
            {
                "question": q,
                "expected_policy_ids": "",
                "expected_policy_names": "",
                "region": "",
                "age": "",
                "income_level": "",
                "income_band": "",
                "household_type": "",
                "employment_status": "",
                "interest_tags": "",
                "user_condition_json": "",
                "notes": "",
            }
        )
    out_df = pd.DataFrame(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"[template] wrote {len(out_df)} questions -> {path}")


def main() -> None:
    args = parse_args()

    if args.write_template:
        write_template(Path(args.write_template))
        return

    labels_path = Path(args.labels)
    if not labels_path.exists():
        raise FileNotFoundError(f"labels file not found: {labels_path}")

    df = pd.read_csv(labels_path)
    df = validate_labels(df)
    if args.limit and args.limit > 0:
        df = df.head(args.limit).copy()

    top_k = max(1, int(args.top_k))
    weights = parse_weights(args.weights, top_k=top_k)

    print("=" * 72)
    print("BenePick labeled Top-K evaluator")
    print("=" * 72)
    print(f"labels: {labels_path}")
    print(f"rows: {len(df)}")
    print(f"top_k: {top_k}, alpha: {args.alpha}, use_enriched_query: {args.use_enriched_query}")
    print(f"weights: {weights}")

    build_search_query_fn, get_searcher_fn = load_pipeline_api()
    searcher = get_searcher_fn()
    details: list[dict] = []

    hit1 = 0
    hit3 = 0
    hit5 = 0
    rr_total = 0.0
    score_total = 0.0
    latency_total_ms = 0.0

    for idx, row in df.iterrows():
        question = str(row.get("question", "")).strip()
        expected_ids = parse_list(row.get("expected_policy_ids", ""))
        expected_names = parse_list(row.get("expected_policy_names", ""))
        user_condition = build_user_condition(row, question)

        query_used = (
            build_eval_enriched_query(question, user_condition, build_search_query_fn)
            if args.use_enriched_query
            else question
        )

        started = time.perf_counter()
        raw_docs = searcher.search(
            query=query_used,
            top_k=max(25, top_k * 3),
            alpha=float(args.alpha),
            user_region=str(user_condition.get("region", "")),
        )
        docs = dedupe_by_policy(raw_docs, top_k=top_k)
        latency_ms = (time.perf_counter() - started) * 1000.0
        latency_total_ms += latency_ms

        rank, match_type, match_value = first_match_rank(docs, expected_ids, expected_names)
        point = rank_score(rank, weights)

        if rank == 1:
            hit1 += 1
        if rank is not None and rank <= 3:
            hit3 += 1
        if rank is not None and rank <= 5:
            hit5 += 1
        if rank is not None and rank > 0:
            rr_total += 1.0 / rank
        score_total += point

        details.append(
            {
                "row_index": int(idx),
                "question": question,
                "query_used": query_used,
                "expected_policy_ids": "|".join(expected_ids),
                "expected_policy_names": "|".join(expected_names),
                "first_hit_rank": rank if rank is not None else "",
                "rank_score": round(point, 4),
                "match_type": match_type,
                "matched_value": match_value,
                "predicted_policy_ids_topk": "|".join(str(d.get("policy_id", "")).strip() for d in docs),
                "predicted_policy_names_topk": "|".join(str(d.get("policy_name", "")).strip() for d in docs),
                "latency_ms": round(latency_ms, 2),
            }
        )

    n = len(df)
    summary = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "labels_path": str(labels_path),
        "num_questions": n,
        "top_k": top_k,
        "alpha": float(args.alpha),
        "use_enriched_query": bool(args.use_enriched_query),
        "weights": weights,
        "hit_at_1": round(hit1 / n, 4),
        "hit_at_3": round(hit3 / n, 4),
        "hit_at_5": round(hit5 / n, 4),
        "mrr": round(rr_total / n, 4),
        "avg_rank_score": round(score_total / n, 4),
        "avg_latency_ms": round(latency_total_ms / n, 2),
    }

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    detail_path = out_dir / f"labeled_topk_detail_{stamp}.csv"
    summary_path = out_dir / f"labeled_topk_summary_{stamp}.json"

    pd.DataFrame(details).to_csv(detail_path, index=False, encoding="utf-8-sig")
    with open(summary_path, "w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)

    print("-" * 72)
    print("Summary")
    print("-" * 72)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("-" * 72)
    print(f"detail_csv: {detail_path}")
    print(f"summary_json: {summary_path}")


if __name__ == "__main__":
    main()
