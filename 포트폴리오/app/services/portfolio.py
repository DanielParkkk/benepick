from __future__ import annotations

from dataclasses import dataclass
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisProfileState,
    AnalysisResultState,
    PolicyApplication,
    PolicyBenefit,
    PolicyCondition,
    PolicyMaster,
    PolicyTag,
)
from app.schemas.common import ApplyStatus, PolicyTagItem
from app.schemas.portfolio import (
    PortfolioCategorySummary,
    PortfolioData,
    PortfolioExcludedItem,
    PortfolioItem,
    PortfolioPipelineStep,
)
from app.services.ai_modules.benefit_extractor import extract_benefit_estimate, format_krw
from app.services.ai_modules.policy_intelligence import PolicyIntelligence, build_policy_intelligence


PORTFOLIO_LIMIT = 12
DISPLAY_LIMIT = 6
PIPELINE_VERSION = "ANNUAL_BENEFIT_PORTFOLIO_V1"


@dataclass
class AnnualEstimate:
    amount: int
    label: str
    basis: str
    confidence: str
    calculation_type: str
    is_cash_equivalent: bool
    raw_estimate: dict[str, object]


@dataclass
class PortfolioCandidate:
    row: AnalysisResultState
    master: PolicyMaster | None
    benefit: PolicyBenefit | None
    application: PolicyApplication | None
    apply_status: ApplyStatus
    annual: AnnualEstimate
    intelligence: PolicyIntelligence
    tags: list[PolicyTagItem]


@dataclass
class ExcludedCandidate:
    candidate: PortfolioCandidate
    reason: str


def _pipeline_steps() -> list[PortfolioPipelineStep]:
    return [
        PortfolioPipelineStep(
            step_order=1,
            step_code="PROFILE_INPUT",
            step_name="사용자 조건 입력",
            input_data="나이, 지역, 소득 구간, 가구 유형, 고용 상태, 주거 상태",
            process="수급 가능성 분석에 사용할 사용자 프로필을 저장합니다.",
            output_data="analysis_profile_state",
            guardrail="사용자 입력값만 사용하고 임의 조건을 추가하지 않습니다.",
        ),
        PortfolioPipelineStep(
            step_order=2,
            step_code="POLICY_CANDIDATE_SCORE",
            step_name="정책 후보 점수화",
            input_data="RAG 검색 결과, 정책 DB, 사용자 조건",
            process="정책 조건과 사용자 조건을 비교해 수급 가능성 점수와 신청 상태를 계산합니다.",
            output_data="analysis_result_state",
            guardrail="APPLICABLE_NOW, NEEDS_CHECK, NOT_RECOMMENDED 상태를 분리합니다.",
        ),
        PortfolioPipelineStep(
            step_order=3,
            step_code="ANNUAL_AMOUNT_NORMALIZE",
            step_name="연간 수혜액 정규화",
            input_data="정책 지원 내용, 금액 원문, 지원 기간",
            process="월 지급, 연 지급, 회차 지원, 일시 지원, 대출 한도를 연간 기준으로 변환합니다.",
            output_data="annual_amount, annual_amount_label, calculation_type",
            guardrail="대출/융자는 현금성 수혜액이 아니므로 총액 합산에서 제외합니다.",
        ),
        PortfolioPipelineStep(
            step_order=4,
            step_code="EVIDENCE_GROUNDED_REASONING",
            step_name="원문 근거 기반 정책 추론",
            input_data="정책 원문, 조건 필드, 신청 필드, 금액 구조화 결과",
            process="자격 근거, 지원 근거, 신청 근거를 추출하고 사용자 조건과 다시 대조합니다.",
            output_data="fit_reasons, risk_flags, evidence_snippets, grounded_score",
            guardrail="정책 원문과 DB 필드 범위 안에서만 근거를 생성합니다.",
        ),
        PortfolioPipelineStep(
            step_order=5,
            step_code="CONFLICT_FILTER",
            step_name="중복 불가/제외 필터링",
            input_data="정책 카테고리, 중복 그룹, 신청 상태, 현금성 여부",
            process="중복 수혜 가능성이 낮은 동일 유형 정책과 신청 가능성이 낮은 정책을 제외합니다.",
            output_data="selected_candidates, excluded_items",
            guardrail="중복 여부가 확실한 그룹만 자동 제외하고, 불확실한 항목은 확인 필요로 남깁니다.",
        ),
        PortfolioPipelineStep(
            step_order=6,
            step_code="GREEDY_PORTFOLIO_SELECT",
            step_name="연간 수혜액 최대 조합 선택",
            input_data="신청 가능 후보, 연간 수혜액, 수급 가능성 점수, 근거 점수",
            process="연간 수혜액과 신청 가능성을 함께 고려해 탐욕 탐색 방식으로 조합을 선택합니다.",
            output_data="portfolio_items, total_estimated_benefit_label",
            guardrail="총액은 현금성/실질 수혜로 판단한 금액만 합산합니다.",
        ),
    ]


