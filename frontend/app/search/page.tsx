"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { searchPolicies, scoreColor, type PolicySummary } from "../../lib/api";

const QUICK_TAGS = [
  "청년 월세", "실업급여", "기초연금", "내일배움카드",
  "한부모 지원", "장애인 활동지원", "긴급복지",
];

function SearchPolicyCard({
  policy,
  onClick,
}: {
  policy: PolicySummary;
  onClick: () => void;
}) {
  const color = scoreColor(policy.match_score);
  const badgeClass = (b: string) =>
    b.includes("✅") ? "badge-green"
    : b.includes("⚠️") || b.includes("❌") ? "badge-orange"
    : b.includes("⚡") ? "badge-blue"
    : "badge-gray";

  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--gray-200)",
        borderRadius: "var(--radius)",
        padding: "18px 22px",
        marginBottom: 12,
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        transition: "all .2s",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--blue)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--gray-200)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-900)", marginBottom: 4 }}>
            {policy.title}
          </h4>
          <p style={{ fontSize: 12, color: "var(--gray-500)" }}>{policy.description}</p>
          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            {policy.badge_items.map((b, i) => (
              <span key={i} className={`badge ${badgeClass(b)}`}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div className={`percent-num ${color}`} style={{ fontSize: 22 }}>
            {policy.match_score}
            <span style={{ fontSize: 14 }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--gray-500)", marginTop: 2 }}>수급 확률</div>
        </div>
      </div>
      <div className="progress-row">
        <div className="progress-track">
          <div className={`progress-fill ${color}`} style={{ width: `${policy.match_score}%` }} />
        </div>
        <div className="benefit-chip">{policy.benefit_amount_label || policy.benefit_summary || "-"}</div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PolicySummary[]>([]);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q?: string) => {
    const searchQ = q ?? query;
    if (!searchQ.trim()) return;
    setLoading(true);
    setSearched(true);
    setStatus("검색 중...");
    setRagAnswer(null);

    try {
      const data = await searchPolicies(searchQ, 20);
      setResults(data.items);
      setRagAnswer(data.rag_answer);
      setStatus(`"${searchQ}" 검색 결과 ${data.total_count}건`);
    } catch {
      setStatus(`"${searchQ}" — 서버 연결 실패`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToDetail = (policyId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("benepick_detail_id", policyId);
    }
    router.push("/analysis");
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="screen active">
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "8px 0 40px" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-900)", marginBottom: 6 }}>
                🔍 정책 통합 검색
              </h2>
              <p style={{ fontSize: 14, color: "var(--gray-500)" }}>
                키워드 검색 또는 자연어로 원하는 복지 정책을 찾아보세요.
              </p>
            </div>

            {/* 검색 박스 */}
            <div
              style={{
                background: "var(--white)", border: "1px solid var(--gray-200)",
                borderRadius: "var(--radius)", padding: 20,
                boxShadow: "var(--shadow-sm)", marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="예: 청년 월세, 취업 후 생계 지원, 장애인 활동지원 받고 싶어요"
                  style={{
                    flex: 1, border: "1px solid var(--gray-200)", borderRadius: 10,
                    padding: "12px 16px", fontSize: 14, fontFamily: "inherit",
                    outline: "none", background: "var(--gray-50)", color: "var(--gray-900)",
                  }}
                />
                <button
                  onClick={() => doSearch()}
                  style={{
                    background: "linear-gradient(135deg,var(--blue),var(--blue-dark))",
                    color: "#fff", border: "none", borderRadius: 10,
                    padding: "12px 24px", fontSize: 14, fontWeight: 700,
                    fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(74,144,226,.3)",
                  }}
                >
                  🔍 검색
                </button>
              </div>

              {/* 빠른 검색 태그 */}
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--gray-500)", fontWeight: 600 }}>빠른 검색:</span>
                {QUICK_TAGS.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => { setQuery(tag); doSearch(tag); }}
                    style={{
                      padding: "4px 12px", background: "var(--gray-100)",
                      borderRadius: 20, fontSize: 12, fontWeight: 600,
                      color: "var(--gray-700)", cursor: "pointer",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 상태 */}
            <div style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 12, minHeight: 18 }}>
              {loading ? "검색 중..." : status}
            </div>

            {/* RAG 답변 */}
            {ragAnswer && (
              <div
                style={{
                  background: "#FFFBEA", border: "1.5px solid rgba(245,175,0,.45)",
                  borderRadius: "var(--radius)", padding: "16px 20px",
                  marginBottom: 20, fontSize: 14, color: "#2D2200", lineHeight: 1.7,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>🤖 AI 검색 요약</div>
                {ragAnswer}
              </div>
            )}

            {/* 검색 결과 */}
            {searched && (
              <div>
                {results.length === 0 && !loading ? (
                  <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--gray-500)" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                    <p>검색 결과가 없습니다. 다른 키워드로 검색해 보세요.</p>
                  </div>
                ) : (
                  results.map((p) => (
                    <SearchPolicyCard
                      key={p.policy_id}
                      policy={p}
                      onClick={() => navigateToDetail(p.policy_id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
