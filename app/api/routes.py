from __future__ import annotations

from dataclasses import replace

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import AnalysisProfileState, AnalysisResultState, PolicyApplication, PolicyBenefit, PolicyCondition, PolicyLaw, PolicyMaster, PolicyRelatedLink, PolicyTag
from app.schemas.application import ApplicationPrepData, ChecklistPatchRequest, DocumentPatchRequest
from app.schemas.common import (
    ApplyStatus,
    ApplicationStep,
    ChecklistItem,
    DocumentStatus,
    PolicyLawItem,
    PolicyLinkItem,
    PolicySummary,
    PolicyTagItem,
    RequiredDocumentItem,
    ScoreLevel,
    SuccessResponse,
    UnmatchedPolicyItem,
)
from app.schemas.community import (
    CommunityCreateRequest,
    CommunityLikeData,
    CommunityListData,
    CommunityPostItem,
    CommunityStatsData,
)
from app.schemas.detail import PolicyDetailData
from app.schemas.eligibility import AnalyzeRequest, AnalyzeResponseData, ProfileSummary
from app.schemas.portfolio import PortfolioData, PortfolioItem
from app.schemas.search import PolicySearchData
from app.services.analysis import AnalyzedPolicy, analyze_policies, get_analysis_results, get_policy_documents, get_profile_tags, persist_analysis_state
from app.services.personalization import evaluate_policy
from app.services.application import ensure_application_state, get_application_step, update_checklist_state, update_document_state
from app.services.community import create_post, get_hot_posts, get_post, get_stats, like_post, list_posts, unlike_post
from app.services.rag import search_rag

try:
    from app.services.detail_enrichment_service import detail_enrichment_service
except Exception:  # pragma: no cover - optional AI module
    detail_enrichment_service = None


router = APIRouter(prefix="/api/v1")


def load_policy_links(db: Session, policy_id: str) -> list[PolicyLinkItem]:
    rows = db.execute(
        select(PolicyRelatedLink)
        .where(PolicyRelatedLink.policy_id == policy_id)
        .order_by(PolicyRelatedLink.sort_order, PolicyRelatedLink.id)
    ).scalars().all()
    return [
        PolicyLinkItem(
            link_type=row.link_type,
            link_name=row.link_name,
            link_url=row.link_url,
            sort_order=row.sort_order,
        )
        for row in rows
    ]


def load_policy_laws(db: Session, policy_id: str) -> list[PolicyLawItem]:
    rows = db.execute(select(PolicyLaw).where(PolicyLaw.policy_id == policy_id).order_by(PolicyLaw.id)).scalars().all()
    return [PolicyLawItem(law_name=row.law_name, law_type=row.law_type, source=row.source) for row in rows]


def load_policy_tags(db: Session, policy_id: str, *, limit: int | None = None) -> list[PolicyTagItem]:
    stmt = select(PolicyTag).where(PolicyTag.policy_id == policy_id).order_by(PolicyTag.tag_type, PolicyTag.id)
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = db.execute(stmt).scalars().all()
    return [PolicyTagItem(tag_type=row.tag_type, tag_code=row.tag_code, tag_label=row.tag_label) for row in rows]


def build_policy_summary(
    *,
    policy_id: str,
    title: str,
    description: str | None,
    match_score: int,
    apply_status: ApplyStatus,
    benefit_amount: int | None,
    benefit_amount_label: str | None,
    benefit_summary: str | None,
    badge_items: list[str],
    recommendation_context: dict[str, object] | None,
    sort_order: int,
) -> PolicySummary:
    if match_score >= 85:
        score_level = ScoreLevel.HIGH
    elif match_score >= 65:
        score_level = ScoreLevel.MID
    else:
        score_level = ScoreLevel.LOW

    return PolicySummary(
        policy_id=policy_id,
        title=title,
        description=description,
        match_score=match_score,
        score_level=score_level,
        apply_status=apply_status,
        benefit_amount=benefit_amount,
        benefit_amount_label=benefit_amount_label,
        benefit_summary=benefit_summary,
        badge_items=badge_items,
        recommendation_context=recommendation_context,
        sort_order=sort_order,
    )


