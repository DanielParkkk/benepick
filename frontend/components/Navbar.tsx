"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "대시보드", i18n: "nav_dashboard" },
  { href: "/search", label: "정책 검색", i18n: "nav_search" },
  { href: "/community", label: "커뮤니티", i18n: "nav_community" },
  { href: "/notices", label: "공지사항", i18n: "nav_notices" },
];

export default function Navbar() {
  const pathname = usePathname();

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
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active" : ""}
            data-i18n={link.i18n}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="nav-right" />
    </nav>
  );
}
