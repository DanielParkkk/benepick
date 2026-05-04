from __future__ import annotations

import re
from typing import Any


def _compact(text: str | None) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _dedupe(items: list[str], limit: int = 5) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        clean = _compact(item)
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        result.append(clean)
        if len(result) >= limit:
            break
    return result


def _has(text: str, *keywords: str) -> bool:
    return any(keyword in text for keyword in keywords)


def build_support_guidance(
    *,
    title: str | None,
    policy_text: str,
    risk_flags: list[str],
    required_actions: list[str],
    is_cash_equivalent: bool,
) -> tuple[list[str], list[str], list[str]]:
    """Return service-stage rejection/support guidance grounded in known welfare patterns.

    The rules are intentionally conservative. They do not invent eligibility; they only
    add practical next steps when the policy text already exposes a matching issue.
    """

    text = f"{_compact(title)} {_compact(policy_text)} {' '.join(risk_flags)}"
    risks = list(risk_flags)
    actions = list(required_actions)
    guide_tags: list[str] = []

    if _has(text, "소득", "중위소득", "건강보험료", "월평균 소득"):
        guide_tags.append("소득 기준 보정")
        if any(_has(flag, "초과", "소득") for flag in risk_flags) or _has(text, "초과", "이상"):
            risks.append("소득·건강보험료 기준에서 탈락 또는 보류될 가능성이 있습니다.")
        actions.append("최근 소득자료, 건강보험료 납부확인서, 가구원 산정 기준을 먼저 확인하세요.")

    if _has(text, "재산", "부동산", "자동차", "보증금", "금융재산"):
        guide_tags.append("재산 기준 보정")
        if _has(text, "초과", "이상"):
            risks.append("재산가액 또는 보증금 기준을 초과할 수 있습니다.")
        actions.append("부동산·차량·보증금·금융재산이 어떤 기준으로 합산되는지 확인하세요.")

    if _has(text, "만 19", "34세", "연령", "나이", "생후", "개월"):
        guide_tags.append("연령 기준 보정")
        if _has(text, "초과", "이하", "이상"):
            actions.append("나이 기준일이 신청일 기준인지, 사업 공고일 기준인지 확인하세요.")

    if _has(text, "확정일자", "임대차계약서", "전입신고", "주민등록", "무주택"):
        guide_tags.append("주거 서류 보정")
        actions.append("임대차계약서, 확정일자, 전입신고, 주민등록 주소 일치 여부를 확인하세요.")

    if _has(text, "고용보험", "실업급여", "피보험", "근로", "재직", "퇴사", "취업"):
        guide_tags.append("고용 상태 보정")
        actions.append("고용보험 가입기간, 재직/퇴사일, 근로계약 형태를 증빙할 수 있는 서류를 준비하세요.")

    if _has(text, "금융소득종합과세", "이자", "배당", "종합과세"):
        guide_tags.append("금융소득 기준 보정")
        risks.append("금융소득종합과세 이력이 있으면 자산형성 정책 가입이 제한될 수 있습니다.")
        actions.append("최근 3개년도 금융소득종합과세 대상 여부를 홈택스 또는 세무서에서 확인하세요.")

    if _has(text, "신청 기간", "마감", "예산", "선착순", "소진", "6개월 이내"):
        guide_tags.append("신청 기간 보정")
        actions.append("접수 마감일, 예산 소진 여부, 가입 가능 기한을 먼저 확인하세요.")

    if _has(text, "TOPIK", "한국어능력", "자격증", "학점", "학년", "등록"):
        guide_tags.append("자격 증빙 보정")
        actions.append("자격증, 학적, 등록 기간처럼 심사에서 요구하는 증빙을 먼저 확보하세요.")

    if is_cash_equivalent is False or _has(text, "대출", "융자", "이자", "금리"):
        guide_tags.append("대출 한도 분리")
        risks.append("대출·융자 한도는 실제 현금성 수혜액과 달라 총액 합산에서 제외해야 합니다.")
        actions.append("대출형 정책은 금리, 한도, 상환 조건을 별도 비교 항목으로 확인하세요.")

    if not actions:
        actions.append("공식 공고의 자격 조건, 신청 기간, 필요 서류를 순서대로 확인하세요.")

    return _dedupe(risks, 5), _dedupe(actions, 5), _dedupe(guide_tags, 5)
