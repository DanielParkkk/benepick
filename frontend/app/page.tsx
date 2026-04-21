"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import {
  analyzeEligibility,
  INCOME_BAND_MAP,
  HOUSEHOLD_MAP,
  EMPLOYMENT_MAP,
  scoreColor,
  type PolicySummary,
  type AnalyzeResponse,
} from "../lib/api";

const AGE_OPTIONS = Array.from({ length: 48 }, (_, i) => `만 ${i + 18}세`).concat(["만 65세 이상"]);
const REGION_OPTIONS = [
  "서울특별시","부산광역시","대구광역시","인천광역시","광주광역시",
  "대전광역시","울산광역시","세종특별자치시","경기도","강원특별자치도",
  "충청북도","충청남도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도",
];
const INCOME_OPTIONS = [
  "중위소득 30% 이하","중위소득 30~40%","중위소득 40~50%","중위소득 50~60%",
  "중위소득 60~70%","중위소득 70~80%","중위소득 80~90%","중위소득 90~100%",
  "중위소득 100~120%","중위소득 120~150%","중위소득 150% 초과",
];
const FAMILY_OPTIONS = [
  "1인 가구","2인 가구","3인 가구","4인 이상 가구",
  "한부모 가구","다자녀 가구","다문화 가구","조손 가구","노인 단독 가구",
];
const EMPLOYMENT_OPTIONS = [
  "미취업","취업자 (정규직)","취업자 (비정규직/계약직)","자영업자",
  "구직자 (실업)","학생","육아휴직 중","무직",
];
const DISABILITY_OPTIONS = ["없음","장애 1~3급 (심한 장애)","장애 4~6급 (심하지 않은 장애)"];
const HOUSING_OPTIONS: Record<string, string> = {
  "1인 가구": "MONTHLY_RENT", "2인 가구": "MONTHLY_RENT",
  "3인 가구": "MONTHLY_RENT", "4인 이상 가구": "OWNER_FAMILY_HOME",
  "한부모 가구": "MONTHLY_RENT", "다자녀 가구": "OWNER_FAMILY_HOME",
  "다문화 가구": "MONTHLY_RENT", "조손 가구": "OWNER_FAMILY_HOME",
  "노인 단독 가구": "OWNER_FAMILY_HOME",
};
const INTEREST_TAG_OPTIONS = [
  { code: "housing", label: "주거" },
  { code: "finance", label: "금융" },
  { code: "employment", label: "취업" },
  { code: "medical", label: "의료" },
  { code: "education", label: "교육" },
];

const STATIC_POLICIES: PolicySummary[] = [
  {
    policy_id: "static-1", title: "청년 월세 한시 특별지원", description: "만 19~34세 · 월세 60만원 이하 · 독립 거주 청년",
    match_score: 92, score_level: "HIGH", apply_status: "APPLICABLE_NOW",
    benefit_amount: 2400000, benefit_amount_label: "연 240만원", benefit_summary: "월 최대 20만원",
    badge_items: ["✅ 조건 충족", "Gov24", "월 최대 20만원"], sort_order: 1,
  },
  {
    policy_id: "static-2", title: "국민내일배움카드", description: "실업자 · 이직 예정자 · 단기근로자 지원 직업훈련",
    match_score: 85, score_level: "HIGH", apply_status: "APPLICABLE_NOW",
    benefit_amount: 5000000, benefit_amount_label: "최대 500만원", benefit_summary: "훈련비 지원",
    badge_items: ["✅ 조건 충족", "고용부", "최대 500만원"], sort_order: 2,
  },
  {
    policy_id: "static-3", title: "청년도약계좌", description: "만 19~34세 · 개인소득 6,000만원 이하 · 5년 적립",
    match_score: 78, score_level: "MID", apply_status: "NEEDS_CHECK",
    benefit_amount: null, benefit_amount_label: "최대 5,000만원", benefit_summary: "정부기여금 포함",
    badge_items: ["⚡ 확인 필요", "금융위", "최대 5,000만원"], sort_order: 3,
  },
  {
    policy_id: "static-4", title: "청년 마음건강 지원사업", description: "만 19~34세 · 심리상담 바우처 · 연간 10회",
    match_score: 74, score_level: "MID", apply_status: "APPLICABLE_NOW",
    benefit_amount: 800000, benefit_amount_label: "연 80만원 상당", benefit_summary: "상담 10회",
    badge_items: ["✅ 조건 충족", "복지부", "10회 무료"], sort_order: 4,
  },
  {
    policy_id: "static-5", title: "청년창업사관학교", description: "만 39세 이하 · 창업 아이템 보유 · 사업계획서 필요",
    match_score: 41, score_level: "LOW", apply_status: "NEEDS_CHECK",
    benefit_amount: 100000000, benefit_amount_label: "최대 1억원", benefit_summary: "창업지원금",
    badge_items: ["⚠️ 조건 부족", "중기부", "최대 1억원"], sort_order: 5,
  },
];

