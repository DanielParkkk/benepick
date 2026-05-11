from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


UNIT_MULTIPLIER = {
    "원": 1,
    "천원": 1_000,
    "만원": 10_000,
    "억원": 100_000_000,
}

BENEFIT_KEYWORDS = (
    "지원",
    "지급",
    "급여",
    "수당",
    "장려금",
    "바우처",
    "감면",
    "할인",
    "보조",
    "훈련비",
    "교육비",
    "수혜",
)

NON_BENEFIT_CONTEXT = (
    "소득",
    "재산",
    "기준중위소득",
    "중위소득",
    "보증금",
    "월세액",
    "본인부담",
    "자부담",
    "부담금",
    "이하",
    "초과",
)


@dataclass(frozen=True)
class BenefitCandidate:
    amount: int
    amount_label: str
    period_label: str
    calculation_basis: str
    confidence: str
    included_in_total: bool = True


@dataclass(frozen=True)
class PortfolioBenefitEstimate:
    amount: int | None
    amount_label: str | None
    period_label: str | None
    calculation_basis: str | None
    confidence: str
    included_in_total: bool
    original_amount_label: str | None = None


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).replace("\r", "\n").strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text or None


def format_won_compact(amount: int | None, *, prefix: str = "") -> str | None:
    if amount is None:
        return None
    if amount >= 100_000_000 and amount % 100_000_000 == 0:
        return f"{prefix}{amount // 100_000_000:,}억원"
    if amount >= 10_000 and amount % 10_000 == 0:
        return f"{prefix}{amount // 10_000:,}만원"
    return f"{prefix}{amount:,}원"


def format_portfolio_total_label(amount: int) -> str:
    return format_won_compact(amount) or "0원"


def _parse_number(number_text: str, unit: str) -> int:
    value = float(number_text.replace(",", ""))
    return int(value * UNIT_MULTIPLIER[unit])


def _money_pattern() -> str:
    return r"(\d[\d,]*(?:\.\d+)?)\s*(억원|만원|천원|원)"


def _money_to_label(amount: int) -> str:
    return format_won_compact(amount, prefix="최대 ") or "금액 확인 필요"


def _iter_candidate_lines(text: str) -> list[str]:
    normalized = text.replace("\r", "\n")
    lines = [line.strip(" \t-•·") for line in normalized.splitlines() if line.strip()]
    if not lines:
        lines = [text]

    filtered: list[str] = []
    for line in lines:
        has_benefit_word = any(keyword in line for keyword in BENEFIT_KEYWORDS)
        has_non_benefit_context = any(keyword in line for keyword in NON_BENEFIT_CONTEXT)
        if has_non_benefit_context and not has_benefit_word:
            continue
        filtered.append(line)
    return filtered or lines


def _confidence_rank(confidence: str) -> int:
    return {"HIGH": 3, "MEDIUM": 2, "LOW": 1}.get(confidence, 0)