def _format_krw(amount: int | None) -> str:
    return format_krw(amount)


def _safe_apply_status(value: str | ApplyStatus | None) -> ApplyStatus:
    try:
        return value if isinstance(value, ApplyStatus) else ApplyStatus(value)
    except ValueError:
        return ApplyStatus.NEEDS_CHECK


def _won_from_match(match: re.Match[str]) -> int:
    number = float(match.group("number").replace(",", ""))
    unit = match.group("unit").replace(" ", "")
    if unit in {"억원", "억"}:
        return int(number * 100_000_000)
    if unit == "만원":
        return int(number * 10_000)
    return int(number)


def _find_amount(text: str, prefix_pattern: str) -> int | None:
    pattern = rf"{prefix_pattern}\s*(?P<number>[0-9][0-9,]*(?:\.[0-9]+)?)\s*(?P<unit>억\s*원|억원|억|만\s*원|만원|원)"
    match = re.search(pattern, text)
    if not match:
        return None
    return _won_from_match(match)


def _extract_months(text: str) -> int | None:
    month_match = re.search(r"(?P<months>[1-9][0-9]?)\s*개?\s*월", text)
    if month_match:
        return min(12, int(month_match.group("months")))
    return None


def _text_blob(
    *,
    title: str | None,
    amount_label: str | None,
    period_label: str | None,
    benefit: PolicyBenefit | None,
    master: PolicyMaster | None,
) -> str:
    return re.sub(
        r"\s+",
        " ",
        " ".join(
            [
                title or "",
                amount_label or "",
                period_label or "",
                (benefit.benefit_detail_text if benefit else "") or "",
                (benefit.benefit_amount_raw_text if benefit else "") or "",
                (benefit.benefit_period_label if benefit else "") or "",
                (master.summary if master else "") or "",
                (master.description if master else "") or "",
            ]
        ),
    ).strip()


def _estimate_youth_leap_account(text: str) -> AnnualEstimate | None:
    if "도약계좌" not in text:
        return None
    monthly_saving = _find_amount(text, r"(?:월|매월)\s*(?:최대|약)?")
    contribution_rate = re.search(r"(?P<rate>[1-9][0-9]?)\s*%", text)
    if monthly_saving and contribution_rate:
        annual = int(monthly_saving * 12 * (int(contribution_rate.group("rate")) / 100))
        annual = max(annual, 700_000) if annual else 700_000
    else:
        annual = 700_000
    return AnnualEstimate(
        annual,
        f"연 {_format_krw(annual)}",
        "만기 총액이 아닌 정부기여금 성격의 연간 수혜 추정액 기준",
        "MEDIUM",
        "ASSET_CONTRIBUTION_ESTIMATE",
        True,
        {
            "annual_amount": annual,
            "annual_amount_label": f"연 {_format_krw(annual)}",
            "calculation_basis": "만기 총액이 아닌 정부기여금 성격의 연간 수혜 추정액 기준",
            "calculation_type": "ASSET_CONTRIBUTION_ESTIMATE",
            "confidence": "MEDIUM",
            "is_cash_equivalent": True,
        },
    )


