from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CHUNK_PATHS = (
    PROJECT_ROOT / "processed" / "chunks.csv",
    PROJECT_ROOT / "processed" / "gov24" / "chunks.csv",
)

TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]{2,}")
REGION_PATTERN = re.compile(r"[가-힣]{2,}(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구)")
STOPWORDS = {
    "지원",
    "관련",
    "정책",
    "조건",
    "기준",
    "현재",
    "신청",
    "가구",
    "거주",
}
REGION_ALIASES = {
    "전국": "전국",
    "서울특별시": "서울",
    "서울시": "서울",
    "서울": "서울",
    "부산광역시": "부산",
    "부산시": "부산",
    "부산": "부산",
    "대구광역시": "대구",
    "대구시": "대구",
    "대구": "대구",
    "인천광역시": "인천",
    "인천시": "인천",
    "인천": "인천",
    "광주광역시": "광주",
    "광주시": "광주",
    "광주": "광주",
    "대전광역시": "대전",
    "대전시": "대전",
    "대전": "대전",
    "울산광역시": "울산",
    "울산시": "울산",
    "울산": "울산",
    "세종특별자치시": "세종",
    "세종시": "세종",
    "세종": "세종",
    "경기도": "경기",
    "경기": "경기",
    "강원특별자치도": "강원",
    "강원도": "강원",
    "강원": "강원",
    "충청북도": "충북",
    "충북": "충북",
    "충청남도": "충남",
    "충남": "충남",
    "전북특별자치도": "전북",
    "전라북도": "전북",
    "전북": "전북",
    "전라남도": "전남",
    "전남": "전남",
    "경상북도": "경북",
    "경북": "경북",
    "경상남도": "경남",
    "경남": "경남",
    "제주특별자치도": "제주",
    "제주도": "제주",
    "제주": "제주",
}
YOUTH_KEYWORDS = ("청년", "사회초년생")
CHILD_KEYWORDS = ("영유아", "아동", "유아", "출산")
SENIOR_KEYWORDS = ("노인", "어르신", "고령", "실버")
MONTHLY_RENT_KEYWORDS = ("월세", "월 임차", "월 임대료", "임차료")
JEONSE_KEYWORDS = ("전세", "전월세", "보증금")
EMPLOYED_KEYWORDS = ("재직", "근로자", "근로소득자", "직장인")
UNEMPLOYED_KEYWORDS = ("미취업", "구직", "취업준비", "무소득")
SELF_EMPLOYED_KEYWORDS = ("사업자", "자영업", "소상공인", "개인사업")
INCOME_HINTS = {
    "MID_50_60": ("중위소득 50%", "중위소득 60%", "저소득", "차상위"),
    "MID_60_80": ("중위소득 60%", "중위소득 70%", "중위소득 80%"),
    "MID_80_100": ("중위소득 80%", "중위소득 100%", "중산층"),
}


@lru_cache(maxsize=1)
def _load_chunks() -> tuple[dict[str, str], ...]:
    rows: list[dict[str, str]] = []
    for path in CHUNK_PATHS:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                rows.append(
                    {
                        "policy_id": str(row.get("policy_id") or "").strip(),
                        "policy_name": str(row.get("policy_name") or "").strip(),
                        "category": str(row.get("category") or "").strip(),
                        "region": str(row.get("region") or "").strip(),
                        "source_url": str(row.get("source_url") or "").strip(),
                        "text": str(row.get("text") or "").strip(),
                    }
                )
    return tuple(rows)


def search_payload(query: str, user_condition: dict[str, object], *, limit: int = 20) -> dict:
    chunks = _load_chunks()
    if not chunks:
        return {"success": False, "data": {"answer": None, "docs_used": []}}

    enriched_query = _join_query_text(query, user_condition)
    tokens = _tokenize(enriched_query)
    if not tokens:
        return {"success": False, "data": {"answer": None, "docs_used": []}}

    scored = []
    for row in chunks:
        score = _score_row(row, tokens, user_condition)
        if score <= 0:
            continue
        scored.append((score, row))

    if not scored:
        return {"success": False, "data": {"answer": None, "docs_used": []}}

    scored.sort(key=lambda item: (item[0], item[1]["policy_name"]), reverse=True)

    docs_used: list[str] = []
    top_rows: list[dict[str, str]] = []
    for _, row in scored:
        policy_id = row["policy_id"]
        if not policy_id or policy_id in docs_used:
            continue
        docs_used.append(policy_id)
        top_rows.append(row)
        if len(top_rows) >= limit:
            break

    titles = [row["policy_name"] for row in top_rows[:3] if row["policy_name"]]
    answer = None
    if titles:
        answer = "입력 조건과 연결된 정책으로 " + ", ".join(titles) + " 등이 검색되었습니다."

    return {"success": bool(docs_used), "data": {"answer": answer, "docs_used": docs_used}}


