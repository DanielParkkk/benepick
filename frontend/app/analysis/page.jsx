'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AnalysisPage() {
  const router = useRouter();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('한국어');
  const [activeLangCode, setActiveLangCode] = useState('ko');
  const langSelectorRef = useRef(null);

  useEffect(() => {
    // main.js: analysis.html 진입 시 localStorage에서 policy_id 복원 후 showDetail 호출
    if (typeof window !== 'undefined') {
      const pid = (() => { try { return localStorage.getItem('benefic_detail_id'); } catch(e) { return null; } })();
      if (pid) {
        try { localStorage.removeItem('benefic_detail_id'); } catch(e) {}
        if (typeof window.showDetail === 'function') window.showDetail(pid);
      }

      // 진행바 애니메이션
      document.querySelectorAll('.progress-fill').forEach((bar, i) => {
        const finalW = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => { bar.style.width = finalW; }, 300 + i * 120);
      });
    }

    const handleClick = (e) => {
      if (langSelectorRef.current && !langSelectorRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const toggleLangDropdown = (e) => {
    e.stopPropagation();
    setLangDropdownOpen(prev => !prev);
  };

  const selectLanguage = (langDisplay, langCode) => {
    setCurrentLang(langDisplay);
    setActiveLangCode(langCode);
    setLangDropdownOpen(false);
    if (typeof window !== 'undefined' && typeof window.selectLanguage === 'function') {
      const el = document.querySelector(`[data-lang-code="${langCode}"]`);
      if (el) window.selectLanguage(el, langDisplay);
    }
  };

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
      {/* AI LOADING OVERLAY */}
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

      {/* NAV */}
      <nav>
        <Link href="/" className="nav-logo">
          <div className="logo-mark">B</div>
          <div className="logo-text">
            <span className="logo-name" data-i18n="logo_name">베네픽</span>
            <span className="logo-tag" data-i18n="logo_tag">나를 위한 맞춤 복지 추천</span>
          </div>
        </Link>
        <div className="nav-center">
          <Link href="/" data-i18n="nav_dashboard">대시보드</Link>
          <Link href="/search" data-i18n="nav_search">정책 검색</Link>
          <Link href="/analysis" className="active" data-i18n="nav_analysis">탈락 이유</Link>
          <Link href="/portfolio" data-i18n="nav_portfolio">포트폴리오</Link>
          <Link href="/apply" data-i18n="nav_apply">신청 보조</Link>
          <Link href="/community" data-i18n="nav_community">커뮤니티</Link>
        </div>
        <div className="nav-right">
          <div id="langSelector" className="lang-selector" ref={langSelectorRef}>
            <button id="langBtn" className={`lang-btn${langDropdownOpen ? ' open' : ''}`} onClick={toggleLangDropdown} aria-haspopup="true" aria-expanded={langDropdownOpen}>
              <svg className="globe-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
              </svg>
              <span className="lang-label-text" id="currentLangLabel">{currentLang}</span>
              <svg className="lang-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="langDropdown" className={`lang-dropdown${langDropdownOpen ? ' visible' : ''}`}>
              <div className="lang-dropdown-inner">
                <div className={`lang-option${activeLangCode === 'ko' ? ' active' : ''}`} onClick={() => selectLanguage('한국어', 'ko')} data-lang-code="ko">
                  <span className="lang-flag">🇰🇷</span><span>한국어</span>
                  {activeLangCode === 'ko' && <svg className="lang-check" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className={`lang-option${activeLangCode === 'en' ? ' active' : ''}`} onClick={() => selectLanguage('English', 'en')} data-lang-code="en"><span className="lang-flag">🇺🇸</span><span>English</span></div>
                <div className="lang-divider"></div>
                <div className={`lang-option${activeLangCode === 'ja' ? ' active' : ''}`} onClick={() => selectLanguage('日本語', 'ja')} data-lang-code="ja"><span className="lang-flag">🇯🇵</span><span>日本語</span></div>
                <div className={`lang-option${activeLangCode === 'zh' ? ' active' : ''}`} onClick={() => selectLanguage('中文', 'zh')} data-lang-code="zh"><span className="lang-flag">🇨🇳</span><span>中文</span></div>
                <div className={`lang-option${activeLangCode === 'vi' ? ' active' : ''}`} onClick={() => selectLanguage('Tiếng Việt', 'vi')} data-lang-code="vi"><span className="lang-flag">🇻🇳</span><span>Tiếng Việt</span></div>
              </div>
            </div>
          </div>
          <div className="nav-avatar">
            <div className="avatar-circle">땡</div>
            <span className="avatar-name">땡땡땡님</span>
            <span>▾</span>
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="screen active" id="screen-detail">
          <div className="grid-main">
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
                <button
                  onClick={goBackToDetail}
                  style={{background:'var(--gray-100)',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:'600',color:'var(--gray-700)',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}}
                >
                  <span data-i18n="back_to_detail">← 정책 상세</span>
                </button>
                <span style={{fontSize:'14px',color:'var(--gray-500)'}}>/ <span data-i18n="breadcrumb_analysis">AI 수급 분석</span></span>
                <span style={{marginLeft:'auto',fontSize:'11px',fontWeight:'700',background:'linear-gradient(135deg,var(--blue),var(--green))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',letterSpacing:'.3px'}}>🤖 AI ANALYSIS</span>
              </div>

              {/* Detail Card */}
              <div className="detail-panel visible" id="detail-panel-main">
                <div className="detail-header">
                  <div className="detail-icon">🏠</div>
                  <div className="detail-title" style={{flex:'1'}}>
                    <h3 id="detail-policy-name">청년 월세 한시 특별지원</h3>
                    <div className="detail-prob">
                      <span className="pct" id="detail-pct">92</span><span style={{fontSize:'28px',fontWeight:'800',color:'var(--green)'}}>%</span>
                      <span className="label" data-i18n="prob_label">수급 확률</span>
                    </div>
                    <div style={{marginTop:'8px'}}>
                      <div className="progress-track" style={{height:'10px'}}>
                        <div className="progress-fill green" id="detail-bar" style={{width:'92%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 원문 발췌 박스 */}
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
                  <div className="issue-item">
                    <span className="icon">⚠️</span>
                    <p><strong data-i18n="issue_1_title">주민등록 전입 미완료:</strong> <span data-i18n="issue_1_desc">현재 거주지 주민등록이 신청 주소와 일치하지 않을 수 있습니다. 서류 심사 시 탈락 요인이 될 수 있습니다.</span></p>
                  </div>
                  <div className="issue-item">
                    <span className="icon">📋</span>
                    <p><strong data-i18n="issue_2_title">임대차 계약서 미비:</strong> <span data-i18n="issue_2_desc">월세 계약 기간이 남은 계약서 원본 및 확정일자 필요합니다.</span></p>
                  </div>
                </div>

                <div className="analysis-section" id="detail-guide-section">
                  <div className="analysis-label" data-i18n="guide_label">💡 해결 방법 &amp; 행동 가이드</div>
                  <div className="guide-item">
                    <span className="icon">✅</span>
                    <p><strong data-i18n="guide_1_title">1단계: 전입신고 완료하기</strong> <span data-i18n="guide_1_desc">— 거주지 주민센터를 방문하여 현 주소로 전입신고를 진행하세요. 처리 기간: 당일</span></p>
                  </div>
                  <div className="guide-item">
                    <span className="icon">📎</span>
                    <p><strong data-i18n="guide_2_title">2단계: 임대차 계약서 확인</strong> <span data-i18n="guide_2_desc">— 계약서에 확정일자 도장이 찍혀 있는지 확인하고, 없다면 주민센터 방문 시 동시에 신청하세요.</span></p>
                  </div>
                  <div className="guide-item">
                    <span className="icon">🚀</span>
                    <p><strong data-i18n="guide_3_title">3단계: 복지로에서 온라인 신청</strong> <span data-i18n="guide_3_desc">— 위 서류 준비 후 bokjiro.go.kr에서 신청서를 제출하세요. 30일 이내 결과를 통보받습니다.</span></p>
                  </div>
                </div>

                <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
                  <button className="btn-primary btn-green" style={{flex:'1',padding:'12px',fontSize:'14px',justifyContent:'center'}} onClick={() => showTab('apply')}>
                    <span data-i18n="btn_start_apply">📋 신청 보조 시작하기 →</span>
                  </button>
                  <button className="btn-primary" style={{background:'var(--gray-100)',color:'var(--gray-700)',flex:'none',padding:'12px 16px'}} onClick={() => showTab('dashboard')} data-i18n="btn_list">
                    목록
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="sidebar">
              <div className="sidebar-card">
                <h4 data-i18n="sidebar_policy_summary">📊 이 정책 요약</h4>
                <div className="stat-grid">
                  <div className="stat-item"><div className="val green">92%</div><div className="lbl" data-i18n="stat_prob">수급 확률</div></div>
                  <div className="stat-item"><div className="val blue">240만</div><div className="lbl" data-i18n="stat_benefit_yr">연간 혜택</div></div>
                  <div className="stat-item"><div className="val green">1개월</div><div className="lbl" data-i18n="stat_process_time">처리 기간</div></div>
                  <div className="stat-item"><div className="val blue">2건</div><div className="lbl" data-i18n="stat_issues">해결 필요</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TAB BAR */}
      <nav className="tab-bar" role="navigation" aria-label="하단 메뉴">
        <Link href="/" className="tab-item" data-tab="home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span data-i18n="tab_home">홈</span>
        </Link>
        <Link href="/search" className="tab-item" data-tab="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span data-i18n="tab_search">검색</span>
        </Link>
        <Link href="/community" className="tab-item" data-tab="community">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <span data-i18n="tab_community">커뮤니티</span>
        </Link>
        <Link href="/mypage" className="tab-item" data-tab="profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span data-i18n="tab_profile">프로필</span>
        </Link>
      </nav>
    </>
  );
}