def _extract_candidates(text: str) -> list[BenefitCandidate]:
    candidates: list[BenefitCandidate] = []
    money = _money_pattern()

    for line in _iter_candidate_lines(text):
        monthly_with_months = [
            rf"(?:월|매월)\s*(?:최대\s*)?{money}\s*(?:씩)?[^\n]{{0,24}}?(?:최장|최대|동안)?\s*(\d{{1,2}})\s*개월",
            rf"{money}\s*[xX×]\s*(\d{{1,2}})\s*개월",
        ]
        for pattern in monthly_with_months:
            for match in re.finditer(pattern, line):
                if len(match.groups()) == 3:
                    number, unit, months = match.groups()
                else:
                    number, unit, months = match.group(1), match.group(2), match.group(3)
                monthly_amount = _parse_number(number, unit)
                month_count = int(months)
                total = monthly_amount * month_count
                period = f"월 {format_won_compact(monthly_amount)} x {month_count}개월"
                candidates.append(
                    BenefitCandidate(
                        amount=total,
                        amount_label=_money_to_label(total),
                        period_label=period,
                        calculation_basis=f"월 지원액과 지원 개월 수를 곱해 총 수혜액으로 환산: {period}",
                        confidence="HIGH",
                    )
                )

        annual_pattern = rf"(?:연간|연\s*|1년|년간)\s*(?:최대\s*)?{money}"
        for match in re.finditer(annual_pattern, line):
            amount = _parse_number(match.group(1), match.group(2))
            candidates.append(
                BenefitCandidate(
                    amount=amount,
                    amount_label=_money_to_label(amount),
                    period_label="연간 기준",
                    calculation_basis="공고 문구에 연간/1년 기준 금액이 명시되어 그대로 반영",
                    confidence="HIGH",
                )
            )

        monthly_pattern = rf"(?:월|매월)\s*(?:최대\s*)?{money}"
        for match in re.finditer(monthly_pattern, line):
            monthly_amount = _parse_number(match.group(1), match.group(2))
            total = monthly_amount * 12
            period = f"월 {format_won_compact(monthly_amount)} x 12개월"
            candidates.append(
                BenefitCandidate(
                    amount=total,
                    amount_label=_money_to_label(total),
                    period_label=period,
                    calculation_basis="월 지원액만 확인되어 포트폴리오 비교용으로 12개월 기준 연간 환산",
                    confidence="MEDIUM",
                )
            )

        count_pattern = rf"{money}\s*[xX×]\s*(\d{{1,3}})\s*(?:회|번)"
        for match in re.finditer(count_pattern, line):
            single_amount = _parse_number(match.group(1), match.group(2))
            count = int(match.group(3))
            total = single_amount * count
            candidates.append(
                BenefitCandidate(
                    amount=total,
                    amount_label=_money_to_label(total),
                    period_label=f"{format_won_compact(single_amount)} x {count}회",
                    calculation_basis="회차별 지원액과 지원 횟수를 곱해 총 수혜액으로 환산",
                    confidence="HIGH",
                )
            )

        cap_pattern = rf"(?:최대|한도|1인당|인당|총|지원금|급여|바우처|훈련비|교육비)?\s*{money}"
        for match in re.finditer(cap_pattern, line):
            amount = _parse_number(match.group(1), match.group(2))
            if 0 < amount <= 2_000_000_000:
                candidates.append(
                    BenefitCandidate(
                        amount=amount,
                        amount_label=_money_to_label(amount),
                        period_label="공고 기준 최대 지원액",
                        calculation_basis="공고에서 확인된 최대/한도 금액을 포트폴리오 수혜액으로 반영",
                        confidence="MEDIUM",
                    )
                )

    return [candidate for candidate in candidates if 0 < candidate.amount <= 2_000_000_000]


def _best_candidate(candidates: list[BenefitCandidate]) -> BenefitCandidate | None:
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: (_confidence_rank(item.confidence), item.amount), reverse=True)[0]


def _join_text_parts(*parts: Any) -> str:
    cleaned = [clean_text(part) for part in parts]
    return "\n".join(part for part in cleaned if part)


def estimate_portfolio_benefit(
    *,
    analysis_result: Any,
    master: Any | None = None,
    benefit: Any | None = None,
) -> PortfolioBenefitEstimate:
    """Return the amount that should be used in the portfolio total.

    The analysis table already stores a normalized amount, but portfolio needs a
    display-oriented yearly/total estimate. This helper re-reads the benefit
    text and prefers explicit formulas such as "월 20만원 x 12개월".
    """

    original_label = getattr(analysis_result, "benefit_amount_label", None)
    text = _join_text_parts(
        getattr(analysis_result, "benefit_summary", None),
        original_label,
        getattr(benefit, "benefit_period_label", None),
        getattr(benefit, "benefit_amount_raw_text", None),
        getattr(benefit, "benefit_detail_text", None),
        getattr(master, "summary", None),
        getattr(master, "description", None),
    )
    candidate = _best_candidate(_extract_candidates(text))
    if candidate:
        return PortfolioBenefitEstimate(
            amount=candidate.amount,
            amount_label=candidate.amount_label,
            period_label=candidate.period_label,
            calculation_basis=candidate.calculation_basis,
            confidence=candidate.confidence,
            included_in_total=candidate.included_in_total,
            original_amount_label=original_label,
        )

    stored_amount = getattr(analysis_result, "benefit_amount", None)
    if stored_amount is None and benefit is not None:
        stored_amount = getattr(benefit, "benefit_amount_value", None)

    if stored_amount:
        stored_amount = int(stored_amount)
        return PortfolioBenefitEstimate(
            amount=stored_amount,
            amount_label=_money_to_label(stored_amount),
            period_label=getattr(benefit, "benefit_period_label", None) if benefit is not None else None,
            calculation_basis="정규화 테이블에 저장된 수혜 금액을 사용",
            confidence="LOW",
            included_in_total=True,
            original_amount_label=original_label,
        )

    return PortfolioBenefitEstimate(
        amount=None,
        amount_label=original_label or "금액 확인 필요",
        period_label=getattr(analysis_result, "benefit_summary", None),
        calculation_basis="공고에서 금액을 구조적으로 추출하지 못해 총액 합산에서 제외",
        confidence="LOW",
        included_in_total=False,
        original_amount_label=original_label,
    )
