"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { getPolicyDetail, scoreColor } from "../../lib/api";

interface DetailData {
  policy_id: string;
  title: string;
  description: string;
  match_score: number;
  score_level: string;
  apply_status: string;
  eligibility_summary: string;
  blocking_reasons: string[];
  recommended_actions: string[];
  required_documents: { document_name: string; is_required: boolean; description: string | null }[];
  application_url: string | null;
  managing_agency: string | null;
  benefit_summary: string | null;
}

// 정적 fallback 데이터 (백엔드 없을 때)
const STATIC_DETAIL: Record<string, Partial<DetailData>> = {
  "static-1": {
    title: "청년 월세 한시 특별지원", match_score: 92,
    eligibility_summary: "만 19~34세 무주택 청년으로 부모와 별도 거주, 월세 60만원 이하, 중위소득 60% 이하인 경우 지원 가능합니다.",
    blocking_reasons: ["주민등록 전입 미완료: 현재 거주지 주민등록이 신청 주소와 일치하지 않을 수 있습니다.", "임대차 계약서 미비: 월세 계약 기간이 남은 계약서 원본 및 확정일자 필요합니다."],
    recommended_actions: ["1단계: 전입신고 완료하기 — 거주지 주민센터를 방문하여 현 주소로 전입신고를 진행하세요.", "2단계: 임대차 계약서 확인 — 계약서에 확정일자 도장이 찍혀 있는지 확인하세요.", "3단계: 복지로에서 온라인 신청 — bokjiro.go.kr에서 신청서를 제출하세요."],
    benefit_summary: "월 최대 20만원, 최대 12개월",
    managing_agency: "국토교통부",
  },
  "static-2": {
    title: "국민내일배움카드", match_score: 85,
    eligibility_summary: "실업자, 이직 예정자, 비정규직, 단기근로자, 자영업자 등 훈련이 필요한 국민이라면 누구나 신청 가능합니다.",
    blocking_reasons: ["재직자 소득 기준 확인 필요: 연 소득 5,000만원 초과 대기업 재직자는 지원 대상에서 제외됩니다.", "훈련 기관 선택 필요: 지정된 직업훈련기관에서만 카드 사용이 가능합니다."],
    recommended_actions: ["1단계: 고용24 회원가입 — work24.go.kr에서 회원가입 후 신청 페이지로 이동하세요.", "2단계: 수강 희망 과정 선택 — 직업훈련포털에서 훈련과정을 미리 검색해두세요.", "3단계: 카드 신청 및 발급 — 국민은행 또는 우리은행으로 발급됩니다."],
    benefit_summary: "훈련비 최대 500만원",
    managing_agency: "고용노동부",
  },
};

const POLICY_ICONS: Record<string, string> = {
  "청년 월세": "🏠", "월세": "🏠", "주거": "🏠",
  "내일배움": "📚", "배움": "📚", "훈련": "📚",
  "취업": "💼", "고용": "💼", "창업": "🚀",
  "마음건강": "🏥", "건강": "🏥", "의료": "🏥",
  "도약계좌": "💰", "금융": "💰",
};

function getPolicyIcon(title: string) {
  for (const [key, icon] of Object.entries(POLICY_ICONS)) {
    if (title.includes(key)) return icon;
  }
  return "📋";
}

