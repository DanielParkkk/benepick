'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NavBar from '../../../components/NavBar';
import TabBar from '../../../components/TabBar';

export default function NoticeDetailPage() {
  const { id }     = useParams();
  const [notice, setNotice]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res  = await fetch(`/api/notices/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '조회 실패');
        setNotice(json.data);
      } catch (e) {
        setError(e.message || '공지사항을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const formatDate = (val) => (val ? String(val).slice(0, 10) : '');

  if (loading) return (
    <>
      <NavBar activePage="notice" />
      <div style={{ paddingTop: '120px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '14px' }}>불러오는 중...</div>
      <TabBar active="notice" />
    </>
  );

  if (error || !notice) return (
    <>
      <NavBar activePage="notice" />
      <div style={{ paddingTop: '120px', textAlign: 'center', padding: '120px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>😕</div>
        <p style={{ fontSize: '15px', color: 'var(--gray-500)', marginBottom: '20px' }}>{error || '공지사항을 찾을 수 없습니다.'}</p>
        <Link href="/notice" style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--blue)', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>목록으로</Link>
      </div>
      <TabBar active="notice" />
    </>
  );

  return (
    <>
      <NavBar activePage="notice" />
      <div className="container" style={{ paddingTop: '88px', paddingBottom: '100px', maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/notice" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--gray-500)', textDecoration: 'none', marginBottom: '20px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          공지사항 목록
        </Link>

        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid var(--gray-100)', background: notice.pinned ? '#FAFBFF' : 'transparent' }}>
            {notice.pinned && (
              <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', color: 'var(--blue)', background: '#EEF2FF', padding: '3px 8px', borderRadius: '5px', marginBottom: '12px' }}>📌 고정 공지</span>
            )}
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)', lineHeight: '1.5', margin: '0 0 14px 0' }}>{notice.title}</h1>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--gray-500)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {notice.author_name}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--gray-500)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {formatDate(notice.created_at)}
              </span>
            </div>
          </div>
          <div style={{ padding: '32px' }}>
            <div style={{ fontSize: '15px', color: 'var(--gray-700)', lineHeight: '1.9', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {notice.content}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link href="/notice" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 24px', border: '1px solid var(--gray-200)', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', color: 'var(--gray-600)', fontWeight: '500', background: 'var(--white)' }}>
            목록으로 돌아가기
          </Link>
        </div>
      </div>
      <TabBar active="notice" />
    </>
  );
}
