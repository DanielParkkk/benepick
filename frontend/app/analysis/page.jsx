'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';

export default function AnalysisPage() {
  const router = useRouter();

  useEffect(() => {
    const tryShowDetail = () => {
      // localStorage: 다른 페이지에서 넘어온 경우 (1회성) — main.js window.load와 역할 분리
      // main.js가 먼저 처리하지만, Script 로드 타이밍 차이로 여기서도 체크
      const pidFromStorage = (() => { try { return localStorage.getItem('benefic_detail_id'); } catch(e) { return null; } })();
      if (pidFromStorage && typeof window.showDetail === 'function') {
        try { localStorage.removeItem('benefic_detail_id'); } catch(e) {}
        window.showDetail(pidFromStorage);
        return;
      }
      // sessionStorage: 뒤로가기 복원
      const pidFromSession = (() => { try { return sessionStorage.getItem('benefic_current_detail'); } catch(e) { return null; } })();
      if (pidFromSession && typeof window.showDetail === 'function') {
        window.showDetail(pidFromSession);
      }
    };

    if (typeof window.showDetail === 'function') {
      tryShowDetail();
    } else {
      const interval = setInterval(() => {
        if (typeof window.showDetail === 'function') {
          clearInterval(interval);
          tryShowDetail();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    }
  }, []);

  const goBackToDetail = () => {
    const nameEl = document.getElementById('detail-policy-name');
    if (nameEl && nameEl.textContent) {
      router.push('/policy-detail?name=' + encodeURIComponent(nameEl.textContent.trim()));
    } else {
      router.back();
    }
  };

  const showTab = (tab) => {
    if (typeof window !== 'undefined' && typeof window.showTab === 'function') {
      window.showTab(tab);
    }
  };

  return (
    <>
      <div className="ai-loading" id="aiLoading">
        <div className="ai-loading-card">
          <div className="ai-spinner"></div>
          <div className="ai-loading-text">
            <h3 data-i18n="ai_loading_title">AI 분석 중입니다...</h3>
            <p>입력하신 조건으로<br />수급 가능성을 계산하고 있어요</p>
            <br />
            <div className="ai-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <NavBar activePage="" />

      <div className="container">
        <div className="screen active" id="screen-detail">
          <div className="grid-main">
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
                <button
                  onClick={() => {
                    if (typeof window.goBackToDashboard === 'function') {
                      window.goBackToDashboard();
                    } else {
                      window.location.href = '/';
                    }
                  }}
                  style={{background:'var(--gray-100)',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:'600',color:'var(--gray-700)',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}}
                >
                  <span>← 대시보드</span>
                </button>
                <span style={{fontSize:'14px',color:'var(--gray-500)'}}>/ <span data-i18n="breadcrumb_analysis">AI 수급 분석</span></span>
                <span style={{marginLeft:'auto',fontSize:'11px',fontWeight:'700',background:'linear-gradient(135deg,var(--blue),var(--green))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',letterSpacing:'.3px'}}>🤖 AI ANALYSIS</span>
              </div>

              <div className="detail-panel visible" id="detail-panel-main">
                <div className="detail-header">
                  <div className="detail-icon" id="detail-icon">📋</div>
                  <div className="detail-title" style={{flex:'1'}}>
                    <h3 id="detail-policy-name">정책 로딩 중...</h3>
                    <div className="detail-prob">
                      <span className="pct" id="detail-pct">-</span>
                      <span style={{fontSize:'28px',fontWeight:'800',color:'var(--green)'}}>%</span>
                      <span className="label" data-i18n="prob_label">수급 확률</span>
                    </div>
                    <div style={{marginTop:'8px'}}>
                      <div className="progress-track" style={{height:'10px'}}>
                        <div className="progress-fill green" id="detail-bar" style={{width:'0%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ai-summary-box" id="ai-summary-box">
                  <div className="ai-summary-box-header">
                    <div className="ai-summary-badge" data-i18n="original_text_badge">📄 원문 발췌</div>
                  </div>
                  <div id="ai-summary-content">
                    <div className="ai-summary-loading">
                      <div className="ai-summary-spinner"></div>
                      <span data-i18n="loading_data">원문 데이터를 불러오고 있어요...</span>
                    </div>
                  </div>
                </div>

                <div className="analysis-section" id="detail-issue-section">
                  <div className="analysis-label" data-i18n="issue_label">❌ 탈락 예상 이유</div>
                  <div id="detail-issues-list"></div>
                </div>

                <div className="analysis-section" id="detail-guide-section">
                  <div className="analysis-label" data-i18n="guide_label">💡 해결 방법 &amp; 행동 가이드</div>
                  <div id="detail-guides-list"></div>
                </div>

                <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
                  <button className="btn-primary btn-green" style={{flex:'1',padding:'12px',fontSize:'14px',justifyContent:'center'}} onClick={() => showTab('apply')}>
                    <span data-i18n="btn_start_apply">📋 신청 보조 시작하기 →</span>
                  </button>
                  <button className="btn-primary" style={{background:'var(--gray-100)',color:'var(--gray-700)',flex:'none',padding:'12px 16px'}} onClick={() => { if (typeof window.goBackToDashboard === 'function') { window.goBackToDashboard(); } else { window.location.href = '/'; } }} data-i18n="btn_list">
                    목록
                  </button>
                </div>
              </div>
            </div>

            <div className="sidebar">
              <div className="sidebar-card">
                <h4 data-i18n="sidebar_policy_summary">📊 이 정책 요약</h4>
                <div className="stat-grid" id="detail-stats-grid">
                  <div className="stat-item"><div className="val green" id="detail-stat-pct">-</div><div className="lbl" data-i18n="stat_prob">수급 확률</div></div>
                  <div className="stat-item"><div className="val blue" id="detail-stat-benefit">-</div><div className="lbl" data-i18n="stat_benefit_yr">연간 혜택</div></div>
                  <div className="stat-item"><div className="val green" id="detail-stat-period">-</div><div className="lbl" data-i18n="stat_process_time">처리 기간</div></div>
                  <div className="stat-item"><div className="val blue" id="detail-stat-issues">-</div><div className="lbl" data-i18n="stat_issues">해결 필요</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="home" />
    </>
  );
}