export default function AnalysisPage() {
  const [detail, setDetail] = useState<Partial<DetailData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [policyId, setPolicyId] = useState<string | null>(null);

  useEffect(() => {
    const id =
      typeof window !== "undefined"
        ? localStorage.getItem("benepick_detail_id")
        : null;
    setPolicyId(id);

    const load = async () => {
      if (!id) { setLoading(false); return; }

      // 정적 데이터 우선 (static-x)
      if (id.startsWith("static-") && STATIC_DETAIL[id]) {
        setDetail(STATIC_DETAIL[id]);
        setLoading(false);
        return;
      }

      try {
        const data = await getPolicyDetail(id);
        setDetail(data);
      } catch {
        // API 실패 시 정적 fallback
        const first = Object.values(STATIC_DETAIL)[0];
        setDetail(first);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const score = detail?.match_score ?? 92;
  const color = scoreColor(score);
  const icon = detail?.title ? getPolicyIcon(detail.title) : "🏠";

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="screen active">
          <div className="grid-main">
            <div>
              {/* 뒤로가기 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <Link
                  href="/"
                  style={{
                    background: "var(--gray-100)", border: "none", borderRadius: 8,
                    padding: "8px 14px", fontSize: 13, fontWeight: 600,
                    color: "var(--gray-700)", cursor: "pointer", textDecoration: "none",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  ← 목록으로
                </Link>
                <span style={{ fontSize: 14, color: "var(--gray-500)" }}>/ 상세 분석</span>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--gray-500)" }}>
                  <div className="ai-spinner" style={{ margin: "0 auto 16px" }} />
                  <p>분석 데이터를 불러오는 중...</p>
                </div>
              ) : !detail ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--gray-500)" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>분석할 정책을 선택하세요</h3>
                  <p>대시보드나 검색 페이지에서 정책을 클릭해 상세 분석을 확인하세요.</p>
                  <Link href="/" className="btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>
                    대시보드로 →
                  </Link>
                </div>
              ) : (
                <div className="detail-panel visible">
                  {/* 헤더 */}
                  <div className="detail-header">
                    <div className="detail-icon">{icon}</div>
                    <div className="detail-title" style={{ flex: 1 }}>
                      <h3>{detail.title}</h3>
                      <div className="detail-prob">
                        <span className="pct" style={{ color: `var(--${color})` }}>{score}</span>
                        <span style={{ fontSize: 28, fontWeight: 800, color: `var(--${color})` }}>%</span>
                        <span className="label">수급 확률</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div className="progress-track" style={{ height: 10 }}>
                          <div className={`progress-fill ${color}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI 요약 박스 */}
                  {detail.eligibility_summary && (
                    <div className="ai-summary-box">
                      <div className="ai-summary-box-header">
                        <div className="ai-summary-badge">📄 AI 분석 요약</div>
                      </div>
                      <div className="ai-summary-row">
                        <span className="ai-summary-icon">📌</span>
                        <div className="ai-summary-excerpt">{detail.eligibility_summary}</div>
                      </div>
                    </div>
                  )}

                  {/* 탈락 예상 이유 */}
                  <div className="analysis-section">
                    <div className="analysis-label">❌ 탈락 예상 이유</div>
                    {detail.blocking_reasons && detail.blocking_reasons.length > 0 ? (
                      detail.blocking_reasons.map((r, i) => (
                        <div className="issue-item" key={i}>
                          <span className="icon">⚠️</span>
                          <p>{r}</p>
                        </div>
                      ))
                    ) : (
                      <div className="issue-item">
                        <span className="icon">✅</span>
                        <p><strong>탈락 사유 없음</strong> — 조건 충족</p>
                      </div>
                    )}
                  </div>

                  {/* 행동 가이드 */}
                  <div className="analysis-section">
                    <div className="analysis-label">💡 해결 방법 &amp; 행동 가이드</div>
                    {detail.recommended_actions?.map((a, i) => (
                      <div className="guide-item" key={i}>
                        <span className="icon">
                          {i === 0 ? "✅" : i === 1 ? "📎" : "🚀"}
                        </span>
                        <p>{a}</p>
                      </div>
                    ))}
                  </div>

                  {/* 필요 서류 */}
                  {detail.required_documents && detail.required_documents.length > 0 && (
                    <div className="analysis-section">
                      <div className="analysis-label">📋 필요 서류</div>
                      {detail.required_documents.map((doc, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", background: "var(--gray-50)",
                            borderRadius: "var(--radius-sm)", marginBottom: 8,
                            border: "1px solid var(--gray-100)",
                          }}
                        >
                          <span>{doc.is_required ? "🔴" : "⚪"}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>
                            {doc.document_name}
                          </span>
                          {doc.description && (
                            <span style={{ fontSize: 11, color: "var(--gray-500)", marginLeft: 8 }}>
                              {doc.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <Link
                      href="/apply"
                      className="btn-primary btn-green"
                      style={{ flex: 1, padding: 12, fontSize: 14, justifyContent: "center" }}
                    >
                      📋 신청 보조 시작하기 →
                    </Link>
                    <Link
                      href="/"
                      className="btn-primary"
                      style={{ background: "var(--gray-100)", color: "var(--gray-700)", padding: "12px 16px" }}
                    >
                      목록
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 사이드바 */}
            <div className="sidebar">
              <div className="sidebar-card">
                <h4>📊 이 정책 요약</h4>
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className={`val ${color}`}>{score}%</div>
                    <div className="lbl">수급 확률</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">{detail?.benefit_summary?.substring(0, 6) || "-"}</div>
                    <div className="lbl">연간 혜택</div>
                  </div>
                  <div className="stat-item">
                    <div className="val green">1개월</div>
                    <div className="lbl">처리 기간</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">{detail?.blocking_reasons?.length ?? 0}건</div>
                    <div className="lbl">해결 필요</div>
                  </div>
                </div>
                {detail?.managing_agency && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--gray-500)" }}>
                    소관 기관: {detail.managing_agency}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
