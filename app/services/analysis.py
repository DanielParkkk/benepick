from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import math
import re

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisProfileState,
    AnalysisResultState,
    PolicyApplication,
    PolicyBenefit,
    PolicyCondition,
    PolicyDocument,
    PolicyMaster,
)
from app.schemas.common import ApplyStatus, ScoreLevel
from app.schemas.eligibility import AnalyzeRequest


@dataclass
class AnalyzedPolicy:
    policy_id: str
    title: str
    description: str | None
    match_score: int
    score_level: ScoreLevel
    apply_status: ApplyStatus
    source_url: str | None
    eligibility_summary: str
    blocking_reasons: list[str]
    recommended_actions: list[str]
    benefit_amount: int | None
    benefit_amount_label: str | None
    benefit_summary: str | None
    badge_items: list[str]


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

SCORE_WEIGHTS = {
    "condition": 0.55,
    "intent": 0.2,
    "benefit": 0.15,
    "urgency": 0.1,
}

INTEREST_KEYWORDS: dict[str, set[str]] = {
    "housing": {"주거", "주택", "임대", "월세", "전세", "housing", "rent"},
    "medical": {"의료", "병원", "건강", "medical", "health"},
    "education": {"교육", "학습", "훈련", "장학", "education", "study"},
    "employment": {"취업", "고용", "일자리", "employment", "job", "work"},
    "startup": {"창업", "스타트업", "startup", "business"},
    "welfare": {"복지", "생활", "지원", "welfare"},
}

INTEREST_LABELS: dict[str, str] = {
    "housing": "주거",
    "medical": "의료",
    "education": "교육",
    "employment": "취업",
    "startup": "창업",
    "welfare": "복지",
}


@dataclass
class PolicyScoreBreakdown:
    condition_score: int
    intent_score: int
    benefit_score: int
    urgency_score: int
    final_score: int
    matched_interest_labels: list[str]


def _score_level(score: int) -> ScoreLevel:
    if score >= 85:
        return ScoreLevel.HIGH
    if score >= 65:
        return ScoreLevel.MID
    return ScoreLevel.LOW


def _apply_status(score: int, blocking_reasons: list[str]) -> ApplyStatus:
    if blocking_reasons or score < 50:
        return ApplyStatus.NOT_RECOMMENDED
    if score >= 85:
        return ApplyStatus.APPLICABLE_NOW
    return ApplyStatus.NEEDS_CHECK


def _benefit_label(amount: int | None) -> str | None:
    if not amount:
        return None
    if amount >= 10000 and amount % 10000 == 0:
        return f"최대 {amount // 10000:,}만원"
    return f"최대 {amount:,}원"


def _parse_policy_date(raw: str | None) -> date | None:
    if not raw:
        return None
    text = raw.strip()
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def is_policy_expired(application: PolicyApplication | None, *, today: date | None = None) -> bool:
    if not application:
        return False
    end_date = _parse_policy_date(application.business_period_end_date)
    if not end_date:
        return False
    return end_date < (today or datetime.utcnow().date())


def _normalize_title(title: str | None) -> str:
    if not title:
        return ""
    normalized = re.sub(r"\s+", " ", title).strip().lower()
    normalized = re.sub(r"\(.*?\)", "", normalized).strip()
    return normalized


def _dedupe_key(master: PolicyMaster) -> tuple[str, str]:
    return master.source, _normalize_title(master.title)


def _candidate_richness(
    master: PolicyMaster,
    benefit: PolicyBenefit | None,
    application: PolicyApplication | None,
) -> tuple[int, int, int, int]:
    return (
        1 if benefit and benefit.benefit_amount_value else 0,
        1 if application and application.application_url else 0,
        len(master.summary or ""),
        len(master.description or ""),
    )


def _clamp_score(value: float | int) -> int:
    return max(0, min(99, int(round(value))))


def _policy_text_blob(
    master: PolicyMaster,
    condition: PolicyCondition | None,
    benefit: PolicyBenefit | None,
    application: PolicyApplication | None,
) -> str:
    parts = [
        master.title or "",
        master.summary or "",
        master.description or "",
        master.category_large or "",
        master.category_medium or "",
        condition.additional_qualification_text if condition else "",
        condition.restricted_target_text if condition else "",
        benefit.benefit_detail_text if benefit else "",
        benefit.benefit_amount_raw_text if benefit else "",
        application.application_method_text if application else "",
        application.application_period_text if application else "",
    ]
    return " ".join(parts).lower()


