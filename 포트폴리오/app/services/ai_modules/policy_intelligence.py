from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import re
from typing import Any

from .support_guidance import build_support_guidance


INCOME_ORDER = {
    "MID_0_50": 1,
    "MID_50_60": 1,
    "MID_51_75": 2,
    "MID_60_80": 2,
    "MID_76_100": 3,
    "MID_80_100": 3,
    "MID_101_200": 4,
    "MID_200_PLUS": 5,
}

PROFILE_LABELS = {
    "SINGLE": "1인 가구",
    "TWO_PERSON": "2인 가구",
    "MULTI_PERSON": "다인 가구",
    "UNEMPLOYED": "미취업",
    "EMPLOYED": "재직",
    "SELF_EMPLOYED": "자영업",
    "MONTHLY_RENT": "월세",
    "JEONSE": "전세",
    "OWNER_FAMILY_HOME": "자가/가족주택",
}

CATEGORY_KEYWORDS = (
    ("주거", ("월세", "주거", "주택", "임대", "전세", "보증금")),
    ("취업/교육", ("취업", "고용", "일자리", "훈련", "배움", "교육", "자격증")),
    ("건강", ("건강", "의료", "상담", "심리", "마음", "진료")),
    ("자산형성", ("계좌", "저축", "금융", "자산", "적금", "기여금")),
    ("창업", ("창업", "사업", "스타트업", "사관학교")),
    ("생활지원", ("생활", "생계", "돌봄", "가족", "보육")),
)

CONFLICT_RULES = (
    ("NON_STACKABLE:MONTHLY_RENT", ("월세", "월세지원", "주거급여")),
    ("NON_STACKABLE:JOB_TRAINING", ("내일배움카드", "훈련비", "직업훈련")),
    ("NON_STACKABLE:MENTAL_HEALTH", ("마음건강", "심리상담", "상담 바우처")),
    ("NON_STACKABLE:ASSET_ACCOUNT", ("도약계좌", "저축계좌", "청년희망적금")),
    ("NON_STACKABLE:STARTUP_GRANT", ("창업사관학교", "창업지원금", "창업패키지")),
)


@dataclass
class PolicyIntelligence:
    category: str
    conflict_group: str
    conflict_reason: str | None
    condition_tags: list[str] = field(default_factory=list)
    fit_reasons: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)
    required_actions: list[str] = field(default_factory=list)
    eligibility_evidence: list[str] = field(default_factory=list)
    benefit_evidence: list[str] = field(default_factory=list)
    application_evidence: list[str] = field(default_factory=list)
    evidence_snippets: list[str] = field(default_factory=list)
    guide_tags: list[str] = field(default_factory=list)
    decision_summary: str = ""
    exclusion_reason: str | None = None
    evidence_quality: str = "LOW"
    grounded_score: int = 0


def _text(value: Any) -> str:
    return str(value or "").strip()


def _compact(text: str) -> str:
    return re.sub(r"\s+", " ", _text(text)).strip()


def _get(obj: Any, name: str, default: Any = None) -> Any:
    return getattr(obj, name, default) if obj is not None else default


def _clip(text: str, limit: int = 120) -> str:
    compact = _compact(text)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def _unique(items: list[str], limit: int = 4) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        clean = _clip(item)
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        result.append(clean)
        if len(result) >= limit:
            break
    return result


def _sentences(text: str) -> list[str]:
    compact = _compact(text)
    if not compact:
        return []
    parts = re.split(r"(?<=[.!?。！？])\s+|[;\n\r]+|(?<=다\.)\s*", compact)
    return [_clip(part, 140) for part in parts if _compact(part)]


def _find_snippets(text: str, keywords: tuple[str, ...], limit: int = 3) -> list[str]:
    snippets: list[str] = []
    for sentence in _sentences(text):
        if any(keyword in sentence for keyword in keywords):
            snippets.append(sentence)
    if snippets:
        return _unique(snippets, limit)

    compact = _compact(text)
    for keyword in keywords:
        idx = compact.find(keyword)
        if idx < 0:
            continue
        start = max(0, idx - 45)
        end = min(len(compact), idx + 95)
        snippets.append(compact[start:end])
    return _unique(snippets, limit)


def _policy_text(
    *,
    title: str | None,
    master: Any,
    condition: Any,
    benefit: Any,
    application: Any,
) -> str:
    parts = [
        title or "",
        _get(master, "summary", ""),
        _get(master, "description", ""),
        _get(master, "category_large", ""),
        _get(master, "category_medium", ""),
        _get(condition, "income_text", ""),
        _get(condition, "additional_qualification_text", ""),
        _get(condition, "restricted_target_text", ""),
        _get(benefit, "benefit_detail_text", ""),
        _get(benefit, "benefit_amount_raw_text", ""),
        _get(benefit, "benefit_period_label", ""),
        _get(application, "application_method_text", ""),
        _get(application, "application_period_text", ""),
        _get(application, "business_period_etc_text", ""),
        _get(application, "screening_method_text", ""),
        _get(application, "processing_note_text", ""),
    ]
    return _compact(" ".join(_text(part) for part in parts))


