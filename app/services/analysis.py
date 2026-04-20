from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
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
from app.services.personalization import evaluate_policy


@dataclass
class AnalyzedPolicy:
    policy_id: str
    title: str
    description: str | None
    match_score: int
    score_level: ScoreLevel
    apply_status: ApplyStatus
    eligibility_summary: str
    blocking_reasons: list[str]
    recommended_actions: list[str]
    benefit_amount: int | None
    benefit_amount_label: str | None
    benefit_summary: str | None
    badge_items: list[str]
    recommendation_context: dict[str, object] | None = None


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
REGION_PATTERN = re.compile(r"[가-힣]{2,}(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구)")
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
MONTHLY_RENT_KEYWORDS = ("월세", "월 임차", "월 임대료", "임차료")
JEONSE_KEYWORDS = ("전세", "전월세", "보증금")
EMPLOYED_KEYWORDS = ("재직", "근로자", "근로소득자", "직장인")
UNEMPLOYED_KEYWORDS = ("미취업", "구직", "취업준비", "무소득")


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


def _extract_region_tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    tokens: set[str] = set()
    for raw_label, normalized in REGION_ALIASES.items():
        if raw_label in text:
            tokens.add(normalized)
    for match in REGION_PATTERN.findall(text):
        alias = REGION_ALIASES.get(match)
        if alias:
            tokens.add(alias)
            continue
        if match.endswith(("구", "군")):
            tokens.add(match)
        elif match.endswith("시"):
            tokens.add(match.removesuffix("시"))
            tokens.add(match)
        else:
            tokens.add(match)
    return tokens


def _keyword_bonus(req: AnalyzeRequest, text: str) -> int:
    bonus = 0
    if 19 <= req.age <= 39 and "청년" in text:
        bonus += 6
    if req.household_type.value == "SINGLE" and "1인 가구" in text:
        bonus += 5
    if req.housing_status.value == "MONTHLY_RENT" and any(keyword in text for keyword in MONTHLY_RENT_KEYWORDS):
        bonus += 7
    if req.housing_status.value == "JEONSE" and any(keyword in text for keyword in JEONSE_KEYWORDS):
        bonus += 7
    if req.employment_status.value == "UNEMPLOYED" and any(keyword in text for keyword in UNEMPLOYED_KEYWORDS):
        bonus += 5
    if req.employment_status.value == "EMPLOYED" and any(keyword in text for keyword in EMPLOYED_KEYWORDS):
        bonus += 4
    return bonus


