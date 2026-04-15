from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import (
    ApplyStatus,
    PolicyLawItem,
    PolicyLinkItem,
    PolicyTagItem,
    PolicySummary,
    RequiredDocumentItem,
    ScoreLevel,
)


class PolicyDetailData(BaseModel):
    policy_id: str
    title: str
    description: str | None = None
    match_score: int
    score_level: ScoreLevel
    apply_status: ApplyStatus
    eligibility_summary: str | None = None
    blocking_reasons: list[str]
    recommended_actions: list[str]
    required_documents: list[RequiredDocumentItem]
    related_links: list[PolicyLinkItem]
    laws: list[PolicyLawItem]
    tags: list[PolicyTagItem]
    application_url: str | None = None
    managing_agency: str | None = None
    last_updated_at: datetime | None = None
    ai_enabled: bool = False
    ai_language: str = "ko"
    ai_module_trace: list[str] = Field(default_factory=list)