def infer_source_from_reference(reference_id: str) -> str | None:
    if "__" in reference_id:
        return reference_id.split("__", 1)[0]
    normalized = reference_id.upper()
    if normalized.startswith("WLF"):
        return "bokjiro"
    if reference_id.isdigit():
        return "gov24"
    return None


def build_summary_from_master(
    db: Session,
    master: PolicyMaster,
    *,
    index: int,
    fallback_score: int = 60,
    use_analysis_state: bool = False,
) -> PolicySummary:
    benefit = db.execute(select(PolicyBenefit).where(PolicyBenefit.policy_id == master.policy_id)).scalar_one_or_none()
    application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == master.policy_id)).scalar_one_or_none()
    analysis_result = None
    if use_analysis_state:
        analysis_result = db.execute(select(AnalysisResultState).where(AnalysisResultState.policy_id == master.policy_id)).scalar_one_or_none()

    badge_items = [master.source.upper()]
    if master.managing_agency:
        badge_items.append(master.managing_agency)
    if application and application.online_apply_yn:
        badge_items.append("온라인 신청")
    if benefit and benefit.benefit_amount_value:
        if benefit.benefit_amount_value >= 10000:
            badge_items.append(f"최대 {benefit.benefit_amount_value // 10000:,}만원")
        else:
            badge_items.append(f"최대 {benefit.benefit_amount_value:,}원")

    return build_policy_summary(
        policy_id=master.policy_id,
        title=master.title,
        description=master.summary or master.description,
        match_score=analysis_result.match_score if analysis_result else fallback_score,
        apply_status=ApplyStatus(analysis_result.apply_status) if analysis_result else ApplyStatus.NEEDS_CHECK,
        benefit_amount=benefit.benefit_amount_value if benefit else None,
        benefit_amount_label=analysis_result.benefit_amount_label if analysis_result else None,
        benefit_summary=(analysis_result.benefit_summary if analysis_result else (benefit.benefit_period_label if benefit else None)),
        badge_items=badge_items[:3],
        recommendation_context=None,
        sort_order=index,
    )


def build_analyzed_from_master(
    db: Session,
    master: PolicyMaster,
    *,
    index: int,
    rag_answer: str | None = None,
) -> AnalyzedPolicy:
    benefit = db.execute(select(PolicyBenefit).where(PolicyBenefit.policy_id == master.policy_id)).scalar_one_or_none()
    application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == master.policy_id)).scalar_one_or_none()

    score = max(70, 96 - ((index - 1) * 3))
    apply_status = ApplyStatus.APPLICABLE_NOW if (application and (application.online_apply_yn or application.application_url)) else ApplyStatus.NEEDS_CHECK
    score_level = ScoreLevel.HIGH if score >= 85 else ScoreLevel.MID

    badge_items = [master.source.upper()]
    if master.managing_agency:
        badge_items.append(master.managing_agency)
    if application and application.online_apply_yn:
        badge_items.append("온라인 신청")
    elif application and application.application_url:
        badge_items.append("신청 링크")
    if benefit and benefit.benefit_amount_value:
        if benefit.benefit_amount_value >= 10000:
            badge_items.append(f"최대 {benefit.benefit_amount_value // 10000:,}만원")
        else:
            badge_items.append(f"최대 {benefit.benefit_amount_value:,}원")

    eligibility_summary = rag_answer or "RAG 검색 결과 기준으로 현재 조건과 연관성이 높은 정책입니다."
    recommended_actions = ["정책 상세 정보를 확인한 뒤 신청 자격과 제출 서류를 점검해보세요."]
    if application and application.application_method_text:
        recommended_actions.append("신청 방법과 접수 기간을 먼저 확인해보세요.")

    return AnalyzedPolicy(
        policy_id=master.policy_id,
        title=master.title,
        description=master.summary or master.description,
        match_score=score,
        score_level=score_level,
        apply_status=apply_status,
        eligibility_summary=eligibility_summary,
        blocking_reasons=[],
        recommended_actions=recommended_actions[:4],
        benefit_amount=benefit.benefit_amount_value if benefit else None,
        benefit_amount_label=(f"최대 {benefit.benefit_amount_value // 10000:,}만원" if benefit and benefit.benefit_amount_value and benefit.benefit_amount_value >= 10000 else (f"최대 {benefit.benefit_amount_value:,}원" if benefit and benefit.benefit_amount_value else None)),
        benefit_summary=benefit.benefit_period_label if benefit else None,
        badge_items=badge_items[:3],
        recommendation_context=None,
    )


