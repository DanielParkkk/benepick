from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import (
    ApplyStatus,
    PolicyLawItem,
    PolicyLinkItem,
    PolicyTagItem,
    RequiredDocumentItem,
    ScoreLevel,
)


class PolicySourceExcerpt(BaseModel):
    support_target_text: str | None = None
    support_content_text: str | None = None
    application_method_text: str | None = None
    contact_text: str | None = None
    official_url: str | None = None


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
    source_excerpt: PolicySourceExcerpt | None = None
