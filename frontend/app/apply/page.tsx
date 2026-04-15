"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";

interface DocCard {
  icon: string;
  name: string;
  ready: boolean;
  desc: string;
}

interface CheckItem {
  text: string;
  done: boolean;
}

const INITIAL_DOCS: DocCard[] = [
  { icon: "🪪", name: "주민등록등본", ready: true, desc: "✅ 준비 완료 · 3개월 이내" },
  { icon: "💰", name: "소득 증빙서류", ready: true, desc: "✅ 건강보험료 납부확인서" },
  { icon: "🏠", name: "임대차 계약서", ready: false, desc: "⬜ 미준비 · 원본 + 사본" },
  { icon: "🏦", name: "통장 사본", ready: false, desc: "⬜ 미준비 · 수급 계좌" },
];

const INITIAL_CHECKLIST: CheckItem[] = [
  { text: "신청자 기본 정보 입력 완료", done: true },
  { text: "소득 증빙서류 제출", done: true },
  { text: "주민등록 전입신고 확인", done: true },
  { text: "임대차 계약서 업로드", done: false },
  { text: "수급 계좌 등록", done: false },
  { text: "신청서 최종 제출", done: false },
];

const FLOW_STEPS = [
  { label: "정보 입력", done: true },
  { label: "AI 분석", done: true },
  { label: "원인 파악", done: true },
  { label: "서류 준비", active: true },
  { label: "신청 완료", done: false },
];

export default function ApplyPage() {
  const [docs, setDocs] = useState<DocCard[]>(INITIAL_DOCS);
  const [checklist, setChecklist] = useState<CheckItem[]>(INITIAL_CHECKLIST);

  const toggleDoc = (i: number) => {
    setDocs((prev) =>
      prev.map((d, idx) =>
        idx === i
          ? { ...d, ready: true, desc: "✅ 준비 완료" }
          : d
      )
    );
  };

  const toggleCheck = (i: number) => {
    setChecklist((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, done: !c.done } : c))
    );
  };

  const readyCount = docs.filter((d) => d.ready).length;
  const doneCount = checklist.filter((c) => c.done).length;
  const progress = Math.round((doneCount / checklist.length) * 100);

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="screen active">
          {/* 진행 단계 */}
          <div className="flow-steps">
            {FLOW_STEPS.map((step, i) => (
              <>
                <div
                  key={step.label}
                  className={`flow-step${step.done ? " done" : ""}${(step as { active?: boolean }).active ? " active" : ""}`}
                >
                  <div className="num">{step.done ? "✓" : i + 1}</div>
                  <span className="label">{step.label}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div key={`arrow-${i}`} className="flow-arrow">→</div>
                )}
              </>
            ))}
          </div>

          <div className="grid-main">
            <div>
              {/* 서류 카드 */}
              <div className="section-title">
                <h3>📄 필요 서류 카드</h3>
                <span style={{ fontSize: 13, color: "var(--gray-500)" }}>청년 월세 지원 기준</span>
              </div>

              <div className="doc-cards">
                {docs.map((doc, i) => (
                  <div
                    key={doc.name}
                    className={`doc-card${doc.ready ? " ready" : ""}`}
                    onClick={() => !doc.ready && toggleDoc(i)}
                    style={{ cursor: doc.ready ? "default" : "pointer" }}
                  >
                    <div className="doc-icon">{doc.icon}</div>
                    <div className="doc-info">
                      <h5>{doc.name}</h5>
                      <p>{doc.desc}</p>
                    </div>
                    <div className="doc-status">{doc.ready ? "✅" : "⬜"}</div>
                  </div>
                ))}
              </div>

              {/* 체크리스트 */}
              <div style={{ marginBottom: 24 }}>
                <div className="section-title">
                  <h3>☑️ 신청 체크리스트</h3>
                </div>
                <div className="input-card" style={{ padding: "20px 24px" }}>
                  <div className="checklist">
                    {checklist.map((item, i) => (
                      <div
                        key={item.text}
                        className={`check-item${item.done ? " done" : ""}`}
                        onClick={() => toggleCheck(i)}
                      >
                        <div className="check-box">{item.done ? "✓" : ""}</div>
                        <span className="check-text">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="cta-section">
                <div className="cta-text">
                  <h3>🏠 청년 월세 지원 신청하기</h3>
                  <p>복지로(bokjiro.go.kr)에서 3분 만에 완료</p>
                </div>
                <a
                  href="https://bokjiro.go.kr"
                  target="_blank"
                  rel="noreferrer"
                  className="cta-btn"
                  style={{ textDecoration: "none" }}
                >
                  🚀 신청하러 가기
                </a>
              </div>
            </div>

            {/* 사이드바 */}
            <div className="sidebar">
              <div className="sidebar-card">
                <h4>📊 신청 현황</h4>
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="val green">{readyCount}/{docs.length}</div>
                    <div className="lbl">서류 준비</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">{progress}%</div>
                    <div className="lbl">진행률</div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="progress-track" style={{ height: 10 }}>
                    <div
                      className="progress-fill blue"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--gray-500)", marginTop: 6, textAlign: "center" }}>
                    서류 {docs.length - readyCount}개 더 준비하면 신청 가능!
                  </p>
                </div>
              </div>

              <div className="sidebar-card">
                <h4>💡 신청 팁</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ background: "var(--blue-light)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--blue-dark)", fontWeight: 500, lineHeight: 1.5 }}>
                    📅 <strong>신청 기한:</strong> 2025년 12월 31일까지 접수 마감
                  </div>
                  <div style={{ background: "var(--green-light)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--green-dark)", fontWeight: 500, lineHeight: 1.5 }}>
                    ⚡ <strong>빠른 처리:</strong> 온라인 신청 시 처리 기간 단축 (평균 18일)
                  </div>
                  <div style={{ background: "var(--orange-light)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#B7770D", fontWeight: 500, lineHeight: 1.5 }}>
                    ⚠️ <strong>주의:</strong> 전입신고 없으면 100% 탈락. 반드시 사전 완료 필수!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
