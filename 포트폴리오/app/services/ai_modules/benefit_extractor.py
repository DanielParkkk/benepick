from __future__ import annotations

from dataclasses import asdict, dataclass
import re


@dataclass
class BenefitEstimate:
    unit_amount: int | None
    period_months: int | None
    annual_amount: int
    calculation_type: str
    confidence: str
    evidence_text: str
    annual_amount_label: str
    calculation_basis: str
    is_cash_equivalent: bool

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


AMOUNT_PATTERN = re.compile(
    r"(?P<number>[0-9][0-9,]*(?:\.[0-9]+)?)\s*(?P<unit>억\s*원|억원|억|만\s*원|만원|천\s*원|천원|원)"
)


def format_krw(amount: int | None) -> str:
    if not amount:
        return "확인 필요"
    if amount >= 10000:
        value = amount / 10000
        if value.is_integer():
            return f"{int(value):,}만원"
        return f"{value:,.1f}만원"
    return f"{amount:,}원"


def _normalize_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _money_to_won(match: re.Match[str]) -> int:
    number = float(match.group("number").replace(",", ""))
    unit = match.group("unit").replace(" ", "")
    if unit in {"억원", "억"}:
        return int(number * 100_000_000)
    if unit == "만원":
        return int(number * 10_000)
    if unit == "천원":
        return int(number * 1_000)
    return int(number)


def _clip_evidence(text: str, *, limit: int = 120) -> str:
    compact = _normalize_text(text)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def _sentence_around(text: str, start: int, end: int) -> str:
    left = max(text.rfind(".", 0, start), text.rfind("\n", 0, start), text.rfind("。", 0, start))
    right_candidates = [pos for pos in (text.find(".", end), text.find("\n", end), text.find("。", end)) if pos != -1]
    right = min(right_candidates) if right_candidates else min(len(text), end + 80)
    return _clip_evidence(text[left + 1 : right + 1])


def _find_prefixed_amount(text: str, prefix_pattern: str) -> tuple[int, str] | None:
    pattern = re.compile(rf"{prefix_pattern}\s*(?:최대|약|정액|상당|지원|이내|까지)?\s*{AMOUNT_PATTERN.pattern}")
    match = pattern.search(text)
    if not match:
        return None
    return _money_to_won(match), _sentence_around(text, match.start(), match.end())


def _find_any_amount(text: str) -> tuple[int, str] | None:
    match = AMOUNT_PATTERN.search(text)
    if not match:
        return None
    return _money_to_won(match), _sentence_around(text, match.start(), match.end())


def _looks_like_eligibility_threshold(evidence: str) -> bool:
    evidence = str(evidence or "")
    return any(keyword in evidence for keyword in ("이하", "미만", "초과", "이상", "소득", "월세", "보증금", "자산"))


def _looks_like_benefit_sentence(evidence: str) -> bool:
    evidence = str(evidence or "")
    return any(
        keyword in evidence
        for keyword in ("지원", "지급", "보조", "급여", "바우처", "훈련비", "상담", "최대", "한도", "제공")
    )


def _find_any_benefit_amount(text: str) -> tuple[int, str] | None:
    fallback: tuple[int, str] | None = None
    for match in AMOUNT_PATTERN.finditer(text):
        evidence = _sentence_around(text, match.start(), match.end())
        candidate = (_money_to_won(match), evidence)
        if _looks_like_benefit_sentence(evidence) and not _looks_like_eligibility_threshold(evidence):
            return candidate
        if fallback is None and not _looks_like_eligibility_threshold(evidence):
            fallback = candidate
    return fallback