const POLICY_ICONS: Record<string, string> = {
  "청년 월세": "🏠", "월세": "🏠", "주거": "🏠",
  "내일배움": "📚", "배움": "📚", "훈련": "📚",
  "취업": "💼", "고용": "💼", "창업": "🚀",
  "마음건강": "🏥", "건강": "🏥", "의료": "🏥",
  "도약계좌": "💰", "금융": "💰", "저축": "💰",
};

function getPolicyIcon(title: string) {
  for (const [key, icon] of Object.entries(POLICY_ICONS)) {
    if (title.includes(key)) return icon;
  }
  return "📋";
}

function PolicyCard({
  policy,
  onClick,
}: {
  policy: PolicySummary;
  onClick: () => void;
}) {
  const color = scoreColor(policy.match_score);
  const cardClass = color === "green" ? "top" : color === "blue" ? "mid" : "low";
  const icon = getPolicyIcon(policy.title);

  return (
    <div className={`policy-card ${cardClass}`} onClick={onClick}>
      <div className="policy-top-row">
        <div className="policy-left">
          <div className={`policy-icon ${color}`}>{icon}</div>
          <div className="policy-meta">
            <h4>{policy.title}</h4>
            <p>{policy.description}</p>
            <div className="policy-badges">
              {policy.badge_items.map((b, i) => (
                <span
                  key={i}
                  className={`badge ${
                    b.includes("✅") ? "badge-green"
                    : b.includes("⚠️") || b.includes("❌") ? "badge-orange"
                    : b.includes("⚡") ? "badge-blue"
                    : "badge-gray"
                  }`}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="policy-percent">
          <div className={`percent-num ${color}`}>
            {policy.match_score}
            <span style={{ fontSize: 18 }}>%</span>
          </div>
          <div className="percent-label">수급 확률</div>
        </div>
      </div>
      <div className="progress-row">
        <div className="progress-track">
          <div
            className={`progress-fill ${color}`}
            style={{ width: `${policy.match_score}%` }}
          />
        </div>
        <div className="benefit-chip">{policy.benefit_amount_label || policy.benefit_summary || "-"}</div>
      </div>
      <div className="policy-action">상세 분석 보기 →</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  // 폼 상태
  const [age, setAge] = useState("만 27세");
  const [region, setRegion] = useState("서울특별시");
  const [income, setIncome] = useState("중위소득 50~60%");
  const [family, setFamily] = useState("1인 가구");
  const [employment, setEmployment] = useState("미취업");
  const [disability, setDisability] = useState("없음");
  const [interestTags, setInterestTags] = useState<string[]>(["housing"]);

  // 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PolicySummary[]>([]);
  const [searchStatus, setSearchStatus] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // 분석
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [policies, setPolicies] = useState<PolicySummary[]>(STATIC_POLICIES);
  const [lastUpdated, setLastUpdated] = useState("오늘 오전 9:42");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 체크리스트
  const [checklist, setChecklist] = useState([
    { text: "신청자 정보 입력", done: true },
    { text: "소득 확인서 준비", done: true },
    { text: "신청서 작성", done: false },
    { text: "서류 제출", done: false },
    { text: "계좌 등록", done: false },
  ]);

  const toggleCheck = (i: number) => {
    setChecklist((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, done: !item.done } : item))
    );
  };

  const parseAge = (v: string) => {
    const m = v.match(/\d+/);
    return m ? parseInt(m[0]) : 27;
  };

  const toggleInterestTag = (code: string) => {
    setInterestTags((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const runAnalysis = async () => {
    setAnalysisError(null);
    setLoading(true);
    const now = new Date();
    setLastUpdated(`오늘 ${now.getHours()}시 ${now.getMinutes()}분`);

    try {
      const data = await analyzeEligibility({
        age: parseAge(age),
        region_code: region,
        region_name: region,
        income_band: INCOME_BAND_MAP[income] || "MID_50_60",
        household_type: HOUSEHOLD_MAP[family] || "SINGLE",
        employment_status: EMPLOYMENT_MAP[employment] || "UNEMPLOYED",
        housing_status: HOUSING_OPTIONS[family] || "MONTHLY_RENT",
        interest_tags: interestTags,
      });
      setAnalysisResult(data);
      setPolicies(data.policies);
    } catch (err) {
      console.warn("분석 API 오류, 기본 데이터 사용:", err);
      const message =
        err instanceof Error
          ? err.message
          : "분석 요청 중 오류가 발생했습니다. 기본 추천 결과를 표시합니다.";
      setAnalysisError(message);
    } finally {
      setLoading(false);
    }
  };

  const doDashSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setShowSearch(true);
    setSearchStatus("검색 중...");

    try {
      const { searchPolicies } = await import("../lib/api");
      const data = await searchPolicies(searchQuery);
      setSearchResults(data.items);
      setSearchStatus(`"${searchQuery}" 검색 결과 ${data.items.length}건`);
    } catch {
      // 로컬 검색으로 폴백
      const filtered = STATIC_POLICIES.filter(
        (p) =>
          p.title.includes(searchQuery) ||
          (p.description || "").includes(searchQuery)
      );
      setSearchResults(filtered);
      setSearchStatus(`"${searchQuery}" 검색 결과 ${filtered.length}건 (로컬)`);
    } finally {
      setSearchLoading(false);
    }
  };

  const avgScore = policies.length
    ? Math.round(policies.reduce((s, p) => s + p.match_score, 0) / policies.length)
    : 87;
  const totalBenefit = policies.reduce((s, p) => s + (p.benefit_amount || 0), 0);
  const totalBenefitLabel =
    totalBenefit >= 10000000
      ? `${Math.round(totalBenefit / 10000).toLocaleString()}만원`
      : totalBenefit > 0
      ? `${totalBenefit.toLocaleString()}원`
      : "1,040만원";

  const navigateToDetail = (policyId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("benepick_detail_id", policyId);
    }
    router.push("/analysis");
  };

  return (
    <>
      {loading && (
        <div className="ai-loading show">
          <div className="ai-loading-card">
            <div className="ai-spinner" />
            <div className="ai-loading-text">
              <h3>AI 분석 중입니다...</h3>
              <p>
                입력하신 조건으로
                <br />
                수급 가능성을 계산하고 있어요
              </p>
              <br />
              <div className="ai-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      )}

      <Navbar />

      <div className="container">
        <div className="screen active">
          {/* 검색 바 */}
          <div className="dash-search-bar" style={{ marginBottom: 24 }}>
            <span className="dash-search-label">🔍 검색</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doDashSearch()}
              placeholder="정책명, 키워드, 또는 문장으로 검색 (예: 청년 월세, 취업 후 생계 지원)"
            />
            <button
              className="btn-primary"
              onClick={doDashSearch}
              style={{ flex: "none", padding: "10px 20px" }}
            >
              검색
            </button>
          </div>

          {/* 검색 결과 */}
          {showSearch && (
            <div
              id="dash-search-results-wrap"
              className="visible"
              style={{ marginBottom: 24 }}
            >
              <div className="dash-search-results-header">
                <h3>🔎 검색 결과</h3>
                <button
                  className="dash-search-close-btn"
                  onClick={() => setShowSearch(false)}
                >
                  ✕ 닫기
                </button>
              </div>
              <div id="dash-search-status" style={{ marginBottom: 10 }}>
                {searchLoading ? "검색 중..." : searchStatus}
              </div>
              <div>
                {searchResults.map((p) => (
                  <PolicyCard
                    key={p.policy_id}
                    policy={p}
                    onClick={() => navigateToDetail(p.policy_id)}
                  />
                ))}
                {!searchLoading && searchResults.length === 0 && (
                  <p style={{ color: "var(--gray-500)", fontSize: 13 }}>
                    검색 결과가 없습니다.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid-main">
            {/* 왼쪽 컬럼 */}
            <div>
              {/* 프로필 카드 */}
              <div className="profile-card">
                <div className="profile-header">
                  <div className="profile-user">
                    <div className="profile-avatar">남</div>
                    <div className="profile-info">
                      <h2>
                        {analysisResult
                          ? "나의 복지 분석 결과"
                          : "남정현님의 복지 분석"}
                      </h2>
                      <p>
                        마지막 업데이트: {lastUpdated} · {region}
                      </p>
                    </div>
                  </div>
                  <div className="score-badge">
                    <div className="score-label">종합 수급 점수</div>
                    <div className="score-num">
                      {analysisResult?.profile_summary.analysis_score ?? avgScore}
                    </div>
                    <div className="score-sub">/ 100점</div>
                  </div>
                </div>
                <div className="profile-tags">
                  <span className="profile-tag">📅 {age}</span>
                  <span className="profile-tag">📍 {region}</span>
                  <span className="profile-tag">💰 {income}</span>
                  <span className="profile-tag">🏠 {family}</span>
                  <span className="profile-tag">👔 {employment}</span>
                  {disability !== "없음" && (
                    <span className="profile-tag">♿ 장애인</span>
                  )}
                  {interestTags.map((code) => {
                    const found = INTEREST_TAG_OPTIONS.find((item) => item.code === code);
                    if (!found) return null;
                    return (
                      <span key={code} className="profile-tag">⭐ {found.label}</span>
                    );
                  })}
                </div>
              </div>

              {/* 조건 입력 카드 */}
              <div className="input-card">
                <div className="input-card-header">
                  <h3>🎯 조건 입력으로 정확도 높이기</h3>
                  <span className="ai-chip">🤖 AI 분석</span>
                </div>
                <div className="input-grid">
                  <div className="input-item">
                    <label>연령</label>
                    <select value={age} onChange={(e) => setAge(e.target.value)}>
                      {AGE_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-item">
                    <label>지역</label>
                    <select value={region} onChange={(e) => setRegion(e.target.value)}>
                      {REGION_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-item">
                    <label>소득 수준</label>
                    <select value={income} onChange={(e) => setIncome(e.target.value)}>
                      {INCOME_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-item">
                    <label>가구 유형</label>
                    <select value={family} onChange={(e) => setFamily(e.target.value)}>
                      {FAMILY_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-item">
                    <label>취업 상태</label>
                    <select value={employment} onChange={(e) => setEmployment(e.target.value)}>
                      {EMPLOYMENT_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-item">
                    <label>장애 여부</label>
                    <select value={disability} onChange={(e) => setDisability(e.target.value)}>
                      {DISABILITY_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 12, marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    관심 분야 (최대 3개 권장)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {INTEREST_TAG_OPTIONS.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => toggleInterestTag(item.code)}
                        style={{
                          borderRadius: 999,
                          padding: "6px 12px",
                          border: interestTags.includes(item.code) ? "1px solid var(--blue)" : "1px solid var(--gray-200)",
                          background: interestTags.includes(item.code) ? "rgba(37,99,235,.10)" : "#fff",
                          color: interestTags.includes(item.code) ? "var(--blue)" : "var(--gray-700)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="analyze-btn" onClick={runAnalysis} disabled={loading}>
                  {loading ? "⏳ 분석 중..." : "🔍 수급 가능성 AI 분석 시작하기"}
                </button>
                {analysisError && (
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: "#B42318",
                      background: "rgba(217, 45, 32, 0.08)",
                      border: "1px solid rgba(217, 45, 32, 0.25)",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    {analysisError}
                  </p>
                )}
              </div>

              {/* RAG 답변 */}
              {analysisResult?.rag_answer && (
                <div
                  style={{
                    background: "#FFFBEA",
                    border: "1.5px solid rgba(245,175,0,.45)",
                    borderRadius: "var(--radius)",
                    padding: "16px 20px",
                    marginBottom: 24,
                    fontSize: 14,
                    color: "#2D2200",
                    lineHeight: 1.7,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                    🤖 AI 분석 요약
                  </div>
                  {analysisResult.rag_answer}
                </div>
              )}

              {/* 정책 스코어링 목록 */}
              <div>
                <div className="section-title">
                  <h3>
                    📈 수급 가능성 스코어링{" "}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-500)" }}>
                      (높은 순)
                    </span>
                  </h3>
                  <Link href="/search" style={{ fontSize: 13, color: "var(--blue)", textDecoration: "none", fontWeight: 600 }}>
                    전체보기 →
                  </Link>
                </div>

                <div className="policy-list">
                  {policies.slice(0, 2).map((p) => (
                    <PolicyCard
                      key={p.policy_id}
                      policy={p}
                      onClick={() => navigateToDetail(p.policy_id)}
                    />
                  ))}

                  {/* 인라인 광고 */}
                  <div className="inline-ad">
                    <div className="inline-ad-icon">🏦</div>
                    <div className="inline-ad-text">
                      <span className="ad-badge">AD</span>
                      <h5>카카오뱅크 청년 전세 대출</h5>
                      <p>연 2.1%부터 · 최대 2억원 · 5분 비대면 신청</p>
                    </div>
                    <div className="inline-ad-arrow">›</div>
                  </div>

                  {policies.slice(2).map((p) => (
                    <PolicyCard
                      key={p.policy_id}
                      policy={p}
                      onClick={() => navigateToDetail(p.policy_id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 오른쪽 사이드바 */}
            <div className="sidebar">
              {/* 수급 현황 */}
              <div className="sidebar-card">
                <h4>📊 나의 수급 현황</h4>
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="val green">{policies.length}</div>
                    <div className="lbl">해당 정책 수</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">{avgScore}%</div>
                    <div className="lbl">평균 확률</div>
                  </div>
                  <div className="stat-item">
                    <div className="val green">
                      {totalBenefitLabel}
                    </div>
                    <div className="lbl">예상 수혜액</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">
                      {policies.filter((p) => p.apply_status === "APPLICABLE_NOW").length}
                    </div>
                    <div className="lbl">즉시 신청 가능</div>
                  </div>
                </div>
              </div>

              {/* 추천 포트폴리오 */}
              <div className="sidebar-card">
                <h4>💼 추천 포트폴리오</h4>
                <div className="portfolio-total">
                  <div className="amount">{totalBenefitLabel}</div>
                  <div className="lbl">총 예상 연간 수혜액</div>
                </div>
                <div className="portfolio-items">
                  {policies.slice(0, 4).map((p) => (
                    <div className="port-item" key={p.policy_id}>
                      <span className="name">
                        {getPolicyIcon(p.title)} {p.title.substring(0, 10)}
                        {p.title.length > 10 ? "..." : ""}
                      </span>
                      <span className="amt">{p.benefit_amount_label || "-"}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/portfolio"
                  className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", padding: 10 }}
                >
                  💼 포트폴리오 전체 보기 →
                </Link>
              </div>

              {/* 신청 체크리스트 */}
              <div className="sidebar-card">
                <h4>✅ 신청 체크리스트</h4>
                <div className="checklist">
                  {checklist.map((item, i) => (
                    <div
                      key={i}
                      className={`check-item${item.done ? " done" : ""}`}
                      onClick={() => toggleCheck(i)}
                    >
                      <div className="check-box">{item.done ? "✓" : ""}</div>
                      <span className="check-text">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 맞춤 추천 서비스 */}
              <div className="sidebar-card">
                <h4>🎯 맞춤 추천 서비스</h4>
                <div className="rec-cards">
                  {[
                    { icon: "🏦", name: "청년 전세 대출", desc: "연 2.1%부터" },
                    { icon: "📱", name: "토스 청년 적금", desc: "연 6% 특판" },
                    { icon: "📖", name: "클래스101", desc: "배움카드 사용가" },
                    { icon: "🧘", name: "마인드카페", desc: "심리상담 앱" },
                  ].map((r) => (
                    <div className="rec-card" key={r.name}>
                      <div className="icon">{r.icon}</div>
                      <div className="name">{r.name}</div>
                      <div className="desc">{r.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
