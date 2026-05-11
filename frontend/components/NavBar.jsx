'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const LANG_DISPLAY = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  ja: '日本語',
  vi: 'Tiếng Việt',
};

const NAV_LINKS = [
  { href: '/', label: '대시보드', i18n: 'nav_dashboard', key: 'dashboard' },
  { href: '/search', label: '정책 검색', i18n: 'nav_search', key: 'search' },
  { href: '/community', label: '커뮤니티', i18n: 'nav_community', key: 'community' },
];

export default function NavBar({ activePage = '' }) {
  const [mounted, setMounted] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(LANG_DISPLAY.ko);
  const [activeLangCode, setActiveLangCode] = useState('ko');
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);

  const langSelectorRef = useRef(null);
  const avatarWrapRef = useRef(null);

  useEffect(() => {
    setMounted(true);

    try {
      const savedLang = localStorage.getItem('benefic_lang') || 'ko';
      setActiveLangCode(savedLang);
      setCurrentLang(LANG_DISPLAY[savedLang] || LANG_DISPLAY.ko);
    } catch (_) {}

    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('benefic_user');
      if (token && userData) {
        setUser(JSON.parse(userData));
      } else if (token) {
        setUser({ name: '사용자', initial: '사' });
      }
    } catch (_) {}

    const handleClick = (event) => {
      if (langSelectorRef.current && !langSelectorRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
      if (avatarWrapRef.current && !avatarWrapRef.current.contains(event.target)) {
        setAvatarDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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

  useEffect(() => {
    if (!mounted) return;

    const onLangChange = (event) => {
      const lang = event.detail?.lang;
      if (!lang) return;
      setActiveLangCode(lang);
      setCurrentLang(LANG_DISPLAY[lang] || lang);
      try {
        localStorage.setItem('benefic_lang', lang);
      } catch (_) {}
    };

    window.addEventListener('benefic-lang-change', onLangChange);
    return () => window.removeEventListener('benefic-lang-change', onLangChange);
  }, [mounted]);

  const toggleLangDropdown = (event) => {
    event.stopPropagation();
    setAvatarDropdownOpen(false);
    setLangDropdownOpen((prev) => !prev);
  };

  const toggleAvatarDropdown = (event) => {
    event.stopPropagation();
    setLangDropdownOpen(false);
    setAvatarDropdownOpen((prev) => !prev);
  };

  const selectLanguage = (langCode) => {
    const langDisplay = LANG_DISPLAY[langCode] || langCode;
    setCurrentLang(langDisplay);
    setActiveLangCode(langCode);
    setLangDropdownOpen(false);

    if (typeof window !== 'undefined') {
      if (typeof window.saveLang === 'function') window.saveLang(langCode);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof window.applyTranslations === 'function') {
            window.applyTranslations(langCode);
          }
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
          <Link key={key} href={href} className={activePage === key ? 'active' : ''} data-i18n={i18n}>
            {label}
          </Link>
        ))}
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
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
            </svg>
            <span className="lang-label-text" id="currentLangLabel">{currentLang}</span>
            <svg className="lang-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div id="langDropdown" className={`lang-dropdown${langDropdownOpen ? ' visible' : ''}`}>
            <div className="lang-dropdown-inner">
              {Object.entries(LANG_DISPLAY).map(([code, label]) => (
                <div
                  key={code}
                  className={`lang-option${mounted && activeLangCode === code ? ' active' : ''}`}
                  onClick={() => selectLanguage(code)}
                  data-lang-code={code}
                >
                  <span>{label}</span>
                  {mounted && activeLangCode === code && (
                    <svg className="lang-check" viewBox="0 0 13 13" fill="none">
                      <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {mounted && (
          <div className="nav-avatar-wrap" ref={avatarWrapRef} onClick={toggleAvatarDropdown} style={{ position: 'relative', cursor: 'pointer' }}>
            {user ? (
              <>
                <div className="nav-avatar" style={{ cursor: 'pointer' }}>
                  <div className="avatar-circle">{initial}</div>
                  <span className="avatar-name">{userName}님</span>
                  <span>▼</span>
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
                    <div className="avatar-dd-divider" />
                    <Link href="/scrap" className="avatar-dd-item" data-i18n="nav_scrap" onClick={() => setAvatarDropdownOpen(false)}>스크랩</Link>
                    <Link href="/profile" className="avatar-dd-item" data-i18n="nav_user_profile" onClick={() => setAvatarDropdownOpen(false)}>개인정보 수정</Link>
                    <Link href="/recently-viewed" className="avatar-dd-item" data-i18n="nav_user_recently" onClick={() => setAvatarDropdownOpen(false)}>최근 본 공고</Link>
                    <div className="avatar-dd-divider" />
                    <div className="avatar-dd-item logout" onClick={doLogout} data-i18n="nav_user_logout">로그아웃</div>
                  </div>
                </div>
              </>
            ) : (
              <a href="/login" className="btn-login-nav">로그인</a>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
