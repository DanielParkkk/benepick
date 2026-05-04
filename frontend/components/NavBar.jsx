'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function NavBar({ activePage = '' }) {
  const [mounted, setMounted] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('한국어');
  const [activeLangCode, setActiveLangCode] = useState('ko');
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

    // 사용자 정보 로드
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('benefic_user');
      if (token && userData) {
        setUser(JSON.parse(userData));
      } else if (token) {
        setUser({ name: '사용자', initial: '나' });
      }
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

  // i18n.js(window.selectLanguage)가 보내는 언어 변경 이벤트 수신
  // → React state 동기화 (이 경로로 오면 applyTranslations는 i18n.js가 이미 호출함)
  useEffect(() => {
    if (!mounted) return;
    const LANG_DISPLAY = { ko:'한국어', en:'English', zh:'中文', ja:'日本語', vi:'Tiếng Việt' };
    const onLangChange = (e) => {
      const lang = e.detail?.lang;
      if (!lang) return;
      setActiveLangCode(lang);
      setCurrentLang(LANG_DISPLAY[lang] || lang);
      try { localStorage.setItem('benefic_lang', lang); } catch(_) {}
    };
    window.addEventListener('benefic-lang-change', onLangChange);
    return () => window.removeEventListener('benefic-lang-change', onLangChange);
  }, [mounted]);

  const toggleLangDropdown = (e) => {
    e.stopPropagation();
    setAvatarDropdownOpen(false);
    setLangDropdownOpen(prev => !prev);
  };

  const toggleAvatarDropdown = (e) => {
    e.stopPropagation();
    setLangDropdownOpen(false);
    setAvatarDropdownOpen(prev => !prev);
  };

  const selectLanguage = (langDisplay, langCode) => {
    setCurrentLang(langDisplay);
    setActiveLangCode(langCode);
    setLangDropdownOpen(false);
    if (typeof window !== 'undefined') {
      if (typeof window.saveLang === 'function') window.saveLang(langCode);
      // React re-render 완료 후 번역 적용 (requestAnimationFrame × 2로 보장)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof window.applyTranslations === 'function') window.applyTranslations(langCode);
          // custom event로 layout의 observer에도 알림
          window.dispatchEvent(new CustomEvent('benefic-lang-change', { detail: { lang: langCode } }));
        });
      });
    }
  };

  const doLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('benefic_user');
    window.location.href = '/login';
  };

  const NAV_LINKS = [
    { href: '/', label: '대시보드', i18n: 'nav_dashboard', key: 'dashboard' },
    { href: '/search', label: '정책 검색', i18n: 'nav_search', key: 'search' },
    { href: '/analysis', label: '탈락 이유', i18n: 'nav_analysis', key: 'analysis' },
    { href: '/portfolio', label: '포트폴리오', i18n: 'nav_portfolio', key: 'portfolio' },
    { href: '/apply', label: '신청 보조', i18n: 'nav_apply', key: 'apply' },
    { href: '/community', label: '커뮤니티', i18n: 'nav_community', key: 'community' },
  ];

  const initial = user?.initial || user?.name?.[0] || '나';
  const userName = user?.name || '사용자';

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <div className="logo-mark">B</div>
        <div className="logo-text">
          <span className="logo-name" data-i18n="logo_name">베네픽</span>
          <span className="logo-tag" data-i18n="logo_tag">나를 위한 맞춤 복지 추천</span>
        </div>
      </Link>

      <div className="nav-center">
        {NAV_LINKS.map(({ href, label, i18n, key }) => (
          <Link key={key} href={href} className={activePage === key ? 'active' : ''} data-i18n={i18n}>{label}</Link>
        ))}
      </div>

      <div className="nav-right">
        {/* 언어 선택 */}
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

        {/* 아바타 드롭다운 — React로 완전 관리 */}
        {mounted && (
          <div className="nav-avatar-wrap" ref={avatarWrapRef} onClick={toggleAvatarDropdown} style={{ position: 'relative', cursor: 'pointer' }}>
            {user ? (
              <>
                <div className="nav-avatar" style={{ cursor: 'pointer' }}>
                  <div className="avatar-circle">{initial}</div>
                  <span className="avatar-name">{userName}님</span>
                  <span>▾</span>
                </div>
                <div className={`avatar-dropdown${avatarDropdownOpen ? ' open' : ''}`} id="avatarDropdown">
                  <div className="avatar-dropdown-inner">
                    <div className="avatar-dd-header">
                      <div className="avatar-dd-circle">{initial}</div>
                      <div>
                        <div className="avatar-dd-name">{userName}님</div>
                        <div className="avatar-dd-email">{user.email || ''}</div>
                      </div>
                    </div>
                    <div className="avatar-dd-divider"></div>
                    <Link href="/scrap" className="avatar-dd-item" data-i18n="nav_scrap" onClick={() => setAvatarDropdownOpen(false)}>스크랩</Link>
                    <Link href="/portfolio" className="avatar-dd-item" data-i18n="nav_user_portfolio" onClick={() => setAvatarDropdownOpen(false)}>내 포트폴리오</Link>
                    <Link href="/profile" className="avatar-dd-item" data-i18n="nav_user_profile" onClick={() => setAvatarDropdownOpen(false)}>개인정보 수정</Link>
                    <Link href="/recently-viewed" className="avatar-dd-item" data-i18n="nav_user_recently" onClick={() => setAvatarDropdownOpen(false)}>최근 본 공고</Link>
                    <div className="avatar-dd-divider"></div>
                    <div className="avatar-dd-item logout" onClick={doLogout} data-i18n="nav_user_logout">로그아웃</div>
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
  );
}
