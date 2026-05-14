const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const ANALYZE_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_ANALYZE_TIMEOUT_MS || 65000);

// ── 소득 구간 매핑 ──────────────────────────────────────────────
export const INCOME_BAND_MAP: Record<string, string> = {
  "중위소득 30% 이하":   "MID_50_60",
  "중위소득 30~40%":     "MID_50_60",
  "중위소득 40~50%":     "MID_50_60",
  "중위소득 50~60%":     "MID_50_60",
  "중위소득 60~70%":     "MID_60_80",
  "중위소득 70~80%":     "MID_60_80",
  "중위소득 80~90%":     "MID_80_100",
  "중위소득 90~100%":    "MID_80_100",
  "중위소득 100~120%":   "MID_80_100",
  "중위소득 120~150%":   "MID_80_100",
  "중위소득 150% 초과":  "MID_80_100",
};

export const HOUSEHOLD_MAP: Record<string, string> = {
  "1인 가구":         "SINGLE",
  "2인 가구":         "TWO_PERSON",
  "3인 가구":         "MULTI_PERSON",
  "4인 이상 가구":    "MULTI_PERSON",
  "한부모 가구":      "TWO_PERSON",
  "다자녀 가구":      "MULTI_PERSON",
  "다문화 가구":      "MULTI_PERSON",
  "조손 가구":        "TWO_PERSON",
  "노인 단독 가구":   "SINGLE",
};

export const EMPLOYMENT_MAP: Record<string, string> = {
  "미취업":                   "UNEMPLOYED",
  "취업자 (정규직)":          "EMPLOYED",
  "취업자 (비정규직/계약직)": "EMPLOYED",
  "자영업자":                 "SELF_EMPLOYED",
  "구직자 (실업)":            "UNEMPLOYED",
  "학생":                     "UNEMPLOYED",
  "육아휴직 중":              "EMPLOYED",
  "무직":                     "UNEMPLOYED",
};

export interface AnalyzeRequest {
  age: number;
  region_code: string;
  region_name: string;
  income_band: string;
  household_type: string;
  employment_status: string;
  housing_status: string;
  interest_tags?: string[];
  lang_code?: string;
}

export interface PolicySummary {
  policy_id: string;
  title: string;
  description: string | null;
  match_score: number;
  score_level: string;
  apply_status: string;
  benefit_amount: number | null;
  benefit_amount_label: string | null;
  benefit_summary: string | null;
  badge_items: string[];
  sort_order: number;
}

export interface AnalyzeResponse {
  profile_summary: { analysis_score: number; tags: string[] };
  policies: PolicySummary[];
  rag_answer: string | null;
  rag_docs_used: string[];
  rag_confidence_level: string | null;
  rag_confidence_score: number | null;
  rag_confidence_reason: string | null;
  rag_top_policy_candidates: string[];
  rag_needs_confirmation: boolean;
  unmatched_policies: { reference_id: string; source: string | null }[];
}

export interface SearchResponse {
  items: PolicySummary[];
  query: string;
  total_count: number;
  rag_answer: string | null;
  rag_docs_used: string[];
  rag_confidence_level: string | null;
  rag_confidence_score: number | null;
  rag_confidence_reason: string | null;
  rag_top_policy_candidates: string[];
  rag_needs_confirmation: boolean;
  unmatched_policies: { reference_id: string; source: string | null }[];
}

export interface CommunityPost {
  id: number;
  category: string;
  title: string;
  content: string;
  author_name?: string;
  author_masked?: boolean;
  region_text: string | null;
  like_count: number;
  view_count?: number;
  is_liked_by_me?: boolean;
  created_at: string;
}

// ── 헬스체크 ────────────────────────────────────────────────────
let _backendAvailable: boolean | null = null;
export async function checkBackend(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

// ── 수급 가능성 AI 분석 ─────────────────────────────────────────
export async function analyzeEligibility(req: AnalyzeRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  const activeLang =
    req.lang_code ||
    (typeof window !== "undefined" ? localStorage.getItem("benefic_lang") || "ko" : "ko");
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/eligibility/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, lang_code: activeLang }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("분석 요청 시간이 초과되었습니다. 기본 추천 결과로 전환합니다.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error(`분석 실패: ${res.status}`);
  const json = await res.json();
  return json.data as AnalyzeResponse;
}

// ── 정책 검색 ───────────────────────────────────────────────────
export async function searchPolicies(q: string, size = 20, lang = "ko") {
  const params = new URLSearchParams({ q, size: String(size), lang });
  const res = await fetch(`${API_BASE}/api/v1/policies/search?${params}`);
  if (!res.ok) throw new Error(`검색 실패: ${res.status}`);
  const json = await res.json();
  return json.data as SearchResponse;
}

// ── 정책 상세 ───────────────────────────────────────────────────
export async function getPolicyDetail(policyId: string, lang = "ko") {
  const res = await fetch(
    `${API_BASE}/api/v1/policies/${policyId}/detail?lang=${lang}`
  );
  if (!res.ok) throw new Error(`상세 조회 실패: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ── 포트폴리오 ─────────────────────────────────────────────────
export async function getPortfolio() {
  const res = await fetch(`${API_BASE}/api/v1/portfolio`);
  if (!res.ok) throw new Error(`포트폴리오 조회 실패: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ── 커뮤니티 게시글 ────────────────────────────────────────────
export async function getCommunityPosts(
  category = "all",
  sort = "latest",
  page = 1,
  size = 20
) {
  const params = new URLSearchParams({
    category, sort, page: String(page), size: String(size),
  });
  const res = await fetch(`${API_BASE}/api/v1/community/posts?${params}`);
  if (!res.ok) throw new Error(`게시글 조회 실패: ${res.status}`);
  const json = await res.json();
  return json.data as { items: CommunityPost[]; total_count: number };
}

export async function createCommunityPost(
  category: string, title: string, content: string, regionText?: string
) {
  const res = await fetch(`${API_BASE}/api/v1/community/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, title, content, region_text: regionText }),
  });
  if (!res.ok) throw new Error(`게시글 등록 실패: ${res.status}`);
  const json = await res.json();
  return json.data as CommunityPost;
}

export async function likePost(postId: number) {
  const res = await fetch(`${API_BASE}/api/v1/community/posts/${postId}/like`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`좋아요 실패: ${res.status}`);
  return (await res.json()).data;
}

export async function getHotPosts() {
  const res = await fetch(`${API_BASE}/api/v1/community/hot-posts`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data as CommunityPost[];
}

// ── 점수 레벨 → CSS 클래스 ──────────────────────────────────────
export function scoreClass(score: number) {
  if (score >= 85) return "high";
  if (score >= 65) return "mid";
  return "low";
}

export function scoreColor(score: number) {
  if (score >= 85) return "green";
  if (score >= 65) return "blue";
  return "orange";
}
