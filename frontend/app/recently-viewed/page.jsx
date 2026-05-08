'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function getAuthToken() {
  try { return localStorage.getItem('token') || ''; } catch { return ''; }
}
function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function RecentlyViewedPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [selectAll, setSelectAll] = useState(false);
  const [toast, setToast] = useState({ msg: '', show: false });

  const showToast = (msg) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2200);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const rvRes = await fetch('/api/recently-viewed', { headers: authHeaders() });
      if (rvRes.status === 401) { router.replace('/login'); return; }
      const rvJson = await rvRes.json();
      const rows = rvJson?.data || [];
      if (rows.length === 0) { setItems([]); setLoading(false); return; }

      const ids = rows.map(r => r.policy_id);

      const res = await fetch(`${API_BASE}/api/v1/policies/batch?ids=${ids.join(',')}`);
      const json = await res.json();
      const data = json?.data || [];

      // 서버에서 내려온 순서(최신 열람순) 유지
      const results = ids.map(id => {
        const d = data.find(x => x.policy_id === id);
        if (!d) return null;
        return {
          id: d.policy_id,
          icon: '📋',
          cat: d.badge_items?.[1] || '복지',
          name: d.title,
          amount: d.benefit_amount_label || '-',
          amountNum: d.benefit_amount ? Math.floor(d.benefit_amount / 10000) : 0,
          prob: d.match_score || 0,
          region: d.badge_items?.[1] || '전국',
          checked: false,
        };
      }).filter(Boolean);
      setItems(results);
    } catch (e) {
      console.error(e);
      setItems([]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!getAuthToken()) { router.replace('/login'); return; }
    loadItems();
  }, [loadItems]);

  const getFiltered = () => {
    let d = items;
    if (search) d = d.filter(p => p.name.includes(search) || p.cat.includes(search));
    if (sort === 'amount') d = [...d].sort((a, b) => b.amountNum - a.amountNum);
    else if (sort === 'prob') d = [...d].sort((a, b) => b.prob - a.prob);
    return d;
  };

  const toggleCb = (id, checked) => setItems(prev => prev.map(p => p.id === id ? { ...p, checked } : p));
  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setItems(prev => prev.map(p => ({ ...p, checked })));
  };

  const deleteSelected = async () => {
    const selected = items.filter(p => p.checked).map(p => p.id);
    if (selected.length === 0) { showToast('삭제할 항목을 선택해주세요'); return; }
    try {
      await fetch('/api/recently-viewed', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ policy_ids: selected }),
      });
      setItems(prev => prev.filter(p => !p.checked));
      setSelectAll(false);
      showToast('🗑️ 선택한 항목을 삭제했어요');
    } catch { showToast('삭제 중 오류가 발생했어요'); }
  };

  const removeOne = async (id) => {
    try {
      await fetch('/api/recently-viewed', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ policy_id: id }),
      });
      setItems(prev => prev.filter(p => p.id !== id));
      showToast('제거했어요');
    } catch { showToast('오류가 발생했어요'); }
  };

  const filtered = getFiltered();

  return (
    <>
      <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: toast.show ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(80px)', background: 'var(--gray-900)', color: '#fff', fontSize: '13px', fontWeight: '600', padding: '12px 22px', borderRadius: '30px', zIndex: 9999, opacity: toast.show ? 1 : 0, transition: 'opacity 0.2s,transform 0.25s', whiteSpace: 'nowrap' }}>{toast.msg}</div>

      <NavBar activePage="" />

      <div className="container">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--gray-900)', marginBottom: '6px' }}>🕒 최근 본 공고</h2>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>최근에 확인한 정책 목록이에요.</p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: 'var(--orange)' }} />
                  <span>전체선택</span>
                </label>
                <button onClick={deleteSelected} style={{ background: 'none', border: 'none', fontSize: '13px', fontWeight: '600', color: '#E74C3C', cursor: 'pointer', padding: '0', fontFamily: 'inherit' }}>삭제</button>
                <div style={{ width: '1px', height: '14px', background: 'var(--gray-200)' }}></div>
                <input type="text" placeholder="검색" value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', color: 'var(--gray-700)', fontFamily: 'inherit', background: 'transparent', width: '160px' }} />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ border: '1.5px solid var(--gray-200)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: '600', color: 'var(--gray-700)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
                <option value="recent">최근 본 순</option>
                <option value="amount">혜택 큰순</option>
                <option value="prob">확률 높은순</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-700)' }}>불러오는 중...</h3>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.4, filter: 'grayscale(1)' }}>🕒</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-700)', marginBottom: '8px' }}>최근 본 공고가 없습니다.</h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '24px', lineHeight: 1.7 }}>정책을 클릭하면 여기에 자동으로 저장돼요.</p>
                  <Link href="/search" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'linear-gradient(135deg,var(--blue),var(--blue-dark))', color: '#fff', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>정책 검색하기</Link>
                </div>
              ) : filtered.map((p, idx) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '18px 16px', gap: '12px', borderBottom: '1px solid var(--gray-100)', background: '#fff' }}>
                  <input type="checkbox" checked={p.checked} onChange={(e) => toggleCb(p.id, e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--orange)', cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--gray-100)', fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--blue)', marginBottom: '3px' }}>{p.icon} {p.cat}</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gray-900)', lineHeight: 1.4, marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--gray-500)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--green-light)', fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px', color: 'var(--green)' }}>✅ 즉시신청</span>
                      <span style={{ color: 'var(--gray-300)' }}>·</span><span>{p.region}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, minWidth: '108px' }}>
                    <Link href="/apply" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--orange)', color: '#fff', fontSize: '13px', fontWeight: '700', padding: '9px 0', borderRadius: '8px', textDecoration: 'none', whiteSpace: 'nowrap', width: '100%' }}>즉시신청</Link>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--green)' }}>{p.amount}</div>
                  </div>
                  <button onClick={() => removeOne(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--gray-400)', padding: '4px', borderRadius: '4px' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <TabBar active="" />
    </>
  );
}
