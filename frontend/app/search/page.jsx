'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function SearchPage() {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('한국어');
  const [activeLangCode, setActiveLangCode] = useState('ko');
  const [mounted, setMounted] = useState(false);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const langSelectorRef = useRef(null);
  const avatarWrapRef = useRef(null);

  useEffect(() => {
    // main.js 로딩 타이밍과 경쟁하지 않도록 initSearch를 재시도한다.
    if (typeof window !== 'undefined') {
      let retryCount = 0;
      const ensureSearchInit = () => {
        if (typeof window.initSearch === 'function') {
          window.initSearch();
          return;
        }
        retryCount += 1;
        if (retryCount <= 20) {
          window.setTimeout(ensureSearchInit, 100);
        }
      };
      ensureSearchInit();
    }

    setMounted(true);

    // 저장된 언어 로드
    try {
      const savedLang = localStorage.getItem('benefic_lang') || 'ko';
      const LANG_DISPLAY = { ko:'한국어', en:'English', zh:'中文', ja:'日本語', vi:'Tiếng Việt' };
      setActiveLangCode(savedLang);
      setCurrentLang(LANG_DISPLAY[savedLang] || '한국어');
    } catch(e) {}

    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('benefic_user');
      if (token && userData) setUser(JSON.parse(userData));
      else if (token) setUser({ name: '사용자', initial: '나' });
    } catch (e) {}

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

  // 언어 변경 시 번역 재적용
  useEffect(() => {
    if (!mounted) return;
    if (activeLangCode === 'ko') return;
    const apply = () => {
      if (typeof window !== 'undefined' && typeof window.applyTranslations === 'function') {
        window.applyTranslations(activeLangCode);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }, [activeLangCode, mounted]);

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

  const doSearch = () => {
    if (typeof window !== 'undefined' && typeof window.doSearch === 'function') {
      window.doSearch();
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
          <Link href="/search" className="active" data-i18n="nav_search">정책 검색</Link>
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
        <div className="screen active" id="screen-search">
          <div style={{maxWidth:'860px',margin:'0 auto',padding:'8px 0 40px'}}>
            <div style={{marginBottom:'24px'}}>
              <h2 style={{fontSize:'22px',fontWeight:'800',color:'var(--gray-900)',marginBottom:'6px'}} data-i18n="search_title">🔍 정책 통합 검색</h2>
              <p style={{fontSize:'14px',color:'var(--gray-500)'}} data-i18n="search_subtitle">키워드 검색 또는 자연어로 원하는 복지 정책을 찾아보세요.</p>
            </div>
            <div style={{background:'var(--white)',border:'1px solid var(--gray-200)',borderRadius:'var(--radius)',padding:'20px',boxShadow:'var(--shadow-sm)',marginBottom:'16px'}}>
              <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                <input
                  id="search-input"
                  placeholder="예: 청년 월세, 취업 후 생계 지원, 장애인 활동지원 받고 싶어요"
                  data-i18n-placeholder="search_input_placeholder"
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
                  style={{flex:'1',border:'1px solid var(--gray-200)',borderRadius:'10px',padding:'12px 16px',fontSize:'14px',fontFamily:'inherit',outline:'none',background:'var(--gray-50)',color:'var(--gray-900)',transition:'all .15s'}}
                />
                <button
                  onClick={doSearch}
                  style={{background:'linear-gradient(135deg,var(--blue),var(--blue-dark))',color:'#fff',border:'none',borderRadius:'10px',padding:'12px 24px',fontSize:'14px',fontWeight:'700',fontFamily:'inherit',cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(74,144,226,.3)'}}
                >
                  <span data-i18n="search_btn">🔍 검색</span>
                </button>
              </div>
              <div style={{marginTop:'12px',display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:'12px',color:'var(--gray-500)',fontWeight:'600'}} data-i18n="quick_search_label">빠른 검색:</span>
                <span id="quick-tags" style={{display:'flex',gap:'5px',flexWrap:'wrap'}}></span>
              </div>
            </div>
            <div id="search-status" style={{fontSize:'13px',color:'var(--gray-500)',marginBottom:'12px',minHeight:'18px'}}></div>
            <div id="search-results"></div>
            <div id="search-pagination" style={{display:'none',marginTop:'20px',textAlign:'center'}}></div>
            <div id="search-browse-wrap">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                <h3 style={{fontSize:'15px',fontWeight:'700',color:'var(--gray-900)'}} data-i18n="browse_title">
                  📋 전체 복지 정책 목록
                  <span id="browse-total-badge" style={{fontSize:'12px',fontWeight:'500',color:'var(--gray-500)'}}></span>
                </h3>
              </div>
              <div id="browse-list"></div>
              <div id="browse-pagination" style={{marginTop:'20px',textAlign:'center'}}></div>
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
        <Link href="/search" className="tab-item active" data-tab="search">
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
