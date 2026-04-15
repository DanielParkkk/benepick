"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { getPortfolio } from "../../lib/api";

interface PortfolioItem {
  policy_id: string;
  title: string;
  amount: number | null;
  amount_label: string | null;
  period_label: string | null;
  apply_status: string;
  source: string | null;
  managing_agency: string | null;
  benefit_summary: string | null;
  application_url: string | null;
  tags: { tag_type: string; tag_code: string; tag_label: string }[];
  sort_order: number;
}

interface PortfolioData {
  total_estimated_benefit_amount: number;
  total_estimated_benefit_label: string;
  selected_policy_count: number;
  applicable_now_count: number;
  needs_check_count: number;
  portfolio_items: PortfolioItem[];
}

const STATIC_PORTFOLIO: PortfolioData = {
  total_estimated_benefit_amount: 10400000,
  total_estimated_benefit_label: "1,040만원",
  selected_policy_count: 5,
  applicable_now_count: 3,
  needs_check_count: 2,
  portfolio_items: [
    { policy_id: "s1", title: "청년 월세 특별지원", amount: 2400000, amount_label: "240만원", period_label: "월 20만원 × 12개월", apply_status: "APPLICABLE_NOW", source: "bokjiro", managing_agency: "국토교통부", benefit_summary: "월세 지원", application_url: "https://bokjiro.go.kr", tags: [], sort_order: 1 },
    { policy_id: "s2", title: "국민내일배움카드", amount: 5000000, amount_label: "500만원", period_label: "훈련비 전액 지원", apply_status: "APPLICABLE_NOW", source: "gov24", managing_agency: "고용노동부", benefit_summary: "훈련비 지원", application_url: "https://work24.go.kr", tags: [], sort_order: 2 },
    { policy_id: "s3", title: "청년 마음건강 지원", amount: 800000, amount_label: "80만원", period_label: "상담 10회 × 8만원", apply_status: "APPLICABLE_NOW", source: "bokjiro", managing_agency: "보건복지부", benefit_summary: "심리상담", application_url: null, tags: [], sort_order: 3 },
    { policy_id: "s4", title: "청년도약계좌", amount: 700000, amount_label: "70만원/년", period_label: "정부기여금 포함", apply_status: "NEEDS_CHECK", source: "gov24", managing_agency: "금융위원회", benefit_summary: "저축 지원", application_url: null, tags: [], sort_order: 4 },
    { policy_id: "s5", title: "청년 취업아카데미", amount: 1500000, amount_label: "150만원", period_label: "교육비 + 수당", apply_status: "NEEDS_CHECK", source: "gov24", managing_agency: "고용노동부", benefit_summary: "취업교육", application_url: null, tags: [], sort_order: 5 },
  ],
};

const ICONS: Record<string, string> = {
  "월세": "🏠", "주거": "🏠", "배움카드": "📚", "배움": "📚",
  "마음건강": "🏥", "도약계좌": "💰", "저축": "💰", "취업아카데미": "🎓",
};

function getIcon(title: string) {
  for (const [k, v] of Object.entries(ICONS)) {
    if (title.includes(k)) return v;
  }
  return "📋";
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData>(STATIC_PORTFOLIO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPortfolio()
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="screen active">
          {/* Hero */}
          <div className="portfolio-hero">
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.5)", marginBottom: 8, fontWeight: 600, letterSpacing: ".5px", textTransform: "uppercase" }}>
                총 예상 연간 수혜액
              </p>
              <div className="big-num">{data.total_estimated_benefit_label}</div>
              <p>최적 조합 {data.selected_policy_count}개 정책 기준 · 남정현님 맞춤 분석</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
                <span style={{ background: "rgba(46,204,113,.2)", border: "1px solid rgba(46,204,113,.3)", color: "var(--green)", fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20 }}>
                  ✅ 즉시 신청 가능 {data.applicable_now_count}건
                </span>
                <span style={{ background: "rgba(74,144,226,.2)", border: "1px solid rgba(74,144,226,.3)", color: "#7EC8E3", fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20 }}>
                  ⚡ 조건 보완 후 {data.needs_check_count}건
                </span>
              </div>
            </div>
          </div>

          {/* 포트폴리오 그리드 */}
          <div className="section-title">
            <h3>💼 최적 복지 포트폴리오</h3>
            <a href="#" style={{ fontSize: 13, color: "var(--blue)", textDecoration: "none", fontWeight: 600 }}>
              정책 추가하기 +
            </a>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="ai-spinner" style={{ margin: "0 auto" }} />
            </div>
          ) : (
            <div className="port-grid">
              {data.portfolio_items.map((item) => (
                <div className="port-grid-card" key={item.policy_id}>
                  <div className="icon">{getIcon(item.title)}</div>
                  <h4>{item.title}</h4>
                  <div className="amount">{item.amount_label}</div>
                  <div className="period">{item.period_label}</div>
                  <div style={{ marginTop: 10 }}>
                    <span className={`badge ${item.apply_status === "APPLICABLE_NOW" ? "badge-green" : "badge-blue"}`}>
                      {item.apply_status === "APPLICABLE_NOW" ? "즉시 신청" : "조건 확인 필요"}
                    </span>
                  </div>
                  {item.application_url && (
                    <a
                      href={item.application_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--blue)", textDecoration: "none", fontWeight: 600 }}
                    >
                      🔗 신청 바로가기 →
                    </a>
                  )}
                </div>
              ))}

              {/* 추가 카드 */}
              <div
                className="port-grid-card"
                style={{ background: "var(--gray-50)", borderStyle: "dashed", cursor: "pointer" }}
              >
                <div className="icon">➕</div>
                <h4 style={{ color: "var(--gray-500)" }}>정책 더 추가하기</h4>
                <div className="amount" style={{ color: "var(--gray-300)", fontSize: 14 }}>
                  최대 12개까지
                </div>
                <div className="period" style={{ color: "var(--gray-400)" }}>분석 가능</div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="cta-section">
            <div className="cta-text">
              <h3>🚀 이 조합으로 지금 바로 신청하세요!</h3>
              <p>총 {data.total_estimated_benefit_label} 혜택을 한 번에 챙길 수 있어요</p>
            </div>
            <Link href="/apply" className="cta-btn" style={{ textDecoration: "none" }}>
              📋 신청 보조 시작하기 <span>›</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
