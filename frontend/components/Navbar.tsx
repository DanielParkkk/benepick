"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/search", label: "정책 검색" },
  { href: "/analysis", label: "상세 분석" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/apply", label: "신청 보조" },
  { href: "/community", label: "커뮤니티" },
];

const LANG_OPTIONS = [
  { flag: "🇰🇷", label: "한국어", code: "ko" },
  { flag: "🇺🇸", label: "English", code: "en" },
  { flag: "🇯🇵", label: "日本語", code: "ja" },
  { flag: "🇻🇳", label: "Tiếng Việt", code: "vi" },
  { flag: "🇨🇳", label: "中文", code: "zh" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("한국어");

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <div className="logo-mark">B</div>
        <div className="logo-text">
          <span className="logo-name">베네픽</span>
          <span className="logo-tag">복지 수급 확률 분석 v2.0</span>
        </div>
      </Link>

      <div className="nav-center">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active" : ""}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="nav-right">
        <div className="lang-selector">
          <button
            className={`lang-btn${langOpen ? " open" : ""}`}
            onClick={() => setLangOpen(!langOpen)}
            aria-haspopup="true"
            aria-expanded={langOpen}
          >
            <svg
              className="globe-svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
            </svg>
            <span className="lang-label-text">{currentLang}</span>
            <svg
              className="lang-chevron"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div className={`lang-dropdown${langOpen ? " visible" : ""}`}>
            <div className="lang-dropdown-inner">
              {LANG_OPTIONS.map((opt, i) => (
                <div key={opt.code}>
                  {i === 2 && <div className="lang-divider" />}
                  <div
                    className={`lang-option${currentLang === opt.label ? " active" : ""}`}
                    onClick={() => {
                      setCurrentLang(opt.label);
                      setLangOpen(false);
                    }}
                  >
                    <span className="lang-flag">{opt.flag}</span>
                    <span>{opt.label}</span>
                    {currentLang === opt.label && (
                      <svg
                        className="lang-check"
                        viewBox="0 0 13 13"
                        fill="none"
                      >
                        <path
                          d="M2 6.5l3.5 3.5 5.5-6"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="nav-avatar">
          <div className="avatar-circle">남</div>
          <span className="avatar-name">남정현님</span>
          <span>▾</span>
        </div>
      </div>
    </nav>
  );
}