def _find_monthly_support_amount(text: str) -> tuple[int, str] | None:
    patterns = [
        re.compile(rf"(?:월|매월)\s*(?:최대|약|정액|상당|지원|지급)?\s*{AMOUNT_PATTERN.pattern}"),
        re.compile(rf"월세\s*(?:를\s*)?(?:월\s*)?(?:최대|약|정액)?\s*{AMOUNT_PATTERN.pattern}\s*(?:지원|지급|보조)"),
    ]
    fallback: tuple[int, str] | None = None
    for pattern in patterns:
        for match in pattern.finditer(text):
            evidence = _sentence_around(text, match.start(), match.end())
            near = text[match.start() : min(len(text), match.end() + 12)]
            candidate = (_money_to_won(match), evidence)
            if any(keyword in near for keyword in ("이하", "미만", "초과", "이상")):
                continue
            if _looks_like_eligibility_threshold(evidence) and not _looks_like_benefit_sentence(evidence):
                continue
            if _looks_like_benefit_sentence(evidence):
                return candidate
            fallback = fallback or candidate
    return fallback


def _extract_months(text: str) -> tuple[int | None, str]:
    patterns = [
        r"(?:최대|총|동안)?\s*(?P<months>[1-9][0-9]?)\s*개?\s*월",
        r"(?P<months>[1-9][0-9]?)\s*개월\s*(?:간|동안|지원)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            months = min(12, int(match.group("months")))
            return months, _sentence_around(text, match.start(), match.end())
    if re.search(r"연간|1년|매년|연\s", text):
        return 12, "연간 기준"
    return None, ""


def _extract_count(text: str) -> tuple[int | None, str]:
    patterns = [
        r"(?:연간|연|최대)?\s*(?P<count>[1-9][0-9]?)\s*회\s*(?:이내|까지|지원)?",
        r"(?P<count>[1-9][0-9]?)\s*회\s*(?:상담|이용|지원)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return int(match.group("count")), _sentence_around(text, match.start(), match.end())
    return None, ""


def _is_loan_like(text: str) -> bool:
    return any(keyword in text for keyword in ("대출", "융자", "보증금 대출", "전세자금", "대부"))


def _is_asset_account(text: str) -> bool:
    return any(keyword in text for keyword in ("도약계좌", "적금", "저축계좌", "자산형성"))


def _estimate_asset_account(text: str) -> BenefitEstimate | None:
    if "도약계좌" not in text:
        return None
    monthly = _find_prefixed_amount(text, r"(?:월|매월)")
    rate = re.search(r"(?P<rate>[1-9][0-9]?)\s*%", text)
    if monthly and rate:
        amount = int(monthly[0] * 12 * (int(rate.group("rate")) / 100))
        amount = max(amount, 700_000)
        evidence = f"{monthly[1]} / {rate.group(0)}"
        basis = f"월 납입액 {_format_amount_for_basis(monthly[0])} x 12개월 x 정부기여율 {rate.group(0)} 추정"
    else:
        amount = 700_000
        evidence = "청년도약계좌 정부기여금 연간 추정"
        basis = "만기 총액이 아닌 정부기여금 성격의 연간 추정액 기준"
    return BenefitEstimate(
        unit_amount=None,
        period_months=12,
        annual_amount=amount,
        calculation_type="ASSET_CONTRIBUTION_ESTIMATE",
        confidence="MEDIUM",
        evidence_text=_clip_evidence(evidence),
        annual_amount_label=f"연 {format_krw(amount)}",
        calculation_basis=basis,
        is_cash_equivalent=True,
    )


def _format_amount_for_basis(amount: int | None) -> str:
    return format_krw(amount).replace("확인 필요", "금액 확인 필요")


def extract_benefit_estimate(policy_text: str | None, normalized_amount: int | None = None) -> dict[str, object]:
    text = _normalize_text(policy_text)
    if not text and not normalized_amount:
        return BenefitEstimate(
            unit_amount=None,
            period_months=None,
            annual_amount=0,
            calculation_type="UNKNOWN",
            confidence="LOW",
            evidence_text="",
            annual_amount_label="공식 공고 확인",
            calculation_basis="금액 정보가 불명확해 총액 산정에서 제외",
            is_cash_equivalent=False,
        ).to_dict()

    if _is_loan_like(text):
        amount = normalized_amount
        extracted = _find_any_amount(text)
        if extracted:
            amount = extracted[0]
            evidence = extracted[1]
        else:
            evidence = "대출/융자 한도"
        return BenefitEstimate(
            unit_amount=amount,
            period_months=None,
            annual_amount=0,
            calculation_type="LOAN_LIMIT",
            confidence="MEDIUM" if amount else "LOW",
            evidence_text=evidence,
            annual_amount_label=f"한도 {format_krw(amount)}" if amount else "대출 한도 확인",
            calculation_basis="대출/융자 한도는 실제 현금성 수혜액과 달라 총액에서 제외",
            is_cash_equivalent=False,
        ).to_dict()

    asset_estimate = _estimate_asset_account(text)
    if asset_estimate:
        return asset_estimate.to_dict()

    session_amount = _find_prefixed_amount(text, r"(?:1회당|회당|1회)")
    count, count_evidence = _extract_count(text)
    if session_amount and count:
        annual = session_amount[0] * count
        evidence = " / ".join(part for part in (session_amount[1], count_evidence) if part)
        return BenefitEstimate(
            unit_amount=session_amount[0],
            period_months=12,
            annual_amount=annual,
            calculation_type="SESSION_BASED",
            confidence="HIGH",
            evidence_text=_clip_evidence(evidence),
            annual_amount_label=f"연 {format_krw(annual)}",
            calculation_basis=f"회당 {format_krw(session_amount[0])} x {count}회 환산",
            is_cash_equivalent=True,
        ).to_dict()

    monthly_amount = _find_monthly_support_amount(text)
    if monthly_amount:
        months, month_evidence = _extract_months(text)
        months = months or 12
        annual = monthly_amount[0] * months
        evidence = " / ".join(part for part in (monthly_amount[1], month_evidence) if part)
        return BenefitEstimate(
            unit_amount=monthly_amount[0],
            period_months=months,
            annual_amount=annual,
            calculation_type="MONTHLY_FIXED",
            confidence="HIGH" if month_evidence else "MEDIUM",
            evidence_text=_clip_evidence(evidence),
            annual_amount_label=f"연 {format_krw(annual)}",
            calculation_basis=f"월 {format_krw(monthly_amount[0])} x {months}개월 환산",
            is_cash_equivalent=True,
        ).to_dict()

    annual_amount = _find_prefixed_amount(text, r"(?:연간|매년|연\s+)")
    if annual_amount:
        return BenefitEstimate(
            unit_amount=annual_amount[0],
            period_months=12,
            annual_amount=annual_amount[0],
            calculation_type="ANNUAL_FIXED",
            confidence="HIGH",
            evidence_text=annual_amount[1],
            annual_amount_label=f"연 {format_krw(annual_amount[0])}",
            calculation_basis="공고에 표기된 연간 금액 기준",
            is_cash_equivalent=True,
        ).to_dict()

    amount = normalized_amount
    evidence = "DB 정규화 금액"
    extracted = _find_any_benefit_amount(text)
    if extracted:
        amount = extracted[0]
        evidence = extracted[1]

    if amount:
        return BenefitEstimate(
            unit_amount=amount,
            period_months=None,
            annual_amount=amount,
            calculation_type="ONE_TIME_MAX",
            confidence="MEDIUM",
            evidence_text=evidence,
            annual_amount_label=f"최대 {format_krw(amount)}",
            calculation_basis="공고상 최대 또는 일시 수혜액 기준",
            is_cash_equivalent=True,
        ).to_dict()

    return BenefitEstimate(
        unit_amount=None,
        period_months=None,
        annual_amount=0,
        calculation_type="UNKNOWN",
        confidence="LOW",
        evidence_text="",
        annual_amount_label="공식 공고 확인",
        calculation_basis="금액 정보가 불명확해 총액 산정에서 제외",
        is_cash_equivalent=False,
    ).to_dict()