def _join_query_text(query: str, user_condition: dict[str, object]) -> str:
    parts = [str(query or "").strip()]
    for value in user_condition.values():
        if value is None:
            continue
        if isinstance(value, (list, tuple, set)):
            parts.extend(str(item).strip() for item in value if str(item).strip())
            continue
        parts.append(str(value).strip())
    return " ".join(part for part in parts if part)


def _tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for token in TOKEN_RE.findall(text.lower()):
        if token in STOPWORDS:
            continue
        tokens.append(token)
    return tokens


def _extract_region_tokens(text: str) -> set[str]:
    tokens: set[str] = set()
    for raw_label, normalized in REGION_ALIASES.items():
        if raw_label in text:
            tokens.add(normalized)
    for match in REGION_PATTERN.findall(text):
        alias = REGION_ALIASES.get(match)
        if alias:
            tokens.add(alias)
        elif match.endswith(("구", "군")):
            tokens.add(match)
        elif match.endswith("시"):
            tokens.add(match.removesuffix("시"))
            tokens.add(match)
        else:
            tokens.add(match)
    return tokens


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _score_region(row: dict[str, str], user_condition: dict[str, object]) -> int:
    region_text = " ".join([row["region"], row["policy_name"], row["text"]])
    policy_regions = _extract_region_tokens(region_text)
    user_regions = _extract_region_tokens(str(user_condition.get("region") or ""))

    if not policy_regions or not user_regions:
        return 0
    if "전국" in policy_regions:
        return 2
    if shared := (policy_regions & user_regions):
        return 24 + (10 if any(token.endswith(("구", "군")) for token in shared) else 0)
    return -28


def _score_age(text: str, age_value: object) -> int:
    try:
        age = int(age_value)
    except (TypeError, ValueError):
        return 0

    score = 0
    if 19 <= age <= 39 and _contains_any(text, YOUTH_KEYWORDS):
        score += 10
    if age <= 7 and _contains_any(text, CHILD_KEYWORDS):
        score += 10
    if age >= 65 and _contains_any(text, SENIOR_KEYWORDS):
        score += 10
    if age >= 40 and _contains_any(text, YOUTH_KEYWORDS):
        score -= 6
    if age < 19 and _contains_any(text, SENIOR_KEYWORDS):
        score -= 6
    return score


def _score_profile_keywords(text: str, user_condition: dict[str, object]) -> int:
    score = 0

    housing_status = str(user_condition.get("housing_status") or "")
    if housing_status == "MONTHLY_RENT":
        score += 12 if _contains_any(text, MONTHLY_RENT_KEYWORDS) else 0
        score -= 4 if _contains_any(text, JEONSE_KEYWORDS) else 0
    elif housing_status == "JEONSE":
        score += 12 if _contains_any(text, JEONSE_KEYWORDS) else 0
        score -= 4 if _contains_any(text, MONTHLY_RENT_KEYWORDS) else 0

    employment_status = str(user_condition.get("employment_status") or "")
    if employment_status == "UNEMPLOYED" and _contains_any(text, UNEMPLOYED_KEYWORDS):
        score += 7
    if employment_status == "EMPLOYED" and _contains_any(text, EMPLOYED_KEYWORDS):
        score += 6
    if employment_status == "SELF_EMPLOYED" and _contains_any(text, SELF_EMPLOYED_KEYWORDS):
        score += 6

    household_type = str(user_condition.get("household_type") or "")
    if household_type == "SINGLE" and "1인 가구" in text:
        score += 8
    if household_type == "MULTI_PERSON" and ("다자녀" in text or "한부모" in text):
        score += 6

    income_band = str(user_condition.get("income_band") or "")
    hints = INCOME_HINTS.get(income_band, ())
    if hints and _contains_any(text, hints):
        score += 6

    return score


def _score_row(row: dict[str, str], tokens: list[str], user_condition: dict[str, object]) -> int:
    title = row["policy_name"].lower()
    category = row["category"].lower()
    region = row["region"].lower()
    body = row["text"].lower()
    combined = " ".join((title, category, region, body))

    score = 0
    for token in tokens:
        if token in title:
            score += 7
        if token in category:
            score += 3
        if token in region:
            score += 4
        if token in body:
            score += 1 + min(body.count(token), 2)

    score += _score_region(row, user_condition)
    score += _score_age(combined, user_condition.get("age"))
    score += _score_profile_keywords(combined, user_condition)
    return score