def build_summary_from_analyzed(item: AnalyzedPolicy, *, index: int) -> PolicySummary:
    return build_policy_summary(
        policy_id=item.policy_id,
        title=item.title,
        description=item.description,
        match_score=item.match_score,
        apply_status=item.apply_status,
        benefit_amount=item.benefit_amount,
        benefit_amount_label=item.benefit_amount_label,
        benefit_summary=item.benefit_summary,
        badge_items=item.badge_items,
        recommendation_context=item.recommendation_context,
        sort_order=index,
    )


def search_policy_summaries(db: Session, keyword: str, size: int) -> list[PolicySummary]:
    pattern = f"%{keyword}%"
    masters = db.execute(
        select(PolicyMaster)
        .where(PolicyMaster.status_active_yn.is_(True))
        .where(
            or_(
                PolicyMaster.title.ilike(pattern),
                PolicyMaster.summary.ilike(pattern),
                PolicyMaster.description.ilike(pattern),
                PolicyMaster.managing_agency.ilike(pattern),
            )
        )
        .order_by(PolicyMaster.policy_id.asc())
        .limit(size)
    ).scalars().all()

    return [
        build_summary_from_master(
            db,
            master,
            index=index,
            fallback_score=max(55, 82 - ((index - 1) * 3)),
        )
        for index, master in enumerate(masters, start=1)
    ]


def resolve_rag_references(
    db: Session,
    references: list[str],
    *,
    rag_answer: str | None = None,
) -> tuple[list[PolicySummary], list[AnalyzedPolicy], list[UnmatchedPolicyItem]]:
    items: list[PolicySummary] = []
    matched_analyzed: list[AnalyzedPolicy] = []
    unmatched: list[UnmatchedPolicyItem] = []
    seen_policy_ids: set[str] = set()

    for index, reference_id in enumerate(references, start=1):
        master = None
        source = infer_source_from_reference(reference_id)

        if "__" in reference_id:
            master = db.execute(select(PolicyMaster).where(PolicyMaster.policy_id == reference_id)).scalar_one_or_none()

        if master is None:
            stmt = select(PolicyMaster).where(PolicyMaster.source_policy_id == reference_id)
            if source:
                stmt = stmt.where(PolicyMaster.source == source)
            master = db.execute(stmt.order_by(PolicyMaster.policy_id.asc())).scalar_one_or_none()

        if master is None:
            unmatched.append(UnmatchedPolicyItem(reference_id=reference_id, source=source))
            continue

        if master.policy_id in seen_policy_ids:
            continue

        analyzed_item = build_analyzed_from_master(db, master, index=index, rag_answer=rag_answer)
        items.append(build_summary_from_analyzed(analyzed_item, index=index))
        matched_analyzed.append(analyzed_item)
        seen_policy_ids.add(master.policy_id)

    return items, matched_analyzed, unmatched


def build_policy_text(db: Session, policy_id: str) -> str:
    master = db.execute(select(PolicyMaster).where(PolicyMaster.policy_id == policy_id)).scalar_one_or_none()
    application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == policy_id)).scalar_one_or_none()
    condition = db.execute(select(PolicyCondition).where(PolicyCondition.policy_id == policy_id)).scalar_one_or_none()
    benefit = db.execute(select(PolicyBenefit).where(PolicyBenefit.policy_id == policy_id)).scalar_one_or_none()
    documents = get_policy_documents(db, policy_id)

    if not master:
        return ""

    parts = [
        f"정책명: {master.title}" if master.title else "",
        f"정책 요약: {master.summary}" if master.summary else "",
        f"정책 설명: {master.description}" if master.description else "",
        f"소관 기관: {master.managing_agency}" if master.managing_agency else "",
        f"지원 내용: {benefit.benefit_detail_text}" if benefit and benefit.benefit_detail_text else "",
        f"지원 금액: {benefit.benefit_amount_raw_text}" if benefit and benefit.benefit_amount_raw_text else "",
        f"신청 방법: {application.application_method_text}" if application and application.application_method_text else "",
        f"신청 기간: {application.application_period_text}" if application and application.application_period_text else "",
        f"심사 방법: {application.screening_method_text}" if application and application.screening_method_text else "",
        f"추가 자격: {condition.additional_qualification_text}" if condition and condition.additional_qualification_text else "",
        f"제한 대상: {condition.restricted_target_text}" if condition and condition.restricted_target_text else "",
    ]

    if documents:
        parts.append("제출 서류: " + ", ".join(doc.document_name for doc in documents if doc.document_name))

    return "\n".join(part for part in parts if part)