def _estimate_annual_amount(
    amount: int | None,
    *,
    title: str | None,
    amount_label: str | None,
    period_label: str | None,
    benefit: PolicyBenefit | None,
    master: PolicyMaster | None,
) -> AnnualEstimate:
    text = _text_blob(
        title=title,
        amount_label=amount_label,
        period_label=period_label,
        benefit=benefit,
        master=master,
    )
    estimate = extract_benefit_estimate(text, normalized_amount=amount)
    return AnnualEstimate(
        amount=int(estimate.get("annual_amount") or 0),
        label=str(estimate.get("annual_amount_label") or "공식 공고 확인"),
        basis=str(estimate.get("calculation_basis") or "금액 정보 확인 필요"),
        confidence=str(estimate.get("confidence") or "LOW").upper(),
        calculation_type=str(estimate.get("calculation_type") or "UNKNOWN"),
        is_cash_equivalent=bool(estimate.get("is_cash_equivalent")),
        raw_estimate=estimate,
    )


def _category_for(master: PolicyMaster | None, title: str) -> str:
    text = " ".join(
        [
            title,
            (master.category_large if master else "") or "",
            (master.category_medium if master else "") or "",
            (master.summary if master else "") or "",
        ]
    )
    if any(keyword in text for keyword in ("월세", "주거", "주택", "임대", "전세")):
        return "주거"
    if any(keyword in text for keyword in ("취업", "고용", "일자리", "훈련", "배움", "교육")):
        return "취업/교육"
    if any(keyword in text for keyword in ("건강", "의료", "상담", "심리", "마음")):
        return "건강"
    if any(keyword in text for keyword in ("계좌", "저축", "금융", "자산", "적금")):
        return "자산형성"
    if any(keyword in text for keyword in ("창업", "사업", "스타트업")):
        return "창업"
    if any(keyword in text for keyword in ("생활", "생계", "돌봄", "가족")):
        return "생활지원"
    return "기타"


def _normalize_title(title: str) -> str:
    return re.sub(r"[^0-9a-zA-Z가-힣]+", "", title).lower()


def _conflict_group_for(master: PolicyMaster | None, title: str, category: str) -> str:
    text = " ".join(
        [
            title,
            (master.category_large if master else "") or "",
            (master.category_medium if master else "") or "",
            (master.summary if master else "") or "",
        ]
    )
    if "월세" in text:
        return "NON_STACKABLE:MONTHLY_RENT"
    if any(keyword in text for keyword in ("내일배움카드", "훈련비", "직업훈련")):
        return "NON_STACKABLE:JOB_TRAINING"
    if any(keyword in text for keyword in ("마음건강", "심리상담", "상담")):
        return "NON_STACKABLE:MENTAL_HEALTH"
    if "도약계좌" in text:
        return "NON_STACKABLE:ASSET_ACCOUNT"
    if any(keyword in text for keyword in ("창업사관학교", "창업지원금")):
        return "NON_STACKABLE:STARTUP_GRANT"
    return f"STACKABLE:{category}:{_normalize_title(title)[:30]}"


def _load_policy_tags(db: Session, policy_id: str, limit: int = 6) -> list[PolicyTagItem]:
    rows = (
        db.execute(select(PolicyTag).where(PolicyTag.policy_id == policy_id).order_by(PolicyTag.id).limit(limit))
        .scalars()
        .all()
    )
    return [PolicyTagItem(tag_type=row.tag_type, tag_code=row.tag_code, tag_label=row.tag_label) for row in rows]


def _status_factor(status: ApplyStatus) -> float:
    if status == ApplyStatus.APPLICABLE_NOW:
        return 1.0
    if status == ApplyStatus.NEEDS_CHECK:
        return 0.82
    return 0.0


def _greedy_value(candidate: PortfolioCandidate) -> float:
    evidence_bonus = candidate.intelligence.grounded_score * 5_000
    return (candidate.annual.amount * _status_factor(candidate.apply_status)) + (candidate.row.match_score * 10_000) + evidence_bonus


def _candidate_sort_key(candidate: PortfolioCandidate) -> tuple[float, int, int]:
    return (-_greedy_value(candidate), -candidate.annual.amount, candidate.row.sort_order)


