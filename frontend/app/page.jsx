'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NavBar from '../components/NavBar';
import TabBar from '../components/TabBar';

// ── 프로필 데이터 → 표시 텍스트 변환 헬퍼 ─────────────────────────
const REGION_LABEL = {
  seoul:'서울특별시', busan:'부산광역시', daegu:'대구광역시',
  incheon:'인천광역시', gwangju:'광주광역시', daejeon:'대전광역시',
  ulsan:'울산광역시', sejong:'세종특별자치시', gyeonggi:'경기도',
  gangwon:'강원도', chungbuk:'충청북도', chungnam:'충청남도',
  jeonbuk:'전라북도', jeonnam:'전라남도', gyeongbuk:'경상북도',
  gyeongnam:'경상남도', jeju:'제주특별자치도',
};
const INCOME_SHORT = {
  '50% 이하':'중위소득 50% 이하', '50~80%':'중위소득 50~80%',
  '80~100%':'중위소득 80~100%', '100~150%':'중위소득 100~150%', '150% 초과':'중위소득 150% 초과',
};
function calcAge(birth) {
  if (!birth || birth.length < 8) return null;
  const y = parseInt(birth.slice(0,4)), m = parseInt(birth.slice(4,6))-1, d = parseInt(birth.slice(6,8));
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() < m || (today.getMonth() === m && today.getDate() < d)) age--;
  return isNaN(age) ? null : age;
}