def build_user_condition_text(db: Session) -> str:
    profile = db.execute(select(AnalysisProfileState).where(AnalysisProfileState.id == 1)).scalar_one_or_none()
    if not profile:
        return ""

    return (
        f"나이 {profile.age}세, "
        f"지역 {profile.region_name}, "
        f"소득구간 {profile.income_band}, "
        f"가구유형 {profile.household_type}, "
        f"취업상태 {profile.employment_status}, "
        f"주거상태 {profile.housing_status}"
    )


def enrich_detail_with_ai(
    db: Session,
    policy_id: str,
    *,
    target_lang: str = "ko",
    fallback_summary: str | None = None,
    fallback_reasons: list[str] | None = None,
    fallback_actions: list[str] | None = None,
) -> dict[str, object]:
    fallback_reasons = fallback_reasons or []
    fallback_actions = fallback_actions or []

    if detail_enrichment_service is None:
        return {
            "eligibility_summary": fallback_summary,
            "blocking_reasons": fallback_reasons,
            "recommended_actions": fallback_actions,
        }

    policy_text = build_policy_text(db, policy_id)
    user_condition_text = build_user_condition_text(db)

    if not policy_text:
        return {
            "eligibility_summary": fallback_summary,
            "blocking_reasons": fallback_reasons,
            "recommended_actions": fallback_actions,
        }

    try:
        enriched = detail_enrichment_service.enrich_detail(
            policy_text=policy_text,
            user_condition_text=user_condition_text,
            target_lang=target_lang,
            fallback_summary=fallback_summary,
            fallback_reasons=fallback_reasons,
            fallback_actions=fallback_actions,
        )
    except Exception:
        enriched = {}

    return {
        "eligibility_summary": enriched.get("eligibility_summary") or fallback_summary,
        "blocking_reasons": enriched.get("blocking_reasons") or fallback_reasons,
        "recommended_actions": enriched.get("recommended_actions") or fallback_actions,
    }


def build_ai_module_trace(target_lang: str) -> list[str]:
    trace = [
        "summary_service.py · 정책 요약",
        "qwen_reasoner.py · 탈락 사유 / 보완 가이드",
    ]
    if target_lang != "ko":
        trace.append(f"translation_service.py · {target_lang} 번역")
    trace.append("output_guard.py · 근거 범위 / 언어 검증")
    return trace


def _recommendation_tier_from_score(score: int) -> str:
    if score >= 90:
        return "\uac15\ub825 \ucd94\ucc9c"
    if score >= 75:
        return "\ucd94\ucc9c"
    if score >= 60:
        return "\uc870\uac74 \ud655\uc778 \ud6c4 \ucd94\ucc9c"
    if score >= 40:
        return "\ucc38\uace0\uc6a9"
    return "\uc6b0\uc120\uc21c\uc704 \ub0ae\uc74c"


def _score_level_from_int(score: int) -> ScoreLevel:
    if score >= 85:
        return ScoreLevel.HIGH
    if score >= 65:
        return ScoreLevel.MID
    return ScoreLevel.LOW


def _apply_search_rerank(item: AnalyzedPolicy, rank_index: int) -> AnalyzedPolicy:
    search_rank_score = max(45, 100 - ((rank_index - 1) * 4))
    final_score = int(round((item.match_score * 0.7) + (search_rank_score * 0.3)))
    context = dict(item.recommendation_context or {})
    breakdown = dict(context.get("score_breakdown") or {})
    breakdown["search_rank_score"] = search_rank_score
    breakdown["final_score"] = final_score
    context["score_breakdown"] = breakdown
    context["recommendation_tier"] = _recommendation_tier_from_score(final_score)
    return replace(
        item,
        match_score=final_score,
        score_level=_score_level_from_int(final_score),
        recommendation_context=context,
    )