def infer_policy_category(master: Any, title: str | None) -> str:
    text = _policy_text(title=title, master=master, condition=None, benefit=None, application=None)
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in text for keyword in keywords):
            return category
    return "기타"


def _normalize_title(title: str | None) -> str:
    text = re.sub(r"\([^)]*\)", "", _text(title).lower())
    return re.sub(r"[^0-9a-zA-Z가-힣]+", "", text)


def infer_conflict_group(master: Any, title: str | None, category: str) -> tuple[str, str | None]:
    text = _policy_text(title=title, master=master, condition=None, benefit=None, application=None)
    for group, keywords in CONFLICT_RULES:
        if any(keyword in text for keyword in keywords):
            return group, "동일 성격의 정책은 중복 수혜 가능성이 낮아 하나만 선택합니다."
    return f"STACKABLE:{category}:{_normalize_title(title)[:36]}", None


def _income_allowed(profile_income: str | None, condition_income: str | None) -> tuple[bool | None, str | None]:
    if not condition_income:
        return None, None
    codes = [code.strip() for code in condition_income.split(",") if code.strip()]
    if not codes:
        return None, None
    profile_level = INCOME_ORDER.get(_text(profile_income), 99)
    allowed_level = min(INCOME_ORDER.get(code, 99) for code in codes)
    label = ", ".join(codes)
    return profile_level <= allowed_level, f"소득 구간 조건: {label}"


def _code_match(profile_value: str | None, allowed_values: list[str] | None) -> bool | None:
    if not allowed_values:
        return None
    return _text(profile_value) in set(allowed_values)


def _period_action(application: Any) -> tuple[list[str], list[str]]:
    risks: list[str] = []
    actions: list[str] = []
    end_date = _get(application, "business_period_end_date")
    period_text = " ".join(
        [
            _text(_get(application, "application_period_text")),
            _text(_get(application, "business_period_etc_text")),
        ]
    )
    if end_date:
        try:
            due = datetime.strptime(str(end_date), "%Y-%m-%d").date()
            days_left = (due - datetime.utcnow().date()).days
            if days_left < 0:
                risks.append("신청 기간이 종료되었을 수 있습니다.")
            elif days_left <= 14:
                risks.append(f"신청 마감까지 {days_left}일 남았습니다.")
                actions.append("마감 전 신청 가능 여부를 먼저 확인하세요.")
        except ValueError:
            actions.append("공고의 신청 기간 표기를 확인하세요.")
    elif any(keyword in period_text for keyword in ("상시", "수시", "연중")):
        actions.append("상시 접수 정책이므로 현재 접수 기관을 확인하세요.")
    elif period_text:
        actions.append("신청 기간과 예산 소진 여부를 확인하세요.")
    else:
        actions.append("공식 공고에서 신청 기간을 확인하세요.")
    return risks, actions


