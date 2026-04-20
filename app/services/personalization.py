from __future__ import annotations

from dataclasses import dataclass
import re

from app.db.models import PolicyApplication, PolicyBenefit, PolicyCondition, PolicyMaster
from app.schemas.common import ApplyStatus, ScoreLevel
from app.schemas.eligibility import AnalyzeRequest


INCOME_ORDER = {
    "MID_50_60": 1,
    "MID_60_80": 2,
    "MID_80_100": 3,
}

HOUSING_KEYWORDS = (
    "\uc6d4\uc138",
    "\uc804\uc138",
    "\uc8fc\uac70",
    "\uc784\ub300",
    "\ubcf4\uc99d\uae08",
    "\uc804\uc785",
)
EMPLOYMENT_KEYWORDS = (
    "\uad6c\uc9c1",
    "\ucde8\uc5c5",
    "\uc77c\uc790\ub9ac",
    "\ubbf8\ucde8\uc5c5",
    "\ud6c8\ub828",
    "\ucc3d\uc5c5",
    "\uc0dd\uacc4",
)
YOUTH_KEYWORDS = ("\uccad\ub144", "\uc0ac\ud68c\ucd08\ub144")
SINGLE_HOUSEHOLD_KEYWORDS = ("1\uc778 \uac00\uad6c", "1\uc778\uac00\uad6c", "\ub3c5\uac70")
GENERIC_POLICY_KEYWORDS = (
    "\uad6c\ubbfc\uc548\uc804\ubcf4\ud5d8",
    "\uc548\uc804\ubcf4\ud5d8",
    "\ubcf4\ud5d8",
    "\uc7ac\ub09c",
    "\ubcf4\uc0c1",
)
ALWAYS_OPEN_KEYWORDS = ("\uc0c1\uc2dc", "\uc218\uc2dc", "\uc5f0\uc911", "\uc5b8\uc81c\ub4e0\uc9c0")
HANGUL_TOKEN_RE = re.compile(r"[\uac00-\ud7a3]{2,}")


@dataclass
class PersonalizationResult:
    match_score: int
    score_level: ScoreLevel
    apply_status: ApplyStatus
    eligibility_summary: str
    blocking_reasons: list[str]
    recommended_actions: list[str]
    badge_items: list[str]
    recommendation_context: dict[str, object]


def _score_level(score: int) -> ScoreLevel:
    if score >= 85:
        return ScoreLevel.HIGH
    if score >= 65:
        return ScoreLevel.MID
    return ScoreLevel.LOW


def _apply_status(score: int, hard_filter_passed: bool, check_needed: list[str]) -> ApplyStatus:
    if not hard_filter_passed or score < 45:
        return ApplyStatus.NOT_RECOMMENDED
    if score >= 85 and len(check_needed) <= 1:
        return ApplyStatus.APPLICABLE_NOW
    return ApplyStatus.NEEDS_CHECK