export default function DashboardPage() {
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dashSearchResultsVisible, setDashSearchResultsVisible] = useState(false);
  const [selectedIntents, setSelectedIntents] = useState([]);
  const [profileTags, setProfileTags] = useState([]);
  const [profileInitial, setProfileInitial] = useState('나');
  const [profileUpdatedAt, setProfileUpdatedAt] = useState('');

  // 프로필 동기화: localStorage → 태그 생성
  const syncProfile = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('benefic_user') || '{}');
      const p = stored.profile || {};
      const name = stored.name || stored.displayName || '나';
      setProfileInitial(name[0]?.toUpperCase() || '나');
      const tags = [];
      const age = calcAge(p.birth);
      if (age !== null) tags.push('📅 만 ' + age + '세');
      if (p.region) tags.push('📍 ' + (REGION_LABEL[p.region] || p.region));
      if (p.income) tags.push('💰 ' + (INCOME_SHORT[p.income] || p.income));
      if (p.household) tags.push('🏠 ' + p.household);
      if (p.emp) tags.push('👔 ' + p.emp);
      if (p.intents && p.intents.length) tags.push('💡 ' + p.intents.join('·'));
      setProfileTags(tags);
      const now = new Date();
      const h = now.getHours(), mi = now.getMinutes();
      const ampm = h < 12 ? '오전' : '오후';
      const hh = h % 12 || 12;
      const mm = String(mi).padStart(2, '0');
      const regionText = p.region ? (REGION_LABEL[p.region] || p.region) : '지역 미설정';
      setProfileUpdatedAt('마지막 업데이트: 오늘 ' + ampm + ' ' + hh + ':' + mm + ' · ' + regionText);
    } catch(e) {}
  };
  useEffect(() => {
    syncProfile();
    window.addEventListener('benefic-profile-updated', syncProfile);
    return () => window.removeEventListener('benefic-profile-updated', syncProfile);
  }, []);

  useEffect(() => {
    // 진행바 애니메이션
    const bars = document.querySelectorAll('.progress-fill');
    bars.forEach((bar, i) => {
      const finalW = bar.style.width;
      bar.style.width = '0';
      setTimeout(() => { bar.style.width = finalW; }, 300 + i * 120);
    });

    // 온보딩 초기화
    const ONBOARDING_KEY = 'benefic_seen_guide_v20260424';
    try {
      const seen = localStorage.getItem(ONBOARDING_KEY);
      if (!seen) {
        setTimeout(() => setOnboardingVisible(true), 400);
      }
    } catch (e) {}

    // initLockOverlays
    if (typeof window !== 'undefined' && typeof window.initLockOverlays === 'function') {
      window.initLockOverlays();
    }
    // insightInit
    if (typeof window !== 'undefined' && typeof window.insightInit === 'function') {
      window.insightInit();
    }

    // 이전 분석 결과 자동 복원 — main.js 로드 완료 후 실행
    const tryRestorePortfolio = () => {
      if (typeof window.renderDashboard !== 'function') return false;
      try {
        const cached = localStorage.getItem('benefic_portfolio');
        if (!cached) return true;
        const cards = JSON.parse(cached);
        if (cards && cards.length > 0) {
          window.renderDashboard({ recommendation_cards: cards });
        }
      } catch(e) {}
      return true;
    };

    if (!tryRestorePortfolio()) {
      const interval = setInterval(() => {
        if (tryRestorePortfolio()) clearInterval(interval);
      }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    }
  }, []);

  const closeOnboarding = () => setOnboardingVisible(false);
  const closeOnboardingForever = () => {
    try { localStorage.setItem('benefic_seen_guide_v20260424', 'true'); } catch (e) {}
    setOnboardingVisible(false);
  };

  const toggleIntent = (intent) => {
    setSelectedIntents(prev => {
      if (prev.includes(intent)) return prev.filter(i => i !== intent);
      if (prev.length >= 2) return prev;
      return [...prev, intent];
    });
  };

  const doDashSearch = () => {
    if (typeof window !== 'undefined' && typeof window.doDashSearch === 'function') {
      window.doDashSearch();
    }
  };

  const runAnalysis = () => {
    if (typeof window !== 'undefined' && typeof window.runAnalysis === 'function') {
      window.runAnalysis();
    }
  };

  const handleScrapToggle = (e, policyId) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && typeof window.handleScrapToggle === 'function') {
      window.handleScrapToggle(e, policyId);
    }
  };

  const showDetail = (policyId) => {
    if (typeof window !== 'undefined' && typeof window.showDetail === 'function') {
      window.showDetail(policyId);
    }
  };

  const insightRefresh = () => {
    if (typeof window !== 'undefined' && typeof window.insightRefresh === 'function') {
      window.insightRefresh();
    }
  };

  return (
    <>
      {/* AI LOADING OVERLAY */}
      <div className="ai-loading" id="aiLoading" >
        <div className="ai-loading-card">
          <div className="ai-spinner"></div>
          <div className="ai-loading-text">
            <h3 data-i18n="ai_loading_title" suppressHydrationWarning>AI 분석 중입니다...</h3>
            <p>입력하신 조건으로<br />수급 가능성을 계산하고 있어요</p>
            <br />
            <div className="ai-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ONBOARDING GUIDE POPUP */}
      <div
        className={`onboarding-overlay${onboardingVisible ? ' visible' : ''}`}
        id="onboardingGuide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="onboarding-modal">
          <div className="onboarding-header">
            <div className="onboarding-logo-row">
              <div className="logo-mark" style={{width:'36px',height:'36px',fontSize:'16px'}}>B</div>
              <span style={{fontSize:'18px',fontWeight:'800',color:'var(--gray-900)'}} data-i18n="guide_modal_brand">베네픽</span>
            </div>
            <button className="onboarding-close-x" onClick={closeOnboarding} aria-label="닫기">✕</button>
          </div>
          <div className="onboarding-body">
            <h2 id="onboarding-title" data-i18n="guide_title">처음 오셨나요? 👋</h2>
            <p className="onboarding-subtitle" data-i18n="guide_subtitle">베네픽은 AI로 나에게 맞는 복지 혜택을 분석해드려요.</p>
            <div className="onboarding-steps">
              <div className="onboarding-step">
                <div className="onboarding-step-num">1</div>
                <div className="onboarding-step-body">
                  <h4 data-i18n="guide_step1_title">🤖 AI 수급 확률 분석</h4>
                  <p data-i18n="guide_step1_desc">나이·소득·가구 형태를 입력하면 AI가 수급 가능한 정책과 확률을 자동 계산해요.</p>
                </div>
              </div>
              <div className="onboarding-step">
                <div className="onboarding-step-num">2</div>
                <div className="onboarding-step-body">
                  <h4 data-i18n="guide_step2_title">💼 맞춤 포트폴리오 구성</h4>
                  <p data-i18n="guide_step2_desc">중복 없이 최대 혜택을 받을 수 있는 정책 조합을 포트폴리오로 정리해 드려요.</p>
                </div>
              </div>
              <div className="onboarding-step">
                <div className="onboarding-step-num">3</div>
                <div className="onboarding-step-body">
                  <h4 data-i18n="guide_step3_title">📋 서류 준비 &amp; 신청 보조</h4>
                  <p data-i18n="guide_step3_desc">필요한 서류 목록과 신청 방법을 단계별로 안내해 드려요. 커뮤니티에서 후기도 확인하세요!</p>
                </div>
              </div>
            </div>
          </div>
          <div className="onboarding-footer">
            <button className="onboarding-btn-primary" onClick={closeOnboarding}>
              <span data-i18n="guide_btn_start">🚀 베네픽 시작하기</span>
            </button>
            <button className="onboarding-btn-skip" onClick={closeOnboardingForever}>
              <span data-i18n="guide_btn_skip">다시 보지 않기</span>
            </button>
          </div>
        </div>
      </div>

      {/* NAV */}
      <NavBar activePage="dashboard" />

      <div className="container">
        <div className="screen active" id="screen-dashboard">

          {/* SEARCH BAR */}
          <div className="dash-search-bar" style={{marginBottom:'24px'}}>
            <span className="dash-search-label" data-i18n="dash_search_label">🔍 검색</span>
            <input
              id="dash-search-input"
              placeholder="정책명, 키워드, 또는 문장으로 검색 (예: 청년 월세, 취업 후 생계 지원)"
              data-i18n-placeholder="dash_search_placeholder"
              onKeyDown={(e) => { if (e.key === 'Enter') doDashSearch(); }}
            />
            <button className="btn-primary" onClick={doDashSearch} style={{flex:'none',padding:'10px 20px'}} data-i18n="dash_search_btn">검색</button>
          </div>

          <div className="grid-main">
            {/* LEFT COLUMN */}
            <div>

              {/* USER PROFILE CARD */}
              <div className="profile-card">
                <div className="profile-header">
                  <div className="profile-user">
                    <div className="profile-avatar" id="profileAvatar">{profileInitial}</div>
                    <div className="profile-info">
                      <h2 id="profileName">나의 복지 분석</h2>
                      <p>{profileUpdatedAt || '마지막 업데이트: 오늘'}</p>
                    </div>
                  </div>
                  <div className="score-badge">
                    <div className="score-label" data-i18n="score_label">종합 수급 점수</div>
                    <div className="score-num">87</div>
                    <div className="score-sub">/ 100점</div>
                  </div>
                </div>
                <div className="profile-tags">
                  {profileTags.length > 0 ? (
                    profileTags.map((tag, i) => (
                      <span key={i} className="profile-tag">{tag}</span>
                    ))
                  ) : (
                    <span style={{fontSize:'13px', color:'rgba(255,255,255,0.6)'}}>
                      <a href="/profile" style={{color:'rgba(255,255,255,0.8)', textDecoration:'underline'}}>프로필</a>에서 개인정보를 입력하면 맞춤 정보가 표시됩니다.
                    </span>
                  )}
                </div>
              </div>

              {/* INPUT CARD */}
              <div className="input-card">
                <div className="input-card-header">
                  <h3 data-i18n="input_card_title">🎯 조건 입력으로 정확도 높이기</h3>
                  <span className="ai-chip" data-i18n="ai_chip">🤖 AI 분석</span>
                </div>
                <div className="input-grid">
                  <div className="input-item">
                    <label data-i18n="label_age">연령</label>
                    <select id="sel-age">
                      {Array.from({length: 48}, (_, i) => i + 18).map(age => (
                        <option key={age} data-i18n-opt={`opt_age_${age === 65 ? '65p' : age}`} defaultValue={age === 27 ? true : undefined}>
                          {age >= 65 ? '만 65세 이상' : `만 ${age}세`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-item">
                    <label data-i18n="label_region">지역</label>
                    <select id="sel-region">
                      <option data-i18n-opt="opt_reg_seoul">서울특별시</option>
                      <option data-i18n-opt="opt_reg_busan">부산광역시</option>
                      <option data-i18n-opt="opt_reg_daegu">대구광역시</option>
                      <option data-i18n-opt="opt_reg_incheon">인천광역시</option>
                      <option data-i18n-opt="opt_reg_gwangju">광주광역시</option>
                      <option data-i18n-opt="opt_reg_daejeon">대전광역시</option>
                      <option data-i18n-opt="opt_reg_ulsan">울산광역시</option>
                      <option data-i18n-opt="opt_reg_sejong">세종특별자치시</option>
                      <option data-i18n-opt="opt_reg_gyeonggi">경기도</option>
                      <option data-i18n-opt="opt_reg_gangwon">강원특별자치도</option>
                      <option data-i18n-opt="opt_reg_chungbuk">충청북도</option>
                      <option data-i18n-opt="opt_reg_chungnam">충청남도</option>
                      <option data-i18n-opt="opt_reg_jeonbuk">전북특별자치도</option>
                      <option data-i18n-opt="opt_reg_jeonnam">전라남도</option>
                      <option data-i18n-opt="opt_reg_gyeongbuk">경상북도</option>
                      <option data-i18n-opt="opt_reg_gyeongnam">경상남도</option>
                      <option data-i18n-opt="opt_reg_jeju">제주특별자치도</option>
                    </select>
                  </div>
                  <div className="input-item">
                    <label data-i18n="label_income">소득 수준</label>
                    <select id="sel-income">
                      <option data-i18n-opt="opt_inc_1">중위소득 30% 이하</option>
                      <option data-i18n-opt="opt_inc_2">중위소득 30~40%</option>
                      <option data-i18n-opt="opt_inc_3">중위소득 40~50%</option>
                      <option data-i18n-opt="opt_inc_4" defaultValue>중위소득 50~60%</option>
                      <option data-i18n-opt="opt_inc_5">중위소득 60~70%</option>
                      <option data-i18n-opt="opt_inc_6">중위소득 70~80%</option>
                      <option data-i18n-opt="opt_inc_7">중위소득 80~90%</option>
                      <option data-i18n-opt="opt_inc_8">중위소득 90~100%</option>
                      <option data-i18n-opt="opt_inc_9">중위소득 100~120%</option>
                      <option data-i18n-opt="opt_inc_10">중위소득 120~150%</option>
                      <option data-i18n-opt="opt_inc_11">중위소득 150% 초과</option>
                    </select>
                  </div>
                  <div className="input-item">
                    <label data-i18n="label_household">가구 유형</label>
                    <select id="sel-family">
                      <option data-i18n-opt="opt_family_1">1인 가구</option>
                      <option data-i18n-opt="opt_family_2">2인 가구</option>
                      <option data-i18n-opt="opt_family_3">3인 가구</option>
                      <option data-i18n-opt="opt_family_4">4인 이상 가구</option>
                      <option data-i18n-opt="opt_family_5">한부모 가구</option>
                      <option data-i18n-opt="opt_family_6">다자녀 가구</option>
                      <option data-i18n-opt="opt_family_7">다문화 가구</option>
                      <option data-i18n-opt="opt_family_8">조손 가구</option>
                      <option data-i18n-opt="opt_family_9">노인 단독 가구</option>
                    </select>
                  </div>
                  <div className="input-item">
                    <label data-i18n="label_job">취업 상태</label>
                    <select id="sel-employment">
                      <option data-i18n-opt="opt_emp_1" defaultValue>미취업</option>
                      <option data-i18n-opt="opt_emp_2">취업자 (정규직)</option>
                      <option data-i18n-opt="opt_emp_3">취업자 (비정규직/계약직)</option>
                      <option data-i18n-opt="opt_emp_4">자영업자</option>
                      <option data-i18n-opt="opt_emp_5">구직자 (실업)</option>
                      <option data-i18n-opt="opt_emp_6">학생</option>
                      <option data-i18n-opt="opt_emp_7">육아휴직 중</option>
                      <option data-i18n-opt="opt_emp_8">무직</option>
                    </select>
                  </div>
                  <div className="input-item">
                    <label data-i18n="label_disability">장애 여부</label>
                    <select id="sel-disability">
                      <option data-i18n-opt="opt_dis_0" defaultValue>없음</option>
                      <option data-i18n-opt="opt_dis_1">장애 1~3급 (심한 장애)</option>
                      <option data-i18n-opt="opt_dis_2">장애 4~6급 (심하지 않은 장애)</option>
                    </select>
                  </div>
                </div>

                {/* INTENT TAG SELECTOR */}
                <div className="intent-section">
                  <div className="intent-label" data-i18n="intent_label">
                    💡 어떤 도움이 가장 필요하신가요?
                    <span className="intent-hint" data-i18n="intent_hint">(최대 2개 선택 · 선택 시 AI 추천 우선순위가 달라집니다)</span>
                  </div>
                  <div className="intent-tags" id="intentTags">
                    {[
                      {intent:'주거', label:'🏠 주거 지원', i18n:'intent_housing'},
                      {intent:'고용', label:'💼 일자리/취업', i18n:'intent_job'},
                      {intent:'보건', label:'🏥 의료/건강', i18n:'intent_health'},
                      {intent:'금융', label:'💵 금융/자산형성', i18n:'intent_finance'},
                      {intent:'교육', label:'🎓 교육/훈련', i18n:'intent_edu'},
                      {intent:'기초생활', label:'🛡️ 기초생활', i18n:'intent_basic'},
                      {intent:'가족', label:'👨‍👩‍👧 가족/육아', i18n:'intent_family'},
                      {intent:'창업', label:'🚀 창업 지원', i18n:'intent_startup'},
                    ].map(({intent, label, i18n}) => (
                      <button
                        key={intent}
                        className={`intent-tag${selectedIntents.includes(intent) ? ' active' : ''}${!selectedIntents.includes(intent) && selectedIntents.length >= 2 ? ' disabled' : ''}`}
                        data-intent={intent}
                        onClick={(e) => {
                          toggleIntent(intent);
                          if (typeof window !== 'undefined' && typeof window.toggleIntent === 'function') {
                            window.toggleIntent(e.currentTarget);
                          }
                        }}
                        data-i18n={i18n}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                <button className="analyze-btn" onClick={runAnalysis} data-i18n="btn_analyze_main">
                  🔍 수급 가능성 AI 분석 시작하기
                </button>
              </div>

              {/* POLICY SCORING LIST */}
              <div>
                <div className="section-title">
                  <h3>
                    <span data-i18n="scoring_title">📈 수급 가능성 스코어링</span>
                    <span style={{fontSize:'13px',fontWeight:'500',color:'var(--gray-500)'}} data-i18n="scoring_order">(높은 순)</span>
                  </h3>
                </div>

                <div className="policy-list"></div>

                {/* INLINE SEARCH RESULTS */}
                <div id="dash-search-results-wrap">
                  <div className="dash-search-results-header">
                    <h3 data-i18n="search_results_title">🔎 검색 결과</h3>
                    <button
                      className="dash-search-close-btn"
                      onClick={() => {
                        if (typeof window !== 'undefined' && typeof window.closeDashSearch === 'function') window.closeDashSearch();
                      }}
                      data-i18n="search_close"
                    >✕ 닫기</button>
                  </div>
                  <div id="dash-search-status"></div>
                  <div id="dash-search-results"></div>
                </div>

              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="sidebar">

              {/* Summary stats */}
              <div className="sidebar-card">
                <h4 data-i18n="sidebar_status_title">📊 나의 수급 현황</h4>
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="val green">12</div>
                    <div className="lbl" data-i18n="stat_policy_count">해당 정책 수</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">87%</div>
                    <div className="lbl" data-i18n="stat_avg_prob">평균 확률</div>
                  </div>
                  <div className="stat-item">
                    <div className="val green">1,040<span style={{fontSize:'14px'}}>만</span></div>
                    <div className="lbl" data-i18n="stat_benefit">예상 수혜액</div>
                  </div>
                  <div className="stat-item">
                    <div className="val blue">3</div>
                    <div className="lbl" data-i18n="stat_immediate">즉시 신청 가능</div>
                  </div>
                </div>
              </div>

              {/* Insight Widget */}
              <div className="insight-widget">
                <div className="insight-widget-header">
                  <div className="insight-widget-title">📊 커뮤니티 인사이트</div>
                  <button className="insight-refresh-btn" onClick={insightRefresh}>↻ 새로고침</button>
                </div>
                <div className="insight-section-label">이번 주 수급 확률 TOP 3</div>
                <div className="insight-policy-row">
                  <div className="insight-policy-meta">
                    <span className="insight-policy-name">🏠 청년 월세 지원</span>
                    <span className="insight-policy-pct">92%</span>
                  </div>
                  <div className="insight-bar-track">
                    <div className="insight-bar-fill" id="iBar1" style={{width:'0%'}}></div>
                  </div>
                </div>
                <div className="insight-policy-row">
                  <div className="insight-policy-meta">
                    <span className="insight-policy-name">📚 내일배움카드</span>
                    <span className="insight-policy-pct">85%</span>
                  </div>
                  <div className="insight-bar-track">
                    <div className="insight-bar-fill" id="iBar2" style={{width:'0%'}}></div>
                  </div>
                </div>
                <div className="insight-policy-row">
                  <div className="insight-policy-meta">
                    <span className="insight-policy-name">🏥 마음건강 지원</span>
                    <span className="insight-policy-pct">74%</span>
                  </div>
                  <div className="insight-bar-track">
                    <div className="insight-bar-fill" id="iBar3" style={{width:'0%'}}></div>
                  </div>
                </div>
                <hr className="insight-divider" />
                <div className="insight-review-header">
                  <span className="insight-review-label">💬 최근 후기 <span className="insight-badge-positive">긍정적</span></span>
                </div>
                <div id="iReviewList"></div>
                <div className="insight-nav-dots" id="iNavDots"></div>
                <div className="insight-stats-row">
                  <div className="insight-stat-chip">
                    <div className="val" id="iStatPosts">0</div>
                    <div className="lbl">게시글</div>
                  </div>
                  <div className="insight-stat-chip">
                    <div className="val" id="iStatLikes">0</div>
                    <div className="lbl">공감수</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TAB BAR */}
      <TabBar active="home" />
    </>
  );
}
