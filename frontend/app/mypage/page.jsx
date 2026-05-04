'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import { logout, auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser]         = useState(null);
  const [scrapCount, setScrapCount]   = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }

    const stored = (() => { try { return JSON.parse(localStorage.getItem('benefic_user') || '{}'); } catch { return {}; } })();
    setUser(stored);

    // 각 카운트 로드
    try { setScrapCount(JSON.parse(localStorage.getItem('scrapped') || '[]').length); } catch {}
    try { setRecentCount(JSON.parse(localStorage.getItem('recentlyViewed') || '[]').length); } catch {}

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(prev => ({ ...prev, name: u.displayName || prev?.name, email: u.email || prev?.email, photo: u.photoURL || prev?.photo }));
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const displayName = user?.name || '사용자';
  const displayEmail = user?.email || '';
  const initial = displayName[0]?.toUpperCase() || '나';
  const photo = user?.photo || null;

  const chevron = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );

  return (
    <>
      <style>{`
        .my-page { background: #f5f6fa; min-height: 100vh; padding-bottom: 80px; }
        .my-header { background: linear-gradient(135deg, #4A90E2, #2ECC71); padding: 32px 20px 28px; color: #fff; }
        .my-avatar { width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; flex-shrink: 0; }
        .my-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .my-name { font-size: 20px; font-weight: 800; margin-bottom: 2px; }
        .my-email { font-size: 13px; opacity: 0.85; margin-bottom: 10px; }
        .my-badge { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.2); border-radius: 99px; padding: 4px 12px; font-size: 12px; font-weight: 600; }
        .my-stats { display: grid; grid-template-columns: repeat(3, 1fr); background: #fff; border-bottom: 1px solid #f0f0f0; }
        .my-stat { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 0; border-right: 1px solid #f0f0f0; }
        .my-stat:last-child { border-right: none; }
        .my-stat-num { font-size: 22px; font-weight: 800; color: #111; line-height: 1; margin-bottom: 4px; }
        .my-stat-num.orange { color: #f59e0b; }
        .my-stat-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
        .my-section { margin: 16px 16px 0; }
        .my-section-title { font-size: 12px; font-weight: 700; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px; padding-left: 4px; }
        .my-card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .my-row { display: flex; align-items: center; gap: 14px; padding: 15px 16px; border-bottom: 1px solid #f5f5f5; text-decoration: none; cursor: pointer; background: #fff; width: 100%; border: none; font-family: inherit; }
        .my-row:last-child { border-bottom: none; }
        .my-row-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .my-row-text { flex: 1; text-align: left; }
        .my-row-label { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 1px; }
        .my-row-desc { font-size: 12px; color: #9ca3af; }
        .my-row-badge { background: #e8f0fe; color: #4A90E2; font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 99px; margin-right: 6px; }
        .my-toggle { width: 44px; height: 24px; background: #e5e7eb; border-radius: 99px; position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0; border: none; }
        .my-toggle.on { background: #4A90E2; }
        .my-toggle-thumb { width: 18px; height: 18px; background: #fff; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: left .2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .my-toggle.on .my-toggle-thumb { left: 23px; }
        .my-logout-row { color: #e74c3c !important; }
        .my-logout-row .my-row-label { color: #e74c3c; }
      `}</style>

      <NavBar activePage="" />
      <div className="my-page">

        {/* 헤더 */}
        <div className="my-header">
          <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
            <div className="my-avatar">
              {photo ? <img src={photo} alt="프로필" /> : initial}
            </div>
            <div>
              <div className="my-name">{displayName}님</div>
              <div className="my-email">{displayEmail}</div>
              <div className="my-badge">
                <span>🎯</span>
                <span>예상 연간 혜택 분석 전</span>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 */}
        <div className="my-stats">
          <div className="my-stat">
            <div className="my-stat-num">{scrapCount}</div>
            <div className="my-stat-label">스크랩</div>
          </div>
          <div className="my-stat">
            <div className="my-stat-num">{portfolioCount}</div>
            <div className="my-stat-label">포트폴리오</div>
          </div>
          <div className="my-stat">
            <div className="my-stat-num orange">{recentCount}</div>
            <div className="my-stat-label">최근 조회</div>
          </div>
        </div>

        {/* 내 프로필 */}
        <div className="my-section">
          <div className="my-section-title">내 프로필</div>
          <div className="my-card">
            <Link href="/profile" className="my-row">
              <div className="my-row-icon" style={{background:'#f0f4ff'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">개인정보 수정</div>
                <div className="my-row-desc">닉네임, 이메일, 생년월일</div>
              </div>
              {chevron}
            </Link>
          </div>
        </div>

        {/* 활동 내역 */}
        <div className="my-section">
          <div className="my-section-title">활동 내역</div>
          <div className="my-card">
            <Link href="/scrap" className="my-row">
              <div className="my-row-icon" style={{background:'#fff0f0'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">나의 스크랩</div>
                <div className="my-row-desc">저장한 복지 정책 모아보기</div>
              </div>
              {scrapCount > 0 && <span className="my-row-badge">{scrapCount}</span>}
              {chevron}
            </Link>
            <Link href="/recently-viewed" className="my-row">
              <div className="my-row-icon" style={{background:'#fff8ed'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">최근 본 공고</div>
                <div className="my-row-desc">내가 최근에 확인한 정책 목록</div>
              </div>
              {recentCount > 0 && <span className="my-row-badge">{recentCount}</span>}
              {chevron}
            </Link>
            <Link href="/portfolio" className="my-row">
              <div className="my-row-icon" style={{background:'#f0fdf4'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ECC71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">내 포트폴리오</div>
                <div className="my-row-desc">나에게 맞는 정책 조합 보기</div>
              </div>
              {chevron}
            </Link>
          </div>
        </div>

        {/* 설정 및 기타 */}
        <div className="my-section">
          <div className="my-section-title">설정 및 기타</div>
          <div className="my-card">
            <div className="my-row" style={{cursor:'default'}}>
              <div className="my-row-icon" style={{background:'#fff8ed'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">푸시 알림</div>
                <div className="my-row-desc">새 복지 정책 알림 받기</div>
              </div>
              <button className={`my-toggle${pushEnabled ? ' on' : ''}`} onClick={() => setPushEnabled(p => !p)}>
                <div className="my-toggle-thumb" />
              </button>
            </div>
            <div className="my-row" style={{cursor:'default'}}>
              <div className="my-row-icon" style={{background:'#f0f4ff'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">언어 설정</div>
                <div className="my-row-desc">한국어</div>
              </div>
              {chevron}
            </div>
            <div className="my-row" style={{cursor:'default'}}>
              <div className="my-row-icon" style={{background:'#f5f5f5'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">앱 정보</div>
                <div className="my-row-desc">베네픽 v2.4 · 이용약관 · 개인정보처리방침</div>
              </div>
              {chevron}
            </div>
          </div>
        </div>

        {/* 로그아웃 */}
        <div className="my-section" style={{marginTop:'16px'}}>
          <div className="my-card">
            <button className="my-row my-logout-row" onClick={handleLogout}>
              <div className="my-row-icon" style={{background:'#fff5f5'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <div className="my-row-text">
                <div className="my-row-label">로그아웃</div>
                <div className="my-row-desc">현재 기기에서 로그아웃합니다</div>
              </div>
              {chevron}
            </button>
          </div>
        </div>

        <div style={{height:'16px'}} />
      </div>
      <TabBar active="profile" />
    </>
  );
}
