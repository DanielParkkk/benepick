'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';

const ADMIN_TOKEN_KEY = 'benefic_admin_token';

const CATEGORY_MAP = {
  '점검':     { label: '점검',     color: '#F59E0B', bg: '#FEF3C7' },
  '안내':     { label: '안내',     color: '#3B82F6', bg: '#EFF6FF' },
  '정책':     { label: '정책',     color: '#10B981', bg: '#ECFDF5' },
  '업데이트': { label: '업데이트', color: '#8B5CF6', bg: '#F5F3FF' },
};

function getCategory(title) {
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (title.includes(key)) return val;
  }
  return { label: '공지', color: '#64748B', bg: '#F1F5F9' };
}

async function apiFetch(path, options = {}) {
  const res  = await fetch(path, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `요청 실패 (${res.status})`);
  return json.data;
}

export default function NoticePage() {
  const [notices, setNotices]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [isAdmin, setIsAdmin]             = useState(false);
  const [adminToken, setAdminToken]       = useState('');
  const [showCreate, setShowCreate]       = useState(false);
  const [showDelete, setShowDelete]       = useState(null);
  const [newTitle, setNewTitle]           = useState('');
  const [newContent, setNewContent]       = useState('');
  const [newPinned, setNewPinned]         = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError]     = useState('');
  const [hoveredId, setHoveredId]         = useState(null);

  const loadNotices = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const d = await apiFetch('/api/notices');
      setNotices(d.items);
    } catch { setError('공지사항을 불러오는데 실패했습니다.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const restore = async () => {
      try {
        const t = localStorage.getItem(ADMIN_TOKEN_KEY);
        if (!t) return;
        const res = await fetch('/api/admin/verify', { headers: { Authorization: `Bearer ${t}` } });
        if (res.ok) { setAdminToken(t); setIsAdmin(true); }
        else localStorage.removeItem(ADMIN_TOKEN_KEY);
      } catch {}
    };
    restore(); loadNotices();
  }, [loadNotices]);

  const handleLogout = () => {
    setIsAdmin(false); setAdminToken('');
    try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreateLoading(true); setCreateError('');
    try {
      await apiFetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim(), pinned: newPinned }),
      });
      setShowCreate(false); setNewTitle(''); setNewContent(''); setNewPinned(false);
      await loadNotices();
    } catch (e) {
      if (e.message.includes('401')) { setCreateError('세션 만료. 다시 로그인하세요.'); handleLogout(); }
      else setCreateError(e.message);
    } finally { setCreateLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`/api/notices/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
      setShowDelete(null); await loadNotices();
    } catch (e) {
      if (e.message.includes('401')) { alert('세션 만료. 다시 로그인하세요.'); handleLogout(); }
      else alert('삭제 실패');
      setShowDelete(null);
    }
  };

  const fmt = (v) => v ? String(v).slice(0, 10) : '';
  const pinnedList = notices.filter(n => n.pinned);
  const normalList = notices.filter(n => !n.pinned);

  return (
    <>
      <NavBar activePage="notice" />
      <style>{`
        .notice-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .notice-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(59,130,246,0.10); }
        .chip { display:inline-flex; align-items:center; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.3px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
      `}</style>

      <div style={{ paddingTop: '88px', paddingBottom: '100px', maxWidth: '1100px', margin: '0 auto', padding: '88px 40px 100px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gray-900)', margin: '0 0 4px' }}>공지사항</h1>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>베네픽의 새로운 소식을 확인하세요</p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ 공지 등록</button>
              <button onClick={handleLogout} style={{ padding: '8px 12px', background: 'var(--gray-100)', color: 'var(--gray-600)', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>관리자 로그아웃</button>
            </div>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div style={{ padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#B91C1C' }}>
            {error} <button onClick={loadNotices} style={{ marginLeft: '8px', color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>다시 시도</button>
          </div>
        )}

        {/* 공지 목록 */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '14px', background: '#fff', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '14px', background: '#fff', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>등록된 공지사항이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...pinnedList, ...normalList].map((notice, idx) => {
              const cat = getCategory(notice.title);
              return (
                <div key={notice.id} className="notice-card fade-in"
                  style={{ background: '#fff', border: `1px solid ${hoveredId === notice.id ? 'var(--blue)' : 'var(--gray-200)'}`, borderRadius: '14px', overflow: 'hidden', animationDelay: `${idx * 0.05}s` }}
                  onMouseEnter={() => setHoveredId(notice.id)} onMouseLeave={() => setHoveredId(null)}
                >
                  <Link href={`/notice/${notice.id}`} style={{ display: 'block', padding: '20px 28px', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {notice.pinned && <span style={{ fontSize: '10px', fontWeight: '700', color: '#F59E0B', background: '#FEF3C7', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>고정</span>}
                      <span className="chip" style={{ color: cat.color, background: cat.bg, flexShrink: 0 }}>{cat.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-900)', lineHeight: '1.4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notice.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {notice.author_name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fmt(notice.created_at)}
                      </span>
                    </div>
                  </Link>
                  {isAdmin && (
                    <div style={{ padding: '0 28px 16px' }}>
                      <button onClick={() => setShowDelete(notice.id)} style={{ padding: '4px 10px', background: 'transparent', color: '#EF4444', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>삭제</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 공지 등록 모달 */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '20px', color: 'var(--gray-900)' }}>공지사항 등록</h2>
            {createError && <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: '#B91C1C' }}>{createError}</div>}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray-600)', display: 'block', marginBottom: '6px' }}>제목</label>
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="공지 제목을 입력하세요" style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray-600)', display: 'block', marginBottom: '6px' }}>내용</label>
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="공지 내용을 입력하세요" rows={6} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.6' }} />
            </div>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="pin" checked={newPinned} onChange={e => setNewPinned(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="pin" style={{ fontSize: '13px', color: 'var(--gray-700)', cursor: 'pointer' }}>상단 고정</label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setNewTitle(''); setNewContent(''); setNewPinned(false); setCreateError(''); }} style={{ padding: '10px 18px', background: 'var(--gray-100)', color: 'var(--gray-600)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim() || createLoading} style={{ padding: '10px 18px', background: newTitle.trim() && newContent.trim() && !createLoading ? 'var(--blue)' : 'var(--gray-200)', color: newTitle.trim() && newContent.trim() && !createLoading ? '#fff' : 'var(--gray-400)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', minWidth: '72px' }}>
                {createLoading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gray-900)', marginBottom: '8px' }}>공지를 삭제하시겠습니까?</h3>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '20px' }}>삭제된 공지는 복구할 수 없습니다.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowDelete(null)} style={{ flex: 1, padding: '10px', background: 'var(--gray-100)', color: 'var(--gray-600)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>취소</button>
              <button onClick={() => handleDelete(showDelete)} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      <TabBar active="notice" />
    </>
  );
}