def _dedupe(items: list[str], *, limit: int | None = None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        out.append(value)
        seen.add(value)
        if limit is not None and len(out) >= limit:
            break
    return out


def _normalize_text(*parts: object) -> str:
    joined = " ".join(str(part or "").strip() for part in parts if str(part or "").strip())
    return re.sub(r"\s+", " ", joined).strip()


def _region_tokens(text: str | None) -> set[str]:
    tokens: set[str] = set()
    for raw in HANGUL_TOKEN_RE.findall(str(text or "")):
        normalized = raw
        for suffix in (
            "\ud2b9\ubcc4\uc2dc",
            "\uad11\uc5ed\uc2dc",
            "\ud2b9\ubcc4\uc790\uce58\uc2dc",
            "\ud2b9\ubcc4\uc790\uce58\ub3c4",
            "\uc790\uce58\uc2dc",
            "\uc790\uce58\ub3c4",
            "\ub3c4",
            "\uc2dc",
            "\uad70",
            "\uad6c",
        ):
            if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
                normalized = normalized[: -len(suffix)]
                break
        tokens.add(normalized)
        tokens.add(raw)
    return {token for token in tokens if len(token) >= 2}


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _income_match(req: AnalyzeRequest, condition: PolicyCondition | None) -> tuple[int, bool, list[str], list[str], list[str]]:
    matched: list[str] = []
    check_needed: list[str] = []
    evidence: list[str] = []
    if not condition:
        return 6, True, matched, check_needed, evidence

    codes = [code.strip() for code in str(condition.income_code or "").split(",") if code.strip()]
    if not codes:
        if condition.income_text:
            check_needed.append("\uc18c\ub4dd \uae30\uc900 \uc138\ubd80 \ud45c\ud604\uc744 \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4.")
            evidence.append(f"\uc18c\ub4dd \uae30\uc900: {condition.income_text}")
        return 6, True, matched, check_needed, evidence

    req_level = INCOME_ORDER.get(req.income_band.value, 99)
    allowed = [INCOME_ORDER.get(code, 99) for code in codes]
    allowed_max = max(allowed) if allowed else 99
    evidence_text = condition.income_text or ", ".join(codes)
    evidence.append(f"\uc18c\ub4dd \uae30\uc900: {evidence_text}")
    if req_level <= allowed_max:
        matched.append("\uc18c\ub4dd \uad6c\uac04 \uc870\uac74 \uc77c\uce58")
        return 12, True, matched, check_needed, evidence
    check_needed.append("\uc18c\ub4dd \uae30\uc900 \ucda9\uc871 \uc5ec\ubd80\ub97c \uc99d\ube59 \uc11c\ub958\ub85c \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4.")
    return 0, False, matched, check_needed, evidence


def _age_match(req: AnalyzeRequest, condition: PolicyCondition | None) -> tuple[int, bool, list[str], list[str]]:
    matched: list[str] = []
    evidence: list[str] = []
    if not condition or (condition.age_min is None and condition.age_max is None):
        return 8, True, matched, evidence

    min_age = condition.age_min
    max_age = condition.age_max
    if min_age is not None and req.age < min_age:
        evidence.append(f"\uc5f0\ub839 \uae30\uc900: {min_age}\uc138 \uc774\uc0c1")
        return 0, False, matched, evidence
    if max_age is not None and req.age > max_age:
        evidence.append(f"\uc5f0\ub839 \uae30\uc900: {max_age}\uc138 \uc774\ud558")
        return 0, False, matched, evidence

    if min_age is not None and max_age is not None:
        evidence.append(f"\uc5f0\ub839 \uae30\uc900: {min_age}~{max_age}\uc138")
    elif min_age is not None:
        evidence.append(f"\uc5f0\ub839 \uae30\uc900: {min_age}\uc138 \uc774\uc0c1")
    elif max_age is not None:
        evidence.append(f"\uc5f0\ub839 \uae30\uc900: {max_age}\uc138 \uc774\ud558")
    matched.append("\uc5f0\ub839 \uc870\uac74 \uc77c\uce58")
    return 14, True, matched, evidence


def _region_match(
    req: AnalyzeRequest,
    master: PolicyMaster,
    condition: PolicyCondition | None,
) -> tuple[int, bool, list[str], list[str], list[str]]:
    matched: list[str] = []
    check_needed: list[str] = []
    evidence: list[str] = []
    user_tokens = _region_tokens(req.region_name)

    policy_tokens: set[str] = set()
    if condition and condition.region_codes_json:
        for item in condition.region_codes_json:
            policy_tokens |= _region_tokens(str(item))
    policy_tokens |= _region_tokens(master.managing_agency)

    if not policy_tokens:
        return 6, True, matched, check_needed, evidence

    evidence.append("\uc9c0\uc5ed \ub2e8\uc11c: " + ", ".join(sorted(policy_tokens)[:4]))
    if "\uc804\uad6d" in policy_tokens:
        matched.append("\uc804\uad6d \ub610\ub294 \uad11\uc5ed \ub300\uc0c1 \uc815\ucc45")
        return 8, True, matched, check_needed, evidence

    shared = user_tokens & policy_tokens
    if shared:
        matched.append("\uc9c0\uc5ed \uc870\uac74 \uc77c\uce58")
        return 14, True, matched, check_needed, evidence

    check_needed.append("\uac70\uc8fc \uc9c0\uc5ed \uc870\uac74\uc774 \uc785\ub825 \uc9c0\uc5ed\uacfc \ub2ec\ub77c \ubcf4\uc785\ub2c8\ub2e4.")
    return 0, False, matched, check_needed, evidence


def _household_match(
    req: AnalyzeRequest,
    condition: PolicyCondition | None,
    policy_text: str,
) -> tuple[int, list[str], list[str]]:
    matched: list[str] = []
    check_needed: list[str] = []
    if not condition or not condition.household_type_codes_json:
        if req.household_type.value == "SINGLE" and _contains_any(policy_text, SINGLE_HOUSEHOLD_KEYWORDS):
            matched.append("1\uc778 \uac00\uad6c \ud0a4\uc6cc\ub4dc \uc77c\uce58")
            return 8, matched, check_needed
        return 4, matched, check_needed

    codes = set(condition.household_type_codes_json or [])
    if req.household_type.value in codes:
        matched.append("\uac00\uad6c \ud615\ud0dc \uc870\uac74 \uc77c\uce58")
        return 10, matched, check_needed
    if "MULTI_PERSON" in codes and req.household_type.value == "TWO_PERSON":
        matched.append("\uac00\uad6c \ud615\ud0dc \uc720\uc0ac")
        return 6, matched, check_needed
    check_needed.append("\uac00\uad6c \ud615\ud0dc \uc138\ubd80 \uae30\uc900\uc744 \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4.")
    return 0, matched, check_needed


def _housing_match(
    req: AnalyzeRequest,
    condition: PolicyCondition | None,
    policy_text: str,
) -> tuple[int, list[str], list[str], list[str]]:
    matched: list[str] = []
    check_needed: list[str] = []
    reasons: list[str] = []
    if condition and condition.housing_codes_json:
        codes = set(condition.housing_codes_json or [])
        if req.housing_status.value in codes:
            matched.append("\uc8fc\uac70 \uc0c1\ud0dc \uc870\uac74 \uc77c\uce58")
            return 12, matched, check_needed, reasons
        if "MONTHLY_RENT" in codes or "JEONSE" in codes:
            reasons.append("\uc8fc\uac70 \ud615\ud0dc \uc870\uac74\uc774 \ud575\uc2ec \uc694\uac74\uc73c\ub85c \ubcf4\uc785\ub2c8\ub2e4.")
        check_needed.append("\uc8fc\uac70 \ud615\ud0dc \uc870\uac74\uc744 \ub2e4\uc2dc \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4.")
        return 0, matched, check_needed, reasons

    if req.housing_status.value in {"MONTHLY_RENT", "JEONSE"} and _contains_any(policy_text, HOUSING_KEYWORDS):
        matched.append("\uc8fc\uac70 \ube44\uc6a9 \uad00\ub828 \uc815\ucc45")
        return 10, matched, check_needed, reasons
    return 3, matched, check_needed, reasons


def _employment_match(
    req: AnalyzeRequest,
    condition: PolicyCondition | None,
    policy_text: str,
) -> tuple[int, list[str], list[str]]:
    matched: list[str] = []
    check_needed: list[str] = []
    if condition and condition.employment_codes_json:
        codes = set(condition.employment_codes_json or [])
        if req.employment_status.value in codes:
            matched.append("\ucde8\uc5c5 \uc0c1\ud0dc \uc870\uac74 \uc77c\uce58")
            return 8, matched, check_needed
        check_needed.append("\ucde8\uc5c5 \uc0c1\ud0dc \uc138\ubd80 \uae30\uc900\uc744 \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4.")
        return 0, matched, check_needed

    if req.employment_status.value == "UNEMPLOYED" and _contains_any(policy_text, EMPLOYMENT_KEYWORDS):
        matched.append("\ubbf8\ucde8\uc5c5/\uad6c\uc9c1 \uad00\ub828 \ud0a4\uc6cc\ub4dc \uc77c\uce58")
        return 8, matched, check_needed
    return 3, matched, check_needed


def _life_stage_score(req: AnalyzeRequest, policy_text: str) -> tuple[int, list[str]]:
    matched: list[str] = []
    score = 0
    if 19 <= req.age <= 39 and _contains_any(policy_text, YOUTH_KEYWORDS):
        score += 10
        matched.append("\uccad\ub144 \ub300\uc0c1 \ud0a4\uc6cc\ub4dc \uc77c\uce58")
    if req.household_type.value == "SINGLE" and _contains_any(policy_text, SINGLE_HOUSEHOLD_KEYWORDS):
        score += 6
        matched.append("1\uc778 \uac00\uad6c \uc0dd\ud65c \ub9e5\ub77d \uc77c\uce58")
    return min(score, 10), matched


def _need_similarity(req: AnalyzeRequest, master: PolicyMaster, policy_text: str) -> tuple[int, list[str]]:
    reasons: list[str] = []
    score = 0
    category_text = _normalize_text(master.category_large, master.category_medium)
    searchable = _normalize_text(policy_text, category_text)

    if req.housing_status.value == "MONTHLY_RENT" and _contains_any(searchable, HOUSING_KEYWORDS):
        score += 12
        reasons.append("\uc6d4\uc138/\uc8fc\uac70 \ube44\uc6a9 \ubd80\ub2f4\uacfc \uc9c1\uc811 \uc5f0\uacb0\ub418\ub294 \uc815\ucc45\uc785\ub2c8\ub2e4.")
    if req.employment_status.value == "UNEMPLOYED" and _contains_any(searchable, EMPLOYMENT_KEYWORDS):
        score += 10
        reasons.append("\ubbf8\ucde8\uc5c5 \uc0c1\ud0dc\uc5d0\uc11c \ud65c\uc6a9\ud560 \uc218 \uc788\ub294 \uc9c0\uc6d0 \ub0b4\uc6a9\uc774 \ud3ec\ud568\ub429\ub2c8\ub2e4.")
    if req.income_band.value in {"MID_50_60", "MID_60_80"} and ("\uc0dd\uacc4" in searchable or "\uc911\uc704\uc18c\ub4dd" in searchable):
        score += 8
        reasons.append("\uc18c\ub4dd \uae30\uc900 \uad00\ub828 \uc815\ucc45\ub85c \ud574\uc11d\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.")

    return min(score, 30), reasons


def _benefit_score(benefit: PolicyBenefit | None) -> tuple[int, list[str], list[str]]:
    reasons: list[str] = []
    evidence: list[str] = []
    amount = benefit.benefit_amount_value if benefit else None
    if benefit:
        raw = benefit.benefit_amount_raw_text or benefit.benefit_detail_text or ""
        if raw:
            evidence.append(f"\uc9c0\uc6d0 \ub0b4\uc6a9: {raw[:90]}")

    if not amount:
        return 3, reasons, evidence
    if amount >= 2_000_000:
        reasons.append("\uc9c0\uc6d0 \uaddc\ubaa8\uac00 \ube44\uad50\uc801 \ud070 \ud3b8\uc785\ub2c8\ub2e4.")
        return 10, reasons, evidence
    if amount >= 500_000:
        reasons.append("\uc2e4\uc9c8 \ud61c\ud0dd\uc744 \uae30\ub300\ud560 \uc218 \uc788\ub294 \uc218\uc900\uc758 \uc9c0\uc6d0\uc785\ub2c8\ub2e4.")
        return 8, reasons, evidence
    if amount >= 100_000:
        reasons.append("\uc18c\uaddc\ubaa8\uc9c0\ub9cc \uc989\uc2dc \ud65c\uc6a9 \uac00\ub2a5\ud55c \ud61c\ud0dd\uc774 \uc788\uc2b5\ub2c8\ub2e4.")
        return 6, reasons, evidence
    return 4, reasons, evidence


def _urgency_score(application: PolicyApplication | None) -> tuple[int, list[str], list[str]]:
    reasons: list[str] = []
    evidence: list[str] = []
    if not application:
        return 2, reasons, evidence

    score = 0
    if application.online_apply_yn or application.application_url:
        score += 5
        reasons.append("\uc628\ub77c\uc778 \uc2e0\uccad \ub610\ub294 \uc989\uc2dc \uc774\ub3d9 \uac00\ub2a5\uc131\uc774 \uc788\uc2b5\ub2c8\ub2e4.")
    period_text = _normalize_text(
        application.application_period_text,
        application.business_period_etc_text,
    )
    if period_text:
        evidence.append(f"\uc2e0\uccad \uc815\ubcf4: {period_text[:90]}")
        if any(keyword in period_text for keyword in ALWAYS_OPEN_KEYWORDS):
            score += 5
            reasons.append("\uc0c1\uc2dc \ub610\ub294 \uc218\uc2dc \uc811\uc218 \uc815\ubcf4\uac00 \uc788\uc5b4 \uc2e4\ud589 \uac00\ub2a5\uc131\uc774 \ub192\uc2b5\ub2c8\ub2e4.")
        else:
            score += 3
    elif application.application_method_text:
        evidence.append(f"\uc2e0\uccad \ubc29\ubc95: {application.application_method_text[:90]}")
        score += 2
    return min(score, 10), reasons, evidence


def _generic_penalty(master: PolicyMaster, policy_text: str) -> tuple[int, list[str]]:
    reasons: list[str] = []
    if _contains_any(_normalize_text(master.title, policy_text), GENERIC_POLICY_KEYWORDS):
        reasons.append("\ubcf4\ud3b8 \uc815\ucc45 \uc131\uaca9\uc774 \uac15\ud574 \uac1c\uc778 \ub9de\ucda4 \uc6b0\uc120\uc21c\uc704\ub97c \ub0ae\ucdb0\uc57c \ud569\ub2c8\ub2e4.")
        return 8, reasons
    return 0, reasons


def _recommendation_tier(score: int) -> str:
    if score >= 90:
        return "\uac15\ub825 \ucd94\ucc9c"
    if score >= 75:
        return "\ucd94\ucc9c"
    if score >= 60:
        return "\uc870\uac74 \ud655\uc778 \ud6c4 \ucd94\ucc9c"
    if score >= 40:
        return "\ucc38\uace0\uc6a9"
    return "\uc6b0\uc120\uc21c\uc704 \ub0ae\uc74c"


def _build_summary(
    *,
    hard_filter_passed: bool,
    recommendation_tier: str,
    matched_conditions: list[str],
    why_this_policy: list[str],
    check_needed: list[str],
) -> str:
    if not hard_filter_passed:
        return "\ud575\uc2ec \uc790\uaca9 \uc870\uac74 \uc77c\ubd80\uac00 \ub9de\uc9c0 \uc54a\uc544 \uc6b0\uc120\uc21c\uc704\uac00 \ub0ae\uc2b5\ub2c8\ub2e4."
    if recommendation_tier == "\uac15\ub825 \ucd94\ucc9c":
        return "\uc785\ub825\ud55c \uc870\uac74 \uae30\uc900\uc73c\ub85c \ud575\uc2ec \uc790\uaca9\uc774 \uc798 \ub9de\uace0 \ud604\uc7ac \uc0c1\ud669\uacfc \uc9c1\uc811 \uc5f0\uacb0\ub418\uc5b4 \uc6b0\uc120 \uac80\ud1a0 \uac00\uce58\uac00 \ub192\uc2b5\ub2c8\ub2e4."
    if recommendation_tier == "\ucd94\ucc9c":
        return "\ud575\uc2ec \uc870\uac74\uc740 \ub300\uccb4\ub85c \ub9de\uc73c\uba70 \uc2e4\uc81c \uc2e0\uccad \uac00\ub2a5\uc131\ub3c4 \ube44\uad50\uc801 \ub192\uc740 \ud3b8\uc785\ub2c8\ub2e4."
    if check_needed:
        return "\ud575\uc2ec \uc870\uac74\uc740 \uc77c\ubd80 \ub9de\uc9c0\ub9cc \uc138\ubd80 \uc694\uac74 \ud655\uc778\uc774 \ud544\uc694\ud55c \uc815\ucc45\uc785\ub2c8\ub2e4."
    if matched_conditions or why_this_policy:
        return "\uc870\uac74\uc774 \uc77c\ubd80 \ubd80\ud569\ud574 \ucc38\uace0 \uac00\uce58\ub294 \uc788\uc9c0\ub9cc, \uc6b0\uc120\uc21c\uc704\ub294 \ubcf4\ud1b5 \uc218\uc900\uc785\ub2c8\ub2e4."
    return "\uc785\ub825 \uc870\uac74\uacfc \uc5f0\uad00\ub41c \uadfc\uac70\ub97c \ucd94\uac00\ub85c \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4."


def _build_actions(
    check_needed: list[str],
    application: PolicyApplication | None,
    condition: PolicyCondition | None,
) -> list[str]:
    actions: list[str] = []
    for item in check_needed:
        if "\uc18c\ub4dd" in item:
            actions.append("\uc18c\ub4dd \uc99d\ube59 \uc11c\ub958\ub97c \uc900\ube44\ud574 \uae30\uc900 \ucda9\uc871 \uc5ec\ubd80\ub97c \ud655\uc778\ud558\uc138\uc694.")
        elif "\uac00\uad6c" in item:
            actions.append("\uac00\uad6c \ud615\ud0dc\ub97c \uc99d\ube59\ud560 \uc8fc\ubbfc\ub4f1\ub85d \uc790\ub8cc\ub97c \uba3c\uc800 \ud655\uc778\ud558\uc138\uc694.")
        elif "\uc9c0\uc5ed" in item or "\uac70\uc8fc" in item:
            actions.append("\uac70\uc8fc\uc9c0\uc640 \uc804\uc785 \uc0c1\ud0dc\ub97c \uc815\ucc45 \uacf5\uace0\ubb38 \uae30\uc900\uacfc \ube44\uad50\ud574 \ubcf4\uc138\uc694.")
        elif "\ucde8\uc5c5" in item:
            actions.append("\ucde8\uc5c5 \uc0c1\ud0dc \uc99d\ube59 \uac00\ub2a5 \uc11c\ub958\ub97c \ud655\uc778\ud558\uc138\uc694.")
        elif "\uc8fc\uac70" in item:
            actions.append("\uc784\ub300\ucc28 \uacc4\uc57d\uc11c\ub098 \uc8fc\uac70 \ud615\ud0dc \uc99d\ube59 \uc790\ub8cc\ub97c \uba3c\uc800 \uc900\ube44\ud558\uc138\uc694.")
    if application and (application.application_period_text or application.application_method_text or application.application_url):
        actions.append("\uc2e0\uccad \uae30\uac04\uacfc \uc811\uc218 \ucc44\ub110\uc744 \uba3c\uc800 \ud655\uc778\ud558\uc138\uc694.")
    if condition and condition.additional_qualification_text:
        actions.append("\uacf5\uace0\ubb38\uc758 \ucd94\uac00 \uc790\uaca9 \uc870\uac74\uc744 \ud55c \ubc88 \ub354 \uc810\uac80\ud558\uc138\uc694.")
    if not actions:
        actions.append("\uc815\ucc45 \uc6d0\ubb38\uacfc \uc81c\ucd9c \uc11c\ub958\ub97c \ucd5c\uc885 \ud655\uc778\ud55c \ub4a4 \uc2e0\uccad\uc744 \uc900\ube44\ud558\uc138\uc694.")
    return _dedupe(actions, limit=3)


def _default_blocking_reasons(hard_filter_passed: bool, check_needed: list[str]) -> list[str]:
    if not hard_filter_passed and check_needed:
        return _dedupe(check_needed, limit=3)
    if check_needed:
        return _dedupe([f"\uac80\ud1a0 \ud544\uc694: {check_needed[0]}"], limit=3)
    return ["\uac80\ud1a0 \ud544\uc694: \ud604\uc7ac \uc785\ub825 \uc870\uac74\uacfc \ucda9\ub3cc\ud558\ub294 \ud575\uc2ec \uc81c\ud55c\uc740 \ud06c\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."]


def evaluate_policy(
    *,
    req: AnalyzeRequest,
    master: PolicyMaster,
    condition: PolicyCondition | None,
    benefit: PolicyBenefit | None,
    application: PolicyApplication | None,
    search_rank_score: int = 0,
) -> PersonalizationResult:
    policy_text = _normalize_text(
        master.title,
        master.summary,
        master.description,
        condition.additional_qualification_text if condition else "",
        condition.restricted_target_text if condition else "",
        benefit.benefit_detail_text if benefit else "",
        benefit.benefit_amount_raw_text if benefit else "",
        application.application_method_text if application else "",
        application.application_period_text if application else "",
    )

    matched_conditions: list[str] = []
    check_needed: list[str] = []
    evidence: list[str] = []
    why_this_policy: list[str] = []
    badge_items: list[str] = []

    age_score, age_passed, age_matched, age_evidence = _age_match(req, condition)
    matched_conditions.extend(age_matched)
    evidence.extend(age_evidence)

    region_score, region_passed, region_matched, region_checks, region_evidence = _region_match(req, master, condition)
    matched_conditions.extend(region_matched)
    check_needed.extend(region_checks)
    evidence.extend(region_evidence)

    income_score, income_passed, income_matched, income_checks, income_evidence = _income_match(req, condition)
    matched_conditions.extend(income_matched)
    check_needed.extend(income_checks)
    evidence.extend(income_evidence)

    household_score, household_matched, household_checks = _household_match(req, condition, policy_text)
    matched_conditions.extend(household_matched)
    check_needed.extend(household_checks)

    housing_score, housing_matched, housing_checks, housing_reasons = _housing_match(req, condition, policy_text)
    matched_conditions.extend(housing_matched)
    check_needed.extend(housing_checks)
    why_this_policy.extend(housing_reasons)

    employment_score, employment_matched, employment_checks = _employment_match(req, condition, policy_text)
    matched_conditions.extend(employment_matched)
    check_needed.extend(employment_checks)

    life_stage_score, life_stage_matched = _life_stage_score(req, policy_text)
    matched_conditions.extend(life_stage_matched)

    need_score, need_reasons = _need_similarity(req, master, policy_text)
    why_this_policy.extend(need_reasons)

    benefit_score, benefit_reasons, benefit_evidence = _benefit_score(benefit)
    why_this_policy.extend(benefit_reasons)
    evidence.extend(benefit_evidence)

    urgency_score, urgency_reasons, urgency_evidence = _urgency_score(application)
    why_this_policy.extend(urgency_reasons)
    evidence.extend(urgency_evidence)

    penalty_score, penalty_reasons = _generic_penalty(master, policy_text)
    why_this_policy.extend(penalty_reasons)

    hard_score = min(age_score + region_score + income_score + household_score, 50)
    soft_score = min(housing_score + employment_score + life_stage_score + need_score, 30)
    benefit_score = min(benefit_score, 10)
    urgency_score = min(urgency_score, 10)
    personal_score = max(0, min(hard_score + soft_score + benefit_score + urgency_score - penalty_score, 100))
    final_score = int(round((personal_score * 0.7) + (max(0, min(search_rank_score, 100)) * 0.3)))
    if search_rank_score <= 0:
        final_score = personal_score

    hard_filter_passed = age_passed and region_passed and income_passed
    recommendation_tier = _recommendation_tier(final_score)
    apply_status = _apply_status(final_score, hard_filter_passed, check_needed)
    score_level = _score_level(final_score)

    summary = _build_summary(
        hard_filter_passed=hard_filter_passed,
        recommendation_tier=recommendation_tier,
        matched_conditions=matched_conditions,
        why_this_policy=why_this_policy,
        check_needed=check_needed,
    )
    blocking_reasons = _default_blocking_reasons(hard_filter_passed, check_needed)
    recommended_actions = _build_actions(check_needed, application, condition)

    if matched_conditions:
        badge_items.append(matched_conditions[0].split()[0])
    if why_this_policy:
        badge_items.append("\ub9de\ucda4 \ucd94\ucc9c")
    if application and (application.online_apply_yn or application.application_url):
        badge_items.append("\uc989\uc2dc \ud655\uc778")

    recommendation_context = {
        "recommendation_tier": recommendation_tier,
        "hard_filter_passed": hard_filter_passed,
        "matched_conditions": _dedupe(matched_conditions, limit=4),
        "check_needed": _dedupe(check_needed, limit=3),
        "why_this_policy": _dedupe(why_this_policy, limit=3),
        "evidence": _dedupe(evidence, limit=4),
        "score_breakdown": {
            "hard_score": hard_score,
            "soft_score": soft_score,
            "benefit_score": benefit_score,
            "urgency_score": urgency_score,
            "penalty_score": penalty_score,
            "personal_score": personal_score,
            "search_rank_score": max(0, min(search_rank_score, 100)),
            "final_score": final_score,
        },
    }

    return PersonalizationResult(
        match_score=final_score,
        score_level=score_level,
        apply_status=apply_status,
        eligibility_summary=summary,
        blocking_reasons=blocking_reasons,
        recommended_actions=recommended_actions,
        badge_items=_dedupe(badge_items, limit=3),
        recommendation_context=recommendation_context,
    )