def _condition_matches(
    req: AnalyzeRequest,
    master: PolicyMaster,
    condition: PolicyCondition | None,
    application: PolicyApplication | None,
) -> tuple[int, list[str], list[str], list[str]]:
    score = 52
    blocking_reasons: list[str] = []
    actions: list[str] = []
    tags: list[str] = []

    policy_text = " ".join(
        value
        for value in (
            master.title,
            master.summary,
            master.description,
            condition.additional_qualification_text if condition else None,
            condition.restricted_target_text if condition else None,
        )
        if value
    )

    if not condition:
        score += _keyword_bonus(req, policy_text)
        return max(35, min(99, score)), blocking_reasons, actions, tags

    user_regions = _extract_region_tokens(req.region_name)
    policy_regions = set(condition.region_codes_json or [])
    if policy_regions:
        if "전국" in policy_regions:
            score += 2
        elif user_regions & policy_regions:
            score += 14 if any(token.endswith(("구", "군")) for token in user_regions & policy_regions) else 10
            tags.append("지역 일치")
        else:
            score -= 18
            blocking_reasons.append("거주 지역 조건을 다시 확인해야 합니다.")
            actions.append("신청 지역과 주민등록지를 다시 확인해보세요.")

    if condition.age_min is not None and req.age < condition.age_min:
        blocking_reasons.append(f"최소 연령 {condition.age_min}세 이상 조건이 필요합니다.")
    if condition.age_max is not None and req.age > condition.age_max:
        blocking_reasons.append(f"최대 연령 {condition.age_max}세 이하 조건이 필요합니다.")
    if (condition.age_min is not None or condition.age_max is not None) and not blocking_reasons:
        score += 8
        tags.append("연령 일치")

    income_codes = set(condition.income_code.split(",")) if condition.income_code else set()
    if income_codes:
        req_level = INCOME_ORDER.get(req.income_band.value, 99)
        allowed_max = max(INCOME_ORDER.get(code, 99) for code in income_codes)
        if req_level > allowed_max:
            blocking_reasons.append("소득 구간 조건을 다시 확인해야 합니다.")
            actions.append("건강보험료나 소득 기준 구간을 다시 확인해보세요.")
        else:
            score += 8
            tags.append("소득 조건 반영")

    employment_codes = set(condition.employment_codes_json or [])
    if employment_codes:
        if req.employment_status.value in employment_codes:
            score += 7
            tags.append("고용 상태 일치")
        else:
            score -= 10
            actions.append("고용 상태 조건을 다시 확인해보세요.")

    household_codes = set(condition.household_type_codes_json or [])
    if household_codes:
        if req.household_type.value in household_codes:
            score += 7
            tags.append("가구 조건 일치")
        elif "MULTI_PERSON" in household_codes and req.household_type.value == "TWO_PERSON":
            score += 4
            tags.append("가구 조건 근접")
        else:
            score -= 12
            if "SINGLE" in household_codes:
                blocking_reasons.append("1인 가구 대상 정책일 수 있습니다.")
            else:
                actions.append("가구 형태 조건을 다시 확인해보세요.")

    housing_codes = set(condition.housing_codes_json or [])
    if housing_codes:
        if req.housing_status.value in housing_codes:
            score += 9
            tags.append("주거 조건 일치")
        else:
            score -= 12
            if "MONTHLY_RENT" in housing_codes:
                blocking_reasons.append("월세 거주자 대상 정책일 수 있습니다.")
            elif "JEONSE" in housing_codes:
                blocking_reasons.append("전세 거주자 대상 정책일 수 있습니다.")
            else:
                actions.append("주거 형태 조건을 다시 확인해보세요.")

    score += _keyword_bonus(req, policy_text)

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
        personalized = evaluate_policy(
            req=req,
            master=master,
            condition=condition,
            benefit=benefit,
            application=application,
        )

        badge_items = list(personalized.badge_items)
        badge_items.append(master.source.upper())
        benefit_label = _benefit_label(benefit.benefit_amount_value if benefit else None)
        if benefit_label:
            badge_items.append(benefit_label)
        badge_items = [item for item in badge_items if item][:3]

        candidate = AnalyzedPolicy(
            policy_id=master.policy_id,
            title=master.title,
            description=master.summary or master.description,
            match_score=personalized.match_score,
            score_level=personalized.score_level,
            apply_status=personalized.apply_status,
            eligibility_summary=personalized.eligibility_summary,
            blocking_reasons=personalized.blocking_reasons,
            recommended_actions=personalized.recommended_actions[:4],
            benefit_amount=benefit.benefit_amount_value if benefit else None,
            benefit_amount_label=benefit_label,
            benefit_summary=benefit.benefit_period_label if benefit else None,
            badge_items=badge_items,
            recommendation_context=personalized.recommendation_context,
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
    return tags[:3]


def get_analysis_results(db: Session) -> list[AnalysisResultState]:
    return db.execute(select(AnalysisResultState).order_by(AnalysisResultState.sort_order)).scalars().all()


def get_policy_documents(db: Session, policy_id: str) -> list[PolicyDocument]:
    return (
        db.execute(select(PolicyDocument).where(PolicyDocument.policy_id == policy_id).order_by(PolicyDocument.id))
        .scalars()
        .all()
    )
