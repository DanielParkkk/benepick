'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('한국어');
  const [activeLangCode, setActiveLangCode] = useState('ko');
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dashSearchResultsVisible, setDashSearchResultsVisible] = useState(false);
  const [selectedIntents, setSelectedIntents] = useState([]);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const langSelectorRef = useRef(null);
  const avatarWrapRef = useRef(null);

  useEffect(() => {
    setMounted(true);

    // 저장된 언어 로드
    try {
      const savedLang = localStorage.getItem('benefic_lang') || 'ko';
      const LANG_DISPLAY = { ko:'한국어', en:'English', zh:'中文', ja:'日本語', vi:'Tiếng Việt' };
      setActiveLangCode(savedLang);
      setCurrentLang(LANG_DISPLAY[savedLang] || '한국어');
    } catch(e) {}

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

    // 사용자 정보 로드
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('benefic_user');
      if (token && userData) setUser(JSON.parse(userData));
      else if (token) setUser({ name: '사용자', initial: '나' });
    } catch (e) {}

    // 외부 클릭 시 드롭다운 닫기
    const handleClick = (e) => {
      if (langSelectorRef.current && !langSelectorRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
      if (avatarWrapRef.current && !avatarWrapRef.current.contains(e.target)) {
        setAvatarDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // 언어 변경 시 번역 재적용 (React re-render 후 실행 보장)
  useEffect(() => {
    if (!mounted) return;
    if (activeLangCode === 'ko') return;
    const apply = () => {
      if (typeof window !== 'undefined' && typeof window.applyTranslations === 'function') {
        window.applyTranslations(activeLangCode);
      }
    };
    // rAF 2번: React DOM 커밋 완전히 끝난 뒤 실행
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }, [activeLangCode, mounted]);

  const closeOnboarding = () => setOnboardingVisible(false);
  const closeOnboardingForever = () => {
    try { localStorage.setItem('benefic_seen_guide_v20260424', 'true'); } catch (e) {}
    setOnboardingVisible(false);
  };

  const toggleLangDropdown = (e) => {
    e.stopPropagation();
    setLangDropdownOpen(prev => !prev);
  };

  const selectLanguage = (langDisplay, langCode) => {
    setCurrentLang(langDisplay);
    setActiveLangCode(langCode);
    setLangDropdownOpen(false);
    if (typeof window !== 'undefined') {
      if (typeof window.saveLang === 'function') window.saveLang(langCode);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof window.applyTranslations === 'function') window.applyTranslations(langCode);
          window.dispatchEvent(new CustomEvent('benefic-lang-change', { detail: { lang: langCode } }));
        });
      });
    }
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
      <div className="ai-loading" id="aiLoading" style={aiLoading ? {display:'flex'} : {}}>
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
      <nav>
        <Link href="/" className="nav-logo">
          <div className="logo-mark">B</div>
          <div className="logo-text">
            <span className="logo-name" data-i18n="logo_name">베네픽</span>
            <span className="logo-tag" data-i18n="logo_tag">나를 위한 맞춤 복지 추천</span>
          </div>
        </Link>
        <div className="nav-center">
          <Link href="/" className="active" data-i18n="nav_dashboard">대시보드</Link>
          <Link href="/search" data-i18n="nav_search">정책 검색</Link>
          <Link href="/community" data-i18n="nav_community">커뮤니티</Link>
        </div>
        <div className="nav-right">
          <div id="langSelector" className="lang-selector" ref={langSelectorRef}>
            <button
              id="langBtn"
              className={`lang-btn${langDropdownOpen ? ' open' : ''}`}
              onClick={toggleLangDropdown}
              aria-haspopup="true"
              aria-expanded={langDropdownOpen}
            >
              <svg className="globe-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
              </svg>
              <span className="lang-label-text" id="currentLangLabel">{currentLang}</span>
              <svg className="lang-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="langDropdown" className={`lang-dropdown${langDropdownOpen ? ' visible' : ''}`}>
              <div className="lang-dropdown-inner">
                <div className={`lang-option${mounted && activeLangCode === 'ko' ? ' active' : ''}`} onClick={() => selectLanguage('한국어', 'ko')} data-lang-code="ko">
                  <span className="lang-flag">🇰🇷</span><span>한국어</span>
                  {mounted && activeLangCode === 'ko' && <svg className="lang-check" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className={`lang-option${mounted && activeLangCode === 'en' ? ' active' : ''}`} onClick={() => selectLanguage('English', 'en')} data-lang-code="en"><span className="lang-flag">🇺🇸</span><span>English</span></div>
                <div className="lang-divider"></div>
                <div className={`lang-option${mounted && activeLangCode === 'ja' ? ' active' : ''}`} onClick={() => selectLanguage('日本語', 'ja')} data-lang-code="ja"><span className="lang-flag">🇯🇵</span><span>日本語</span></div>
                <div className={`lang-option${mounted && activeLangCode === 'zh' ? ' active' : ''}`} onClick={() => selectLanguage('中文', 'zh')} data-lang-code="zh"><span className="lang-flag">🇨🇳</span><span>中文</span></div>
                <div className={`lang-option${mounted && activeLangCode === 'vi' ? ' active' : ''}`} onClick={() => selectLanguage('Tiếng Việt', 'vi')} data-lang-code="vi"><span className="lang-flag">🇻🇳</span><span>Tiếng Việt</span></div>
              </div>
            </div>
          </div>
          {mounted && (
            <div className="nav-avatar-wrap" ref={avatarWrapRef} onClick={(e) => { e.stopPropagation(); setLangDropdownOpen(false); setAvatarDropdownOpen(p => !p); }} style={{position:'relative',cursor:'pointer'}}>
              {user ? (
                <>
                  <div className="nav-avatar" style={{cursor:'pointer'}}>
                    <div className="avatar-circle">{user.initial || user.name?.[0] || '나'}</div>
                    <span className="avatar-name">{user.name || '사용자'}님</span>
                    <span>▾</span>
                  </div>
                  <div className={`avatar-dropdown${avatarDropdownOpen ? ' open' : ''}`} id="avatarDropdown">
                    <div className="avatar-dropdown-inner">
                      <div className="avatar-dd-header">
                        <div className="avatar-dd-circle">{user.initial || user.name?.[0] || '나'}</div>
                        <div>
                          <div className="avatar-dd-name">{user.name || '사용자'}님</div>
                          <div className="avatar-dd-email">{user.email || ''}</div>
                        </div>
                      </div>
                      <div className="avatar-dd-divider"></div>
                      <Link href="/scrap" className="avatar-dd-item" onClick={() => setAvatarDropdownOpen(false)}>스크랩</Link>
                      <Link href="/portfolio" className="avatar-dd-item" onClick={() => setAvatarDropdownOpen(false)}>내 포트폴리오</Link>
                      <Link href="/profile" className="avatar-dd-item" onClick={() => setAvatarDropdownOpen(false)}>개인정보 수정</Link>
                      <Link href="/recently-viewed" className="avatar-dd-item" onClick={() => setAvatarDropdownOpen(false)}>최근 본 공고</Link>
                      <div className="avatar-dd-divider"></div>
                      <div className="avatar-dd-item logout" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('benefic_user'); window.location.href='/login'; }}>로그아웃</div>
                    </div>
                  </div>
                </>
              ) : (
                <a href="/login" className="btn-login-nav">🔑 로그인</a>
              )}
            </div>
          )}
        </div>
      </nav>

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
                    <div className="profile-avatar" id="profileAvatar">T</div>
                    <div className="profile-info">
                      <h2 id="profileName">나의 복지 분석</h2>
                      <p data-i18n="profile_updated">마지막 업데이트: 오늘 오전 9:42 · 서울특별시 마포구</p>
                    </div>
                  </div>
                  <div className="score-badge">
                    <div className="score-label" data-i18n="score_label">종합 수급 점수</div>
                    <div className="score-num">87</div>
                    <div className="score-sub">/ 100점</div>
                  </div>
                </div>
                <div className="profile-tags">
                  <span className="profile-tag" data-i18n="tag_age">📅 만 27세</span>
                  <span className="profile-tag" data-i18n="tag_region">📍 서울 마포구</span>
                  <span className="profile-tag" data-i18n="tag_income">💰 중위소득 52%</span>
                  <span className="profile-tag" data-i18n="tag_household">🏠 1인 가구</span>
                  <span className="profile-tag" data-i18n="tag_job">👔 미취업</span>
                  <span className="profile-tag" data-i18n="tag_edu">🎓 대졸</span>
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

                <div className="policy-list">

                  {/* Policy 1 - 92% */}
                  <div className="policy-card top" onClick={() => showDetail('청년-월세-한시-특별지원')}>
                    <button className="scrap-btn" onClick={(e) => handleScrapToggle(e, '청년-월세-한시-특별지원')} title="스크랩 저장" aria-label="스크랩 저장">☆</button>
                    <div className="policy-top-row">
                      <div className="policy-left">
                        <div className="policy-icon green">🏠</div>
                        <div className="policy-meta">
                          <h4 data-i18n="pc1_name">청년 월세 한시 특별지원</h4>
                          <p data-i18n="pc1_desc">만 19~34세 · 월세 60만원 이하 · 독립 거주 청년</p>
                          <div className="policy-badges">
                            <span className="badge badge-green" data-i18n="badge_met">✅ 조건 충족</span>
                            <span className="badge badge-blue">Gov24</span>
                            <span className="badge badge-gray" data-i18n="pc1_max">월 최대 20만원</span>
                          </div>
                        </div>
                      </div>
                      <div className="policy-percent">
                        <div className="percent-num high">92<span style={{fontSize:'18px'}}>%</span></div>
                        <div className="percent-label" data-i18n="prob_label">수급 확률</div>
                      </div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-track">
                        <div className="progress-fill green" style={{width:'92%'}}></div>
                      </div>
                      <div className="benefit-chip" data-i18n="pc1_annual">연 240만원</div>
                    </div>
                    <div className="policy-action" data-i18n="detail_btn">상세 분석 보기 →</div>
                  </div>

                  {/* Policy 2 - 85% */}
                  <div className="policy-card top" onClick={() => showDetail('국민내일배움카드')}>
                    <button className="scrap-btn" onClick={(e) => handleScrapToggle(e, '국민내일배움카드')} title="스크랩 저장" aria-label="스크랩 저장">☆</button>
                    <div className="policy-top-row">
                      <div className="policy-left">
                        <div className="policy-icon green">📚</div>
                        <div className="policy-meta">
                          <h4 data-i18n="pc2_name">국민내일배움카드</h4>
                          <p data-i18n="pc2_desc">실업자 · 이직 예정자 · 단기근로자 지원 직업훈련</p>
                          <div className="policy-badges">
                            <span className="badge badge-green" data-i18n="badge_met">✅ 조건 충족</span>
                            <span className="badge badge-blue" data-i18n="pc2_org">고용부</span>
                            <span className="badge badge-gray" data-i18n="pc2_max">최대 500만원</span>
                          </div>
                        </div>
                      </div>
                      <div className="policy-percent">
                        <div className="percent-num high">85<span style={{fontSize:'18px'}}>%</span></div>
                        <div className="percent-label" data-i18n="prob_label">수급 확률</div>
                      </div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-track">
                        <div className="progress-fill green" style={{width:'85%'}}></div>
                      </div>
                      <div className="benefit-chip" data-i18n="pc2_benefit">최대 500만원</div>
                    </div>
                    <div className="policy-action" data-i18n="detail_btn">상세 분석 보기 →</div>
                  </div>

                  {/* INLINE AD */}
                  <div className="inline-ad">
                    <div className="inline-ad-icon">🏦</div>
                    <div className="inline-ad-text">
                      <span className="ad-badge">AD</span>
                      <h5 data-i18n="ad1_name">카카오뱅크 청년 전세 대출</h5>
                      <p data-i18n="ad1_desc">연 2.1%부터 · 최대 2억원 · 5분 비대면 신청</p>
                    </div>
                    <div className="inline-ad-arrow">›</div>
                  </div>

                  {/* Policy 3 - 78% */}
                  <div className="policy-card mid" onClick={() => showDetail('청년-취업성공패키지')}>
                    <button className="scrap-btn" onClick={(e) => handleScrapToggle(e, '청년-취업성공패키지')} title="스크랩 저장" aria-label="스크랩 저장">☆</button>
                    <div className="policy-top-row">
                      <div className="policy-left">
                        <div className="policy-icon blue">💼</div>
                        <div className="policy-meta">
                          <h4 data-i18n="pc3_name">청년도약계좌</h4>
                          <p data-i18n="pc3_desc">만 19~34세 · 개인소득 6,000만원 이하 · 5년 적립</p>
                          <div className="policy-badges">
                            <span className="badge badge-blue" data-i18n="badge_confirm">⚡ 확인 필요</span>
                            <span className="badge badge-blue" data-i18n="pc3_org">금융위</span>
                            <span className="badge badge-gray" data-i18n="pc3_max">최대 5,000만원</span>
                          </div>
                        </div>
                      </div>
                      <div className="policy-percent">
                        <div className="percent-num mid">78<span style={{fontSize:'18px'}}>%</span></div>
                        <div className="percent-label" data-i18n="prob_label">수급 확률</div>
                      </div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-track">
                        <div className="progress-fill blue" style={{width:'78%'}}></div>
                      </div>
                      <div className="benefit-chip" data-i18n="pc3_benefit">정부기여금 포함</div>
                    </div>
                    <div className="policy-action" data-i18n="detail_btn">상세 분석 보기 →</div>
                  </div>

                  {/* Policy 4 - 74% */}
                  <div className="policy-card mid" onClick={() => showDetail('청년-마음건강-지원사업')}>
                    <button className="scrap-btn" onClick={(e) => handleScrapToggle(e, '청년-마음건강-지원사업')} title="스크랩 저장" aria-label="스크랩 저장">☆</button>
                    <div className="policy-top-row">
                      <div className="policy-left">
                        <div className="policy-icon blue">🏥</div>
                        <div className="policy-meta">
                          <h4 data-i18n="pc4_name">청년 마음건강 지원사업</h4>
                          <p data-i18n="pc4_desc">만 19~34세 · 심리상담 바우처 · 연간 10회</p>
                          <div className="policy-badges">
                            <span className="badge badge-green" data-i18n="badge_met">✅ 조건 충족</span>
                            <span className="badge badge-gray" data-i18n="pc4_org">복지부</span>
                            <span className="badge badge-gray" data-i18n="pc4_max">10회 무료</span>
                          </div>
                        </div>
                      </div>
                      <div className="policy-percent">
                        <div className="percent-num mid">74<span style={{fontSize:'18px'}}>%</span></div>
                        <div className="percent-label" data-i18n="prob_label">수급 확률</div>
                      </div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-track">
                        <div className="progress-fill blue" style={{width:'74%'}}></div>
                      </div>
                      <div className="benefit-chip" data-i18n="pc4_benefit">연 80만원 상당</div>
                    </div>
                    <div className="policy-action" data-i18n="detail_btn">상세 분석 보기 →</div>
                  </div>

                  {/* Policy 5 - 41% */}
                  <div className="policy-card low" onClick={() => showDetail('청년창업사관학교')}>
                    <button className="scrap-btn" onClick={(e) => handleScrapToggle(e, '청년창업사관학교')} title="스크랩 저장" aria-label="스크랩 저장">☆</button>
                    <div className="policy-top-row">
                      <div className="policy-left">
                        <div className="policy-icon orange">🚀</div>
                        <div className="policy-meta">
                          <h4 data-i18n="pc5_name">청년창업사관학교</h4>
                          <p data-i18n="pc5_desc">만 39세 이하 · 창업 아이템 보유 · 사업계획서 필요</p>
                          <div className="policy-badges">
                            <span className="badge badge-orange" data-i18n="badge_lack">⚠️ 조건 부족</span>
                            <span className="badge badge-gray" data-i18n="pc5_org">중기부</span>
                            <span className="badge badge-gray" data-i18n="pc5_max">최대 1억원</span>
                          </div>
                        </div>
                      </div>
                      <div className="policy-percent">
                        <div className="percent-num low">41<span style={{fontSize:'18px'}}>%</span></div>
                        <div className="percent-label" data-i18n="prob_label">수급 확률</div>
                      </div>
                    </div>
                    <div className="progress-row">
                      <div className="progress-track">
                        <div className="progress-fill orange" style={{width:'41%'}}></div>
                      </div>
                      <div className="benefit-chip" data-i18n="pc5_benefit">최대 1억원</div>
                    </div>
                    <div className="policy-action" data-i18n="detail_btn">상세 분석 보기 →</div>
                  </div>

                </div>

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
      <nav className="tab-bar" role="navigation" aria-label="하단 메뉴">
        <Link href="/" className="tab-item active" data-tab="home">
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
