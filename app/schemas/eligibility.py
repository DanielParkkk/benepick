from pydantic import BaseModel, Field

from app.schemas.common import (
    EmploymentStatus,
    HouseholdType,
    HousingStatus,
    IncomeBand,
    PolicySummary,
    UnmatchedPolicyItem,
)


class AnalyzeRequest(BaseModel):
    age: int = Field(gt=0)
    region_code: str
    region_name: str
    income_band: IncomeBand
    household_type: HouseholdType
    employment_status: EmploymentStatus
    housing_status: HousingStatus
    # Soft preference tags for intent-aware retrieval/ranking.
    interest_tags: list[str] = Field(default_factory=list, max_length=5)
    lang_code: str = Field(default="ko", pattern="^(ko|en|zh|ja|vi)$")


class ProfileSummary(BaseModel):
    display_name: str = "홍길동"
    analysis_score: int
    tags: list[str]


class AnalyzeResponseData(BaseModel):
    profile_summary: ProfileSummary
    policies: list[PolicySummary]
    rag_answer: str | None = None
    rag_docs_used: list[str] = Field(default_factory=list)
    rag_confidence_level: str | None = None
    rag_confidence_score: float | None = None
    rag_confidence_reason: str | None = None
    rag_top_policy_candidates: list[str] = Field(default_factory=list)
    rag_needs_confirmation: bool = False
    unmatched_policies: list[UnmatchedPolicyItem] = Field(default_factory=list)
