import Link from 'next/link';

export default function TabBar({ active = 'home' }) {
  const tabs = [
    { key: 'home',      href: '/',          label: '홈',      i18n: 'tab_home',      icon: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
    { key: 'search',    href: '/search',    label: '검색',    i18n: 'tab_search',    icon: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></> },
    { key: 'notice',    href: '/notice',    label: '공지',    i18n: 'tab_notice',    icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></> },
    { key: 'community', href: '/community', label: '커뮤니티', i18n: 'tab_community', icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/> },
    { key: 'profile',   href: '/profile',   label: '프로필',  i18n: 'tab_profile',   icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  ];

  return (
    <nav className="tab-bar" role="navigation" aria-label="하단 메뉴">
      {tabs.map(({ key, href, label, i18n, icon }) => (
        <Link key={key} href={href} className={`tab-item${active === key ? ' active' : ''}`} data-tab={key}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
          <span data-i18n={i18n}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