def _select_candidates(candidates: list[PortfolioCandidate]) -> tuple[list[PortfolioCandidate], list[ExcludedCandidate]]:
    selected: list[PortfolioCandidate] = []
    excluded: list[ExcludedCandidate] = []
    used_conflict_groups: set[str] = set()

    usable = [item for item in candidates if item.apply_status != ApplyStatus.NOT_RECOMMENDED]
    for candidate in sorted(usable, key=_candidate_sort_key):
        if len(selected) >= PORTFOLIO_LIMIT:
            excluded.append(ExcludedCandidate(candidate, "포트폴리오 표시 한도 초과"))
            continue

        conflict_group = candidate.intelligence.conflict_group
        if conflict_group.startswith("NON_STACKABLE:") and conflict_group in used_conflict_groups:
            excluded.append(
                ExcludedCandidate(
                    candidate,
                    candidate.intelligence.conflict_reason or "중복 수혜 가능성이 낮은 동일 유형 정책 자동 제외",
                )
            )
            continue

        selected.append(candidate)
        if conflict_group.startswith("NON_STACKABLE:"):
            used_conflict_groups.add(conflict_group)

    for candidate in candidates:
        if candidate.apply_status == ApplyStatus.NOT_RECOMMENDED:
            excluded.append(
                ExcludedCandidate(
                    candidate,
                    candidate.intelligence.exclusion_reason or "현재 입력 조건 기준 신청 가능성이 낮아 제외",
                )
            )

    return selected, excluded


def _selected_reason(candidate: PortfolioCandidate) -> str:
    if candidate.intelligence.decision_summary:
        return candidate.intelligence.decision_summary
    if candidate.apply_status == ApplyStatus.APPLICABLE_NOW:
        return f"신청 가능성이 높고 연간 환산 수혜액이 {_format_krw(candidate.annual.amount)}로 추정됩니다."
    return "조건 확인 후 신청 가능성이 있어 포트폴리오 후보로 유지했습니다."


def _build_category_breakdown(items: list[PortfolioItem]) -> list[PortfolioCategorySummary]:
    totals: dict[str, tuple[int, int]] = {}
    for item in items:
        category = item.category or "기타"
        count, total = totals.get(category, (0, 0))
        totals[category] = (count + 1, total + item.annual_amount)

    return [
        PortfolioCategorySummary(
            category=category,
            count=count,
            annual_amount=amount,
            annual_amount_label=_format_krw(amount),
        )
        for category, (count, amount) in sorted(totals.items(), key=lambda pair: (-pair[1][1], pair[0]))
    ]


def _application_url(candidate: PortfolioCandidate) -> str | None:
    if candidate.application and candidate.application.application_url:
        return candidate.application.application_url
    if candidate.master and candidate.master.application_url:
        return candidate.master.application_url
    return None