def select_display_items(all_analyzed: list[AnalyzedPolicy], rag_policies: list[PolicySummary], *, limit: int = 5) -> list[AnalyzedPolicy]:
    analyzed_map = {item.policy_id: item for item in all_analyzed}
    reranked_pool: list[AnalyzedPolicy] = []
    seen_policy_ids: set[str] = set()

    for rank_index, policy in enumerate(rag_policies[:20], start=1):
        item = analyzed_map.get(policy.policy_id)
        if (
            item is None
            or item.policy_id in seen_policy_ids
            or item.apply_status == ApplyStatus.NOT_RECOMMENDED
            or item.match_score < 60
        ):
            continue
        reranked_pool.append(_apply_search_rerank(item, rank_index))
        seen_policy_ids.add(item.policy_id)

    reranked_pool.sort(
        key=lambda item: (
            item.apply_status != ApplyStatus.APPLICABLE_NOW,
            item.apply_status == ApplyStatus.NOT_RECOMMENDED,
            -item.match_score,
            item.title,
        )
    )
    selected = reranked_pool[:limit]
    if len(selected) >= limit:
        return selected

    for item in all_analyzed:
        if item.policy_id in seen_policy_ids:
            continue
        selected.append(item)
        seen_policy_ids.add(item.policy_id)
        if len(selected) >= limit:
            break
    return selected
def expand_analysis_state(display_items: list[AnalyzedPolicy], all_analyzed: list[AnalyzedPolicy], *, limit: int = 20) -> list[AnalyzedPolicy]:
    selected = list(display_items)
    seen_policy_ids = {item.policy_id for item in selected}
    for item in all_analyzed:
        if item.policy_id in seen_policy_ids:
            continue
        selected.append(item)
        seen_policy_ids.add(item.policy_id)
        if len(selected) >= limit:
            break
    return selected


def build_rag_condition_query(request: AnalyzeRequest) -> str:
    household_label = {
        "SINGLE": "1인 가구",
        "TWO_PERSON": "2인 가구",
        "MULTI_PERSON": "다인 가구",
    }[request.household_type.value]
    employment_label = {
        "UNEMPLOYED": "미취업",
        "EMPLOYED": "재직 중",
        "SELF_EMPLOYED": "자영업",
    }[request.employment_status.value]
    housing_label = {
        "MONTHLY_RENT": "월세",
        "JEONSE": "전세",
        "OWNER_FAMILY_HOME": "자가 또는 가족 소유 주택",
    }[request.housing_status.value]
    income_label = {
        "MID_50_60": "중위소득 50~60%",
        "MID_60_80": "중위소득 60~80%",
        "MID_80_100": "중위소득 80~100%",
    }[request.income_band.value]
    return f"{request.region_name} 거주, 만 {request.age}세, {household_label}, {employment_label}, {housing_label}, {income_label} 조건에 맞는 복지 정책"


def build_request_from_profile_state(db: Session) -> AnalyzeRequest | None:
    profile = db.execute(select(AnalysisProfileState).where(AnalysisProfileState.id == 1)).scalar_one_or_none()
    if not profile:
        return None
    try:
        return AnalyzeRequest(
            age=profile.age,
            region_code=profile.region_code,
            region_name=profile.region_name,
            income_band=profile.income_band,
            household_type=profile.household_type,
            employment_status=profile.employment_status,
            housing_status=profile.housing_status,
        )
    except Exception:
        return None


