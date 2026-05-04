from pydantic import BaseModel, Field

from app.schemas.common import ApplyStatus, PolicyTagItem


class PortfolioItem(BaseModel):
    policy_id: str
    title: str
    amount: int | None = None
    amount_label: str | None = None
    period_label: str | None = None
    annual_amount: int = 0
    annual_amount_label: str | None = None
    amount_basis: str | None = None
    calculation_type: str | None = None
    is_cash_equivalent: bool = True
    decision_summary: str | None = None
    condition_tags: list[str] = Field(default_factory=list)
    fit_reasons: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    required_actions: list[str] = Field(default_factory=list)
    evidence_snippets: list[str] = Field(default_factory=list)
    guide_tags: list[str] = Field(default_factory=list)
    evidence_quality: str | None = None
    grounded_score: int | None = None
    apply_status: ApplyStatus
    source: str | None = None
    managing_agency: str | None = None
    benefit_summary: str | None = None
    application_url: str | None = None
    category: str | None = None
    selected_reason: str | None = None
    overlap_note: str | None = None
    confidence: str | None = None
    tags: list[PolicyTagItem] = Field(default_factory=list)
    sort_order: int


class PortfolioCategorySummary(BaseModel):
    category: str
    count: int
    annual_amount: int
    annual_amount_label: str


class PortfolioPipelineStep(BaseModel):
    step_order: int
    step_code: str
    step_name: str
    input_data: str
    process: str
    output_data: str
    guardrail: str | None = None


class PortfolioExcludedItem(BaseModel):
    policy_id: str
    title: str
    reason: str
    conflict_group: str | None = None
    annual_amount_label: str | None = None
    risk_flags: list[str] = Field(default_factory=list)
    evidence_snippets: list[str] = Field(default_factory=list)


class PortfolioData(BaseModel):
    total_estimated_benefit_amount: int
    total_estimated_benefit_label: str
    currency: str = "KRW"
    selected_policy_count: int
    applicable_now_count: int
    needs_check_count: int
    excluded_policy_count: int = 0
    calculation_basis_note: str
    reasoning_summary: str | None = None
    pipeline_version: str = "ANNUAL_BENEFIT_PORTFOLIO_V1"
    pipeline_steps: list[PortfolioPipelineStep] = Field(default_factory=list)
    selection_strategy: str = "GREEDY_MAX_ANNUAL_BENEFIT"
    category_breakdown: list[PortfolioCategorySummary] = Field(default_factory=list)
    portfolio_items: list[PortfolioItem]
    excluded_items: list[PortfolioExcludedItem] = Field(default_factory=list)
