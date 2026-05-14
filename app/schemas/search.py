from pydantic import BaseModel, Field

from app.schemas.common import PolicySummary, UnmatchedPolicyItem


class PolicySearchData(BaseModel):
    items: list[PolicySummary] = Field(default_factory=list)
    query: str
    total_count: int
    rag_answer: str | None = None
    rag_docs_used: list[str] = Field(default_factory=list)
    rag_confidence_level: str | None = None
    rag_confidence_score: float | None = None
    rag_confidence_reason: str | None = None
    rag_top_policy_candidates: list[str] = Field(default_factory=list)
    rag_needs_confirmation: bool = False
    unmatched_policies: list[UnmatchedPolicyItem] = Field(default_factory=list)