def build_detail_data(db: Session, policy_id: str, *, target_lang: str = "ko") -> PolicyDetailData:
    master = db.execute(select(PolicyMaster).where(PolicyMaster.policy_id == policy_id)).scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Policy not found")

    application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == policy_id)).scalar_one_or_none()
    benefit = db.execute(select(PolicyBenefit).where(PolicyBenefit.policy_id == policy_id)).scalar_one_or_none()
    condition = db.execute(select(PolicyCondition).where(PolicyCondition.policy_id == policy_id)).scalar_one_or_none()
    result = db.execute(select(AnalysisResultState).where(AnalysisResultState.policy_id == policy_id)).scalar_one_or_none()

    profile_request = build_request_from_profile_state(db)
    personalized = None
    recommendation_context = None
    if profile_request is not None:
        personalized = evaluate_policy(
            req=profile_request,
            master=master,
            condition=condition,
            benefit=benefit,
            application=application,
        )
        recommendation_context = dict(personalized.recommendation_context or {})

    documents = [
        RequiredDocumentItem(
            document_type=doc.document_type or f"DOC_{doc.id}",
            document_name=doc.document_name,
            is_required=doc.is_required,
            description=doc.document_description,
        )
        for doc in get_policy_documents(db, policy_id)
    ]

    if result:
        description = result.description
        match_score = result.match_score
        score_level = ScoreLevel(result.score_level)
        apply_status = ApplyStatus(result.apply_status)
        eligibility_summary = result.eligibility_summary
        blocking_reasons = result.blocking_reasons_json or []
        recommended_actions = result.recommended_actions_json or []
    elif personalized is not None:
        description = master.summary or master.description
        match_score = personalized.match_score
        score_level = personalized.score_level
        apply_status = personalized.apply_status
        eligibility_summary = personalized.eligibility_summary
        blocking_reasons = personalized.blocking_reasons
        recommended_actions = personalized.recommended_actions
    else:
        description = master.summary or master.description
        match_score = 60
        score_level = ScoreLevel.MID
        apply_status = ApplyStatus.NEEDS_CHECK
        eligibility_summary = "정책 기본 정보를 기준으로 상세 내용을 확인하는 단계입니다."
        blocking_reasons = []
        recommended_actions = ["\uc815\ucc45 \uc6d0\ubb38\uacfc \uc2e0\uccad \uc870\uac74\uc744 \uba3c\uc800 \ud655\uc778\ud558\uc138\uc694."]

    if recommendation_context is not None:
        breakdown = dict(recommendation_context.get("score_breakdown") or {})
        breakdown["final_score"] = match_score
        recommendation_context["score_breakdown"] = breakdown
        recommendation_context["recommendation_tier"] = _recommendation_tier_from_score(match_score)

    enriched = enrich_detail_with_ai(
        db,
        policy_id,
        target_lang=target_lang,
        fallback_summary=eligibility_summary,
        fallback_reasons=blocking_reasons,
        fallback_actions=recommended_actions,
    )

    return PolicyDetailData(
        policy_id=master.policy_id,
        title=master.title,
        description=description,
        match_score=match_score,
        score_level=score_level,
        apply_status=apply_status,
        eligibility_summary=enriched["eligibility_summary"],
        blocking_reasons=enriched["blocking_reasons"],
        recommended_actions=enriched["recommended_actions"],
        required_documents=documents,
        related_links=load_policy_links(db, policy_id),
        laws=load_policy_laws(db, policy_id),
        tags=load_policy_tags(db, policy_id, limit=20),
        application_url=application.application_url if application else master.application_url,
        managing_agency=master.managing_agency,
        last_updated_at=master.updated_at,
        ai_enabled=bool(detail_enrichment_service and getattr(detail_enrichment_service, "enabled", False)),
        ai_language=target_lang,
        ai_module_trace=build_ai_module_trace(target_lang),
        recommendation_context=recommendation_context,
    )


@router.post("/eligibility/analyze", response_model=SuccessResponse[AnalyzeResponseData])
def analyze(request: AnalyzeRequest, db: Session = Depends(get_db)):
    all_analyzed = analyze_policies(db, request)
    rag_result = search_rag(
        query=build_rag_condition_query(request),
        user_condition={
            "age": request.age,
            "region": request.region_name,
            "income_band": request.income_band.value,
            "household_type": request.household_type.value,
            "employment_status": request.employment_status.value,
            "housing_status": request.housing_status.value,
        },
        lang_code="ko",
    )

    rag_policies, _, unmatched = resolve_rag_references(
        db,
        rag_result.docs_used,
        rag_answer=rag_result.answer,
    )
    if rag_policies:
        display_items = select_display_items(all_analyzed, rag_policies, limit=5)
    else:
        display_items = all_analyzed[:5]
        unmatched = []

    analyzed_items = expand_analysis_state(display_items, all_analyzed, limit=20)
    policies = [
        build_summary_from_analyzed(item, index=index)
        for index, item in enumerate(display_items, start=1)
    ]

    persist_analysis_state(db, request, analyzed_items)

    analysis_score = round(sum(item.match_score for item in policies) / max(1, len(policies)))
    return SuccessResponse(
        data=AnalyzeResponseData(
            profile_summary=ProfileSummary(analysis_score=analysis_score, tags=get_profile_tags(request)),
            policies=policies,
            rag_answer=rag_result.answer,
            rag_docs_used=rag_result.docs_used,
            unmatched_policies=unmatched,
        )
    )