def build_portfolio_data(db: Session, results: list[AnalysisResultState]) -> PortfolioData:
    candidates: list[PortfolioCandidate] = []
    profile = db.execute(select(AnalysisProfileState).where(AnalysisProfileState.id == 1)).scalar_one_or_none()
    for row in results:
        master = db.execute(select(PolicyMaster).where(PolicyMaster.policy_id == row.policy_id)).scalar_one_or_none()
        condition = db.execute(select(PolicyCondition).where(PolicyCondition.policy_id == row.policy_id)).scalar_one_or_none()
        benefit = db.execute(select(PolicyBenefit).where(PolicyBenefit.policy_id == row.policy_id)).scalar_one_or_none()
        application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == row.policy_id)).scalar_one_or_none()
        annual = _estimate_annual_amount(
            row.benefit_amount,
            title=row.title,
            amount_label=row.benefit_amount_label,
            period_label=row.benefit_summary,
            benefit=benefit,
            master=master,
        )
        intelligence = build_policy_intelligence(
            profile=profile,
            row=row,
            master=master,
            condition=condition,
            benefit=benefit,
            application=application,
            benefit_estimate=annual.raw_estimate,
        )
        candidates.append(
            PortfolioCandidate(
                row=row,
                master=master,
                benefit=benefit,
                application=application,
                apply_status=_safe_apply_status(row.apply_status),
                annual=annual,
                intelligence=intelligence,
                tags=_load_policy_tags(db, row.policy_id),
            )
        )

    selected, excluded = _select_candidates(candidates)
    selected_for_display = selected[:DISPLAY_LIMIT]

    items: list[PortfolioItem] = []
    for index, candidate in enumerate(selected_for_display, start=1):
        overlap_note = None
        if candidate.intelligence.conflict_group.startswith("NON_STACKABLE:"):
            overlap_note = candidate.intelligence.conflict_reason
        if candidate.annual.is_cash_equivalent is False:
            overlap_note = candidate.annual.basis

        items.append(
            PortfolioItem(
                policy_id=candidate.row.policy_id,
                title=candidate.row.title,
                amount=candidate.row.benefit_amount,
                amount_label=candidate.annual.label,
                period_label=candidate.annual.basis,
                annual_amount=candidate.annual.amount,
                annual_amount_label=candidate.annual.label,
                amount_basis=candidate.annual.basis,
                calculation_type=candidate.annual.calculation_type,
                is_cash_equivalent=candidate.annual.is_cash_equivalent,
                apply_status=candidate.apply_status,
                source=candidate.master.source if candidate.master else None,
                managing_agency=candidate.master.managing_agency if candidate.master else None,
                benefit_summary=candidate.row.benefit_summary,
                application_url=_application_url(candidate),
                category=candidate.intelligence.category,
                selected_reason=_selected_reason(candidate),
                overlap_note=overlap_note,
                confidence=candidate.annual.confidence,
                decision_summary=candidate.intelligence.decision_summary,
                condition_tags=candidate.intelligence.condition_tags,
                fit_reasons=candidate.intelligence.fit_reasons,
                risk_flags=candidate.intelligence.risk_flags,
                required_actions=candidate.intelligence.required_actions,
                evidence_snippets=candidate.intelligence.evidence_snippets,
                guide_tags=candidate.intelligence.guide_tags,
                evidence_quality=candidate.intelligence.evidence_quality,
                grounded_score=candidate.intelligence.grounded_score,
                tags=candidate.tags,
                sort_order=index,
            )
        )

    total = sum(item.annual_amount for item in items)
    excluded_items = [
        PortfolioExcludedItem(
            policy_id=item.candidate.row.policy_id,
            title=item.candidate.row.title,
            reason=item.reason,
            conflict_group=item.candidate.intelligence.conflict_group,
            annual_amount_label=item.candidate.annual.label,
            risk_flags=item.candidate.intelligence.risk_flags,
            evidence_snippets=item.candidate.intelligence.evidence_snippets[:2],
        )
        for item in excluded[:20]
    ]

    return PortfolioData(
        total_estimated_benefit_amount=total,
        total_estimated_benefit_label=_format_krw(total),
        selected_policy_count=len(items),
        applicable_now_count=sum(1 for item in items if item.apply_status == ApplyStatus.APPLICABLE_NOW),
        needs_check_count=sum(1 for item in items if item.apply_status == ApplyStatus.NEEDS_CHECK),
        excluded_policy_count=len(excluded),
        calculation_basis_note=(
            "탐욕 탐색으로 연간 환산 수혜액이 큰 정책부터 선택하고, "
            "월 지급형은 최대 12개월로 환산하며, 중복 불가 유형과 대출/융자 한도는 총액에서 제외했습니다."
        ),
        reasoning_summary=(
            "정책 원문에서 자격·지원금·신청 근거 문장을 추출한 뒤 사용자 입력 조건과 대조하고, "
            "중복 불가 그룹과 현금성 수혜 여부를 반영해 포트폴리오 조합을 산정했습니다."
        ),
        pipeline_version=PIPELINE_VERSION,
        pipeline_steps=_pipeline_steps(),
        category_breakdown=_build_category_breakdown(items),
        portfolio_items=items,
        excluded_items=excluded_items,
    )
