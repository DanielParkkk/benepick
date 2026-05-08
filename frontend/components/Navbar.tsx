"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const NAV_LINKS = [
  { href: "/", label: "대시보드", i18n: "nav_dashboard" },
  { href: "/search", label: "정책 검색", i18n: "nav_search" },
  { href: "/community", label: "커뮤니티", i18n: "nav_community" },
  { href: "/notice", label: "공지사항", i18n: "nav_notice" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("한국어");
  const [activeLangCode, setActiveLangCode] = useState("ko");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; initial?: string; email?: string } | null>(null);

  const langSelectorRef = useRef<HTMLDivElement>(null);
  const avatarWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // 저장된 언어 로드
    try {
      const savedLang = localStorage.getItem('benefic_lang') || 'ko';
      const LANG_DISPLAY: Record<string, string> = { ko:'한국어', en:'English', zh:'中文', ja:'日本語', vi:'Tiếng Việt' };
      setActiveLangCode(savedLang);
      setCurrentLang(LANG_DISPLAY[savedLang] || '한국어');
    } catch(e) {}

    try {
      const adminToken = localStorage.getItem("benefic_admin_token");
      if (adminToken) {
        setUser({ name: "관리자", initial: "관", email: "" });
      } else {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("benefic_user");
        if (token && userData) {
          setUser(JSON.parse(userData));
        } else if (token) {
          setUser({ name: "사용자", initial: "나" });
        }
      }
    } catch (e) {}

    const handleClick = (e: MouseEvent) => {
      if (langSelectorRef.current && !langSelectorRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (avatarWrapRef.current && !avatarWrapRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // 언어 변경 시 번역 재적용
  useEffect(() => {
    if (!mounted) return;
    if (activeLangCode === 'ko') return;
    const apply = () => {
      if (typeof window !== 'undefined' && typeof (window as any).applyTranslations === 'function') {
        (window as any).applyTranslations(activeLangCode);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }, [activeLangCode, mounted]);

  // i18n.js(window.selectLanguage)가 보내는 언어 변경 이벤트 수신
  useEffect(() => {
    if (!mounted) return;
    const LANG_DISPLAY: Record<string, string> = { ko:'한국어', en:'English', zh:'中文', ja:'日本語', vi:'Tiếng Việt' };
    const onLangChange = (e: Event) => {
      const lang = (e as CustomEvent).detail?.lang;
      if (!lang) return;
      setActiveLangCode(lang);
      setCurrentLang(LANG_DISPLAY[lang] || lang);
      try { localStorage.setItem('benefic_lang', lang); } catch(_) {}
    };
    window.addEventListener('benefic-lang-change', onLangChange);
    return () => window.removeEventListener('benefic-lang-change', onLangChange);
  }, [mounted]);

  const toggleLang = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarOpen(false);
    setLangOpen((prev) => !prev);
  };

  const toggleAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLangOpen(false);
    setAvatarOpen((prev) => !prev);
  };

  const selectLanguage = (langDisplay: string, langCode: string) => {
    setCurrentLang(langDisplay);
    setActiveLangCode(langCode);
    setLangOpen(false);
    if (typeof window !== "undefined") {
      if (typeof (window as any).saveLang === "function") (window as any).saveLang(langCode);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof (window as any).applyTranslations === "function") (window as any).applyTranslations(langCode);
          window.dispatchEvent(new CustomEvent('benefic-lang-change', { detail: { lang: langCode } }));
        });
      });
    }
  };

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("benefic_user");
    localStorage.removeItem("benefic_admin_token");
    window.location.href = "/login";
  };

  const initial = user?.initial || user?.name?.[0] || "나";
  const userName = user?.name || "사용자";

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
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""} data-i18n={link.i18n}>
            {link.label}
          </Link>
        ))}
      </div>

      <div className="nav-right">
        {/* 언어 선택 */}
        <div id="langSelector" className="lang-selector" ref={langSelectorRef}>
          <button id="langBtn" className={`lang-btn${langOpen ? " open" : ""}`} onClick={toggleLang} aria-haspopup="true" aria-expanded={langOpen}>
            <svg className="globe-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
            </svg>
            <span className="lang-label-text" id="currentLangLabel">{currentLang}</span>
            <svg className="lang-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div id="langDropdown" className={`lang-dropdown${langOpen ? " visible" : ""}`}>
            <div className="lang-dropdown-inner">
              <div className={`lang-option${mounted && activeLangCode === "ko" ? " active" : ""}`} onClick={() => selectLanguage("한국어", "ko")} data-lang-code="ko">
                <span className="lang-flag">🇰🇷</span><span>한국어</span>
                {mounted && activeLangCode === "ko" && <svg className="lang-check" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className={`lang-option${mounted && activeLangCode === "en" ? " active" : ""}`} onClick={() => selectLanguage("English", "en")} data-lang-code="en"><span className="lang-flag">🇺🇸</span><span>English</span></div>
              <div className="lang-divider" />
              <div className={`lang-option${mounted && activeLangCode === "ja" ? " active" : ""}`} onClick={() => selectLanguage("日本語", "ja")} data-lang-code="ja"><span className="lang-flag">🇯🇵</span><span>日本語</span></div>
              <div className={`lang-option${mounted && activeLangCode === "zh" ? " active" : ""}`} onClick={() => selectLanguage("中文", "zh")} data-lang-code="zh"><span className="lang-flag">🇨🇳</span><span>中文</span></div>
              <div className={`lang-option${mounted && activeLangCode === "vi" ? " active" : ""}`} onClick={() => selectLanguage("Tiếng Việt", "vi")} data-lang-code="vi"><span className="lang-flag">🇻🇳</span><span>Tiếng Việt</span></div>
            </div>
          </div>
        </div>

        {/* 아바타 드롭다운 — React로 완전 관리 */}
        {mounted && (
          <div className="nav-avatar-wrap" ref={avatarWrapRef} onClick={toggleAvatar} style={{ position: "relative", cursor: "pointer" }}>
            {user ? (
              <>
                <div className="nav-avatar" style={{ cursor: "pointer" }}>
                  <div className="avatar-circle">{initial}</div>
                  <span className="avatar-name">{userName}님</span>
                  <span>▾</span>
                </div>
                <div className={`avatar-dropdown${avatarOpen ? " open" : ""}`} id="avatarDropdown">
                  <div className="avatar-dropdown-inner">
                    <div className="avatar-dd-header">
                      <div className="avatar-dd-circle">{initial}</div>
                      <div>
                        <div className="avatar-dd-name">{userName}님</div>
                        <div className="avatar-dd-email">{user.email || ""}</div>
                      </div>
                    </div>
                    <div className="avatar-dd-divider"></div>
                    <Link href="/scrap" className="avatar-dd-item" data-i18n="nav_scrap" onClick={() => setAvatarOpen(false)}>스크랩</Link>
                    <Link href="/portfolio" className="avatar-dd-item" data-i18n="nav_user_portfolio" onClick={() => setAvatarOpen(false)}>내 포트폴리오</Link>
                    <Link href="/profile" className="avatar-dd-item" data-i18n="nav_user_profile" onClick={() => setAvatarOpen(false)}>개인정보 수정</Link>
                    <Link href="/recently-viewed" className="avatar-dd-item" data-i18n="nav_user_recently" onClick={() => setAvatarOpen(false)}>최근 본 공고</Link>
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