@router.get("/policies/search", response_model=SuccessResponse[PolicySearchData])
def search_policies(
    q: str = Query(..., min_length=1),
    size: int = Query(default=20, ge=1, le=50),
    lang: str = Query(default="ko", pattern="^(ko|en|zh|ja|vi)$"),
    db: Session = Depends(get_db),
):
    keyword = q.strip()
    rag_result = search_rag(query=keyword, user_condition={}, lang_code=lang)
    items, _, unmatched = resolve_rag_references(db, rag_result.docs_used[:size])
    if not items:
        items = search_policy_summaries(db, keyword, size)
        unmatched = []

    return SuccessResponse(
        data=PolicySearchData(
            items=items[:size],
            query=keyword,
            total_count=len(items),
            rag_answer=rag_result.answer,
            rag_docs_used=rag_result.docs_used,
            unmatched_policies=unmatched,
        )
    )


@router.get("/policies/{policy_id}/detail", response_model=SuccessResponse[PolicyDetailData])
def get_policy_detail(
    policy_id: str,
    lang: str = Query(default="ko", pattern="^(ko|en|zh|ja|vi)$"),
    db: Session = Depends(get_db),
):
    return SuccessResponse(data=build_detail_data(db, policy_id, target_lang=lang))


@router.get("/portfolio", response_model=SuccessResponse[PortfolioData])
def get_portfolio(db: Session = Depends(get_db)):
    results = get_analysis_results(db)
    if not results:
        raise HTTPException(status_code=404, detail="Run analyze first")

    items: list[PortfolioItem] = []
    for row in results[:5]:
        master = db.execute(select(PolicyMaster).where(PolicyMaster.policy_id == row.policy_id)).scalar_one_or_none()
        application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == row.policy_id)).scalar_one_or_none()
        items.append(
            PortfolioItem(
                policy_id=row.policy_id,
                title=row.title,
                amount=row.benefit_amount,
                amount_label=row.benefit_amount_label,
                period_label=row.benefit_summary,
                apply_status=ApplyStatus(row.apply_status),
                source=master.source if master else None,
                managing_agency=master.managing_agency if master else None,
                benefit_summary=row.benefit_summary,
                application_url=application.application_url if application else (master.application_url if master else None),
                tags=load_policy_tags(db, row.policy_id, limit=6),
                sort_order=row.sort_order,
            )
        )

    total = sum(item.amount or 0 for item in items)
    total_label = f"{total // 10000:,}만원" if total >= 10000 else f"{total:,}원"
    return SuccessResponse(
        data=PortfolioData(
            total_estimated_benefit_amount=total,
            total_estimated_benefit_label=total_label,
            selected_policy_count=len(items),
            applicable_now_count=sum(1 for item in items if item.apply_status == ApplyStatus.APPLICABLE_NOW),
            needs_check_count=sum(1 for item in items if item.apply_status == ApplyStatus.NEEDS_CHECK),
            portfolio_items=items,
        )
    )


@router.get("/applications/{policy_id}/prep", response_model=SuccessResponse[ApplicationPrepData])
def get_application_prep(policy_id: str, db: Session = Depends(get_db)):
    master = db.execute(select(PolicyMaster).where(PolicyMaster.policy_id == policy_id)).scalar_one_or_none()
    application = db.execute(select(PolicyApplication).where(PolicyApplication.policy_id == policy_id)).scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Policy not found")

    documents, checklist = ensure_application_state(db, policy_id)
    return SuccessResponse(
        data=ApplicationPrepData(
            policy_id=policy_id,
            application_step=ApplicationStep(get_application_step(db, policy_id)),
            required_documents=[
                RequiredDocumentItem(
                    document_type=item.document_type,
                    document_name=item.document_name,
                    status=DocumentStatus(item.status),
                    description=item.description,
                    is_required=item.is_required,
                    issued_within_days=item.issued_within_days,
                    uploaded_file_url=item.uploaded_file_url,
                    verified_at=item.verified_at,
                )
                for item in documents
            ],
            checklist_items=[
                ChecklistItem(code=item.code, label=item.label, is_done=item.is_done, sort_order=item.sort_order)
                for item in checklist
            ],
            related_links=load_policy_links(db, policy_id),
            laws=load_policy_laws(db, policy_id),
            application_url=application.application_url if application else master.application_url,
        )
    )