def build_policy_intelligence(
    *,
    profile: Any,
    row: Any,
    master: Any,
    condition: Any,
    benefit: Any,
    application: Any,
    benefit_estimate: dict[str, object],
) -> PolicyIntelligence:
    title = _get(row, "title") or _get(master, "title")
    text = _policy_text(title=title, master=master, condition=condition, benefit=benefit, application=application)
    category = infer_policy_category(master, title)
    conflict_group, conflict_reason = infer_conflict_group(master, title, category)

    eligibility_evidence = _find_snippets(
        text,
        ("대상", "자격", "조건", "소득", "나이", "연령", "가구", "무주택", "취업", "청년"),
        limit=3,
    )
    benefit_evidence = _find_snippets(
        text,
        ("지원", "지급", "급여", "월", "연", "만원", "훈련비", "상담", "기여금", "대출", "융자"),
        limit=3,
    )
    application_evidence = _find_snippets(
        text,
        ("신청", "접수", "온라인", "방문", "복지로", "주민센터", "제출", "기간"),
        limit=2,
    )

    fit_reasons: list[str] = []
    risk_flags: list[str] = list(_get(row, "blocking_reasons_json", []) or [])
    required_actions: list[str] = list(_get(row, "recommended_actions_json", []) or [])
    condition_tags: list[str] = []

    age = _get(profile, "age")
    age_min = _get(condition, "age_min")
    age_max = _get(condition, "age_max")
    if age is not None and (age_min is not None or age_max is not None):
        if (age_min is None or age >= age_min) and (age_max is None or age <= age_max):
            fit_reasons.append(f"나이 {age}세가 공고 연령 조건에 들어갑니다.")
            condition_tags.append("연령 조건 확인")
        else:
            risk_flags.append(f"나이 {age}세가 공고 연령 조건과 다를 수 있습니다.")
            required_actions.append("연령 기준일과 만 나이 적용 여부를 확인하세요.")

    income_ok, income_note = _income_allowed(_get(profile, "income_band"), _get(condition, "income_code"))
    if income_ok is True:
        fit_reasons.append(f"{income_note}을 현재 입력 조건이 충족합니다.")
        condition_tags.append("소득 조건 확인")
    elif income_ok is False:
        risk_flags.append(f"{income_note}을 초과할 수 있습니다.")
        required_actions.append("건강보험료 또는 소득 증빙 기준을 다시 확인하세요.")

    checks = [
        ("가구", _get(profile, "household_type"), _get(condition, "household_type_codes_json")),
        ("고용", _get(profile, "employment_status"), _get(condition, "employment_codes_json")),
        ("주거", _get(profile, "housing_status"), _get(condition, "housing_codes_json")),
    ]
    for label, profile_value, allowed in checks:
        matched = _code_match(profile_value, allowed)
        if matched is True:
            fit_reasons.append(f"{label} 조건이 입력값({PROFILE_LABELS.get(_text(profile_value), _text(profile_value))})과 맞습니다.")
            condition_tags.append(f"{label} 조건 확인")
        elif matched is False:
            risk_flags.append(f"{label} 조건이 입력값과 다를 수 있습니다.")
            required_actions.append(f"{label} 관련 증빙 또는 세부 기준을 확인하세요.")

    period_risks, period_actions = _period_action(application)
    risk_flags.extend(period_risks)
    required_actions.extend(period_actions)

    if benefit_estimate.get("is_cash_equivalent") is False:
        risk_flags.append("대출/융자 한도는 실제 지급 수혜액과 달라 총액 합산에서 제외합니다.")

    risk_flags, required_actions, guide_tags = build_support_guidance(
        title=title,
        policy_text=text,
        risk_flags=risk_flags,
        required_actions=required_actions,
        is_cash_equivalent=bool(benefit_estimate.get("is_cash_equivalent")),
    )

    evidence_snippets = _unique(eligibility_evidence + benefit_evidence + application_evidence, limit=5)
    evidence_count = len(evidence_snippets)
    evidence_quality = "HIGH" if evidence_count >= 4 else "MEDIUM" if evidence_count >= 2 else "LOW"
    grounded_score = min(100, 40 + evidence_count * 12 + len(fit_reasons) * 8 - len(risk_flags) * 4)
    grounded_score = max(0, grounded_score)

    status = _text(_get(row, "apply_status"))
    amount_label = _text(benefit_estimate.get("annual_amount_label")) or "금액 확인 필요"
    calc_basis = _text(benefit_estimate.get("calculation_basis"))
    if status == "APPLICABLE_NOW":
        decision_summary = f"현재 입력 조건과 맞는 근거가 있어 {amount_label}을 포트폴리오 후보로 반영했습니다."
    elif status == "NEEDS_CHECK":
        decision_summary = f"일부 조건 확인이 필요하지만 {amount_label} 규모의 수혜 가능성이 있어 후보로 유지했습니다."
    else:
        decision_summary = "현재 입력 조건 기준으로는 신청 가능성이 낮아 포트폴리오 합산에서 제외합니다."

    if calc_basis:
        decision_summary = f"{decision_summary} 계산 근거: {calc_basis}"

    exclusion_reason = None
    if status == "NOT_RECOMMENDED":
        exclusion_reason = risk_flags[0] if risk_flags else "현재 입력 조건과 맞지 않아 제외했습니다."
    elif benefit_estimate.get("is_cash_equivalent") is False:
        exclusion_reason = "대출/융자 한도는 현금성 수혜액과 달라 총액 합산에서 제외합니다."

    return PolicyIntelligence(
        category=category,
        conflict_group=conflict_group,
        conflict_reason=conflict_reason,
        condition_tags=_unique(condition_tags, 5),
        fit_reasons=_unique(fit_reasons, 5),
        risk_flags=_unique(risk_flags, 5),
        required_actions=_unique(required_actions, 5),
        eligibility_evidence=eligibility_evidence,
        benefit_evidence=benefit_evidence,
        application_evidence=application_evidence,
        evidence_snippets=evidence_snippets,
        guide_tags=guide_tags,
        decision_summary=_clip(decision_summary, 220),
        exclusion_reason=exclusion_reason,
        evidence_quality=evidence_quality,
        grounded_score=grounded_score,
    )