def _normalize_interest_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        item = (tag or "").strip().lower()
        if not item or item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


def _intent_similarity_score(
    req: AnalyzeRequest | None,
    master: PolicyMaster,
    condition: PolicyCondition | None,
    benefit: PolicyBenefit | None,
    application: PolicyApplication | None,
) -> tuple[int, list[str]]:
    if req is None:
        return 55, []

    tags = _normalize_interest_tags(getattr(req, "interest_tags", []))
    if not tags:
        return 60, []

    text_blob = _policy_text_blob(master, condition, benefit, application)
    matched: list[str] = []
    for tag in tags:
        keywords = INTEREST_KEYWORDS.get(tag, {tag})
        if any(keyword in text_blob for keyword in keywords):
            matched.append(tag)

    ratio = len(matched) / max(1, len(tags))
    score = 30 + (ratio * 70)
    labels = [INTEREST_LABELS.get(tag, tag) for tag in matched][:2]
    return _clamp_score(score), labels


def _benefit_scale_score(benefit: PolicyBenefit | None) -> int:
    if not benefit:
        return 35

    amount = benefit.benefit_amount_value or 0
    if amount >= 2_000_000:
        score = 95
    elif amount >= 1_000_000:
        score = 88
    elif amount >= 500_000:
        score = 80
    elif amount >= 100_000:
        score = 68
    elif amount > 0:
        score = 55
    else:
        score = 35

    if benefit.support_scale_count:
        score += min(6, int(math.log10(max(10, benefit.support_scale_count))))
    if benefit.support_scale_limit_yn is False:
        score += 2

    return _clamp_score(score)


def _urgency_score(application: PolicyApplication | None, benefit: PolicyBenefit | None) -> int:
    if not application:
        return 45

    score = 50
    end_date = application.business_period_end_date
    if end_date:
        due = _parse_policy_date(end_date)
        if due:
            days_left = (due - datetime.utcnow().date()).days
            if days_left < 0:
                score = 5
            elif days_left <= 7:
                score = 95
            elif days_left <= 14:
                score = 90
            elif days_left <= 30:
                score = 80
            elif days_left <= 60:
                score = 68
            else:
                score = 56
        else:
            score = 55
    else:
        period_text = " ".join(
            [
                application.application_period_text or "",
                application.business_period_etc_text or "",
            ]
        ).lower()
        if any(keyword in period_text for keyword in ("마감", "선착순", "예산소진")):
            score = 88
        elif any(keyword in period_text for keyword in ("상시", "연중", "수시")):
            score = 40
        else:
            score = 55

    if benefit and benefit.first_come_first_served_yn:
        score = max(score, 90)

    return _clamp_score(score)


def evaluate_condition_gate(
    req: AnalyzeRequest,
    condition: PolicyCondition | None,
    application: PolicyApplication | None,
) -> tuple[int, list[str], list[str], list[str]]:
    return _condition_matches(req, condition, application)


def evaluate_policy_scores(
    *,
    req: AnalyzeRequest | None,
    master: PolicyMaster,
    condition: PolicyCondition | None,
    benefit: PolicyBenefit | None,
    application: PolicyApplication | None,
    condition_score: int,
) -> PolicyScoreBreakdown:
    intent_score, matched_interest_labels = _intent_similarity_score(req, master, condition, benefit, application)
    benefit_score = _benefit_scale_score(benefit)
    urgency_score = _urgency_score(application, benefit)
    final_score = _clamp_score(
        (condition_score * SCORE_WEIGHTS["condition"])
        + (intent_score * SCORE_WEIGHTS["intent"])
        + (benefit_score * SCORE_WEIGHTS["benefit"])
        + (urgency_score * SCORE_WEIGHTS["urgency"])
    )
    return PolicyScoreBreakdown(
        condition_score=condition_score,
        intent_score=intent_score,
        benefit_score=benefit_score,
        urgency_score=urgency_score,
        final_score=final_score,
        matched_interest_labels=matched_interest_labels,
    )


def score_level_from_score(score: int) -> ScoreLevel:
    return _score_level(score)


def apply_status_from_score(score: int, blocking_reasons: list[str]) -> ApplyStatus:
    return _apply_status(score, blocking_reasons)