@router.patch("/applications/{policy_id}/checklist/{code}", response_model=SuccessResponse[ChecklistItem])
def patch_checklist(policy_id: str, code: str, request: ChecklistPatchRequest, db: Session = Depends(get_db)):
    item = update_checklist_state(db, policy_id, code, request.is_done)
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return SuccessResponse(data=ChecklistItem(code=item.code, label=item.label, is_done=item.is_done, sort_order=item.sort_order))


@router.patch("/applications/{policy_id}/documents/{document_type}", response_model=SuccessResponse[RequiredDocumentItem])
def patch_document(policy_id: str, document_type: str, request: DocumentPatchRequest, db: Session = Depends(get_db)):
    item = update_document_state(db, policy_id, document_type, request.status.value, request.uploaded_file_url)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    return SuccessResponse(
        data=RequiredDocumentItem(
            document_type=item.document_type,
            document_name=item.document_name,
            status=DocumentStatus(item.status),
            description=item.description,
            is_required=item.is_required,
            issued_within_days=item.issued_within_days,
            uploaded_file_url=item.uploaded_file_url,
            verified_at=item.verified_at,
        )
    )


@router.get("/community/posts", response_model=SuccessResponse[CommunityListData])
def community_posts(
    category: str = Query(default="all"),
    sort: str = Query(default="latest"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    items, total_count = list_posts(db, category=category, sort=sort, page=page, size=size)
    return SuccessResponse(
        data=CommunityListData(
            items=[CommunityPostItem(**item) for item in items],
            page=page,
            size=size,
            total_count=total_count,
            has_next=(page * size) < total_count,
        )
    )


@router.get("/community/posts/{post_id}", response_model=SuccessResponse[CommunityPostItem])
def community_post_detail(post_id: int, db: Session = Depends(get_db)):
    item = get_post(db, post_id)
    if not item:
        raise HTTPException(status_code=404, detail="Post not found")
    return SuccessResponse(data=CommunityPostItem(**item))


@router.post("/community/posts", response_model=SuccessResponse[CommunityPostItem])
def community_post_create(request: CommunityCreateRequest, db: Session = Depends(get_db)):
    if request.category == "regional" and not request.region_text:
        raise HTTPException(status_code=400, detail="region_text is required for regional posts")
    return SuccessResponse(
        data=CommunityPostItem(**create_post(db, request.category, request.title, request.content, request.region_text))
    )


@router.post("/community/posts/{post_id}/like", response_model=SuccessResponse[CommunityLikeData])
def community_post_like(post_id: int, db: Session = Depends(get_db)):
    item = like_post(db, post_id)
    if not item:
        raise HTTPException(status_code=404, detail="Post not found")
    return SuccessResponse(data=CommunityLikeData(**item))


@router.delete("/community/posts/{post_id}/like", response_model=SuccessResponse[CommunityLikeData])
def community_post_unlike(post_id: int, db: Session = Depends(get_db)):
    item = unlike_post(db, post_id)
    if not item:
        raise HTTPException(status_code=404, detail="Post not found")
    return SuccessResponse(data=CommunityLikeData(**item))


@router.get("/community/hot-posts", response_model=SuccessResponse[list[CommunityPostItem]])
def community_hot_posts(db: Session = Depends(get_db)):
    return SuccessResponse(data=[CommunityPostItem(**item) for item in get_hot_posts(db)])


@router.get("/community/stats", response_model=SuccessResponse[CommunityStatsData])
def community_stats(db: Session = Depends(get_db)):
    return SuccessResponse(data=CommunityStatsData(**get_stats(db)))