def _condition_matches(
    req: AnalyzeRequest,
    condition: PolicyCondition | None,
    application: PolicyApplication | None,
) -> tuple[int, list[str], list[str], list[str]]:
    score = 70
    blocking_reasons: list[str] = []
    actions: list[str] = []
    tags: list[str] = []

    if not condition:
        return 60, blocking_reasons, actions, tags

    if condition.age_min is not None and req.age < condition.age_min:
        blocking_reasons.append(f"최소 연령 {condition.age_min}세 이상 조건이 필요합니다.")
    if condition.age_max is not None and req.age > condition.age_max:
        blocking_reasons.append(f"최대 연령 {condition.age_max}세 이하 조건이 필요합니다.")

    income_codes = set(condition.income_code.split(",")) if condition.income_code else set()
    if income_codes:
        req_level = INCOME_ORDER.get(req.income_band.value, 99)
        allowed = min(INCOME_ORDER.get(code, 99) for code in income_codes)
        if req_level > allowed:
            blocking_reasons.append("소득 구간 조건을 다시 확인해야 합니다.")
            actions.append("소득 기준과 공제 항목을 다시 확인해보세요.")
        else:
            score += 8

    employment_codes = set(condition.employment_codes_json or [])
    if employment_codes:
        if req.employment_status.value not in employment_codes:
            score -= 8
            actions.append("고용 상태 조건을 다시 확인해보세요.")
        else:
            score += 6

    household_codes = set(condition.household_type_codes_json or [])
    if household_codes:
        if req.household_type.value in household_codes:
            score += 6
            tags.append("가구 조건 충족")
        elif "SINGLE" in household_codes and req.household_type.value != "SINGLE":
            blocking_reasons.append("1인 가구 조건이 필요한 정책입니다.")

    if req.housing_status.value == "MONTHLY_RENT":
        score += 4
        tags.append("주거 조건 반영")

    if application and application.online_apply_yn:
        tags.append("온라인 신청")

    score = max(5, min(99, score))
    return score, blocking_reasons, actions, tags


def analyze_policies(db: Session, req: AnalyzeRequest) -> list[AnalyzedPolicy]:
    policy_rows = db.execute(
        select(PolicyMaster, PolicyCondition, PolicyBenefit, PolicyApplication)
        .outerjoin(PolicyCondition, PolicyCondition.policy_id == PolicyMaster.policy_id)
        .outerjoin(PolicyBenefit, PolicyBenefit.policy_id == PolicyMaster.policy_id)
        .outerjoin(PolicyApplication, PolicyApplication.policy_id == PolicyMaster.policy_id)
        .where(PolicyMaster.status_active_yn.is_(True))
        .order_by(PolicyMaster.policy_id)
    ).all()

    deduped: dict[tuple[str, str], tuple[AnalyzedPolicy, tuple[int, int, int, int]]] = {}

    for master, condition, benefit, application in policy_rows:
        if is_policy_expired(application):
            continue

        condition_score, blocking_reasons, actions, tags = _condition_matches(req, condition, application)
        scoring = evaluate_policy_scores(
            req=req,
            master=master,
            condition=condition,
            benefit=benefit,
            application=application,
            condition_score=condition_score,
        )
        score = scoring.final_score
        level = _score_level(score)
        apply_status = _apply_status(score, blocking_reasons)

        if apply_status == ApplyStatus.APPLICABLE_NOW:
            eligibility_summary = "현재 입력 조건 기준 신청 가능성이 높습니다."
        elif apply_status == ApplyStatus.NEEDS_CHECK:
            eligibility_summary = "일부 조건 확인이 필요하지만 신청 가능성이 있습니다."
        else:
            eligibility_summary = "현재 입력 조건 기준으로는 신청 가능성이 낮습니다."

        recommendation_actions = actions[:]
        if application and application.application_method_text:
            recommendation_actions.append("신청 방법과 접수 기관을 먼저 확인하세요.")
        if not recommendation_actions:
            recommendation_actions.append("현재 지역과 신청 요건을 다시 확인해보세요.")

        badge_items = [tag for tag in tags]
        if scoring.matched_interest_labels:
            badge_items.append(f"관심사:{'/'.join(scoring.matched_interest_labels)}")
        if scoring.urgency_score >= 85:
            badge_items.append("마감 임박")
        elif scoring.benefit_score >= 80:
            badge_items.append("고수혜")
        badge_items.append(master.source.upper())
        if benefit and benefit.benefit_amount_value:
            benefit_label = _benefit_label(benefit.benefit_amount_value)
            if benefit_label:
                badge_items.append(benefit_label)
        badge_items = [item for item in badge_items if item][:3]

        candidate = AnalyzedPolicy(
            policy_id=master.policy_id,
            title=master.title,
            description=master.summary or master.description,
            match_score=score,
            score_level=level,
            apply_status=apply_status,
            source_url=((application.application_url if application else None) or master.application_url or master.source_url),
            eligibility_summary=eligibility_summary,
            blocking_reasons=blocking_reasons,
            recommended_actions=recommendation_actions[:4],
            benefit_amount=benefit.benefit_amount_value if benefit else None,
            benefit_amount_label=_benefit_label(benefit.benefit_amount_value if benefit else None),
            benefit_summary=benefit.benefit_period_label if benefit else None,
            badge_items=badge_items,
        )

        dedupe_key = _dedupe_key(master)
        richness = _candidate_richness(master, benefit, application)
        current = deduped.get(dedupe_key)

        if current is None:
            deduped[dedupe_key] = (candidate, richness)
            continue

        current_policy, current_richness = current
        candidate_rank = (
            candidate.apply_status == ApplyStatus.APPLICABLE_NOW,
            candidate.apply_status != ApplyStatus.NOT_RECOMMENDED,
            candidate.match_score,
            richness,
        )
        current_rank = (
            current_policy.apply_status == ApplyStatus.APPLICABLE_NOW,
            current_policy.apply_status != ApplyStatus.NOT_RECOMMENDED,
            current_policy.match_score,
            current_richness,
        )
        if candidate_rank > current_rank:
            deduped[dedupe_key] = (candidate, richness)

    results = [item[0] for item in deduped.values()]
    results.sort(
        key=lambda item: (
            item.apply_status != ApplyStatus.APPLICABLE_NOW,
            item.apply_status == ApplyStatus.NOT_RECOMMENDED,
            -item.match_score,
            item.title,
        )
    )
    return results


def persist_analysis_state(db: Session, req: AnalyzeRequest, analyzed: list[AnalyzedPolicy]) -> None:
    db.merge(
        AnalysisProfileState(
            id=1,
            age=req.age,
            region_code=req.region_code,
            region_name=req.region_name,
            income_band=req.income_band.value,
            household_type=req.household_type.value,
            employment_status=req.employment_status.value,
            housing_status=req.housing_status.value,
            updated_at=datetime.utcnow(),
        )
    )
    db.execute(delete(AnalysisResultState))

    for index, item in enumerate(analyzed, start=1):
        db.merge(
            AnalysisResultState(
                policy_id=item.policy_id,
                title=item.title,
                description=item.description,
                match_score=item.match_score,
                score_level=item.score_level.value,
                apply_status=item.apply_status.value,
                eligibility_summary=item.eligibility_summary,
                blocking_reasons_json=item.blocking_reasons,
                recommended_actions_json=item.recommended_actions,
                benefit_amount=item.benefit_amount,
                benefit_amount_label=item.benefit_amount_label,
                benefit_summary=item.benefit_summary,
                badge_items_json=item.badge_items,
                sort_order=index,
                updated_at=datetime.utcnow(),
            )
        )
    db.commit()


def get_profile_tags(req: AnalyzeRequest) -> list[str]:
    tags: list[str] = []
    if 19 <= req.age <= 34:
        tags.append("청년")
    if req.household_type.value == "SINGLE":
        tags.append("1인 가구")
    if req.employment_status.value == "UNEMPLOYED":
        tags.append("구직중")
    if req.housing_status.value == "MONTHLY_RENT":
        tags.append("월세")
    if req.interest_tags:
        tags.extend([tag.strip() for tag in req.interest_tags if tag and tag.strip()])
    return tags[:5]


def get_analysis_results(db: Session) -> list[AnalysisResultState]:
    return db.execute(select(AnalysisResultState).order_by(AnalysisResultState.sort_order)).scalars().all()


def get_policy_documents(db: Session, policy_id: str) -> list[PolicyDocument]:
    return (
        db.execute(select(PolicyDocument).where(PolicyDocument.policy_id == policy_id).order_by(PolicyDocument.id))
        .scalars()
        .all()
    )
