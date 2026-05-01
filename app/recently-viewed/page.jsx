'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import Link from 'next/link';

const SAMPLE_ITEMS = [
  { id:1, icon:'🏠', cat:'주거', tag:'즉시신청', name:'청년 월세 한시 특별지원', amount:'240만원', amountNum:240, deadline:'2025.12.31', prob:92, checked:false },
  { id:2, icon:'📚', cat:'교육', tag:'즉시신청', name:'국민내일배움카드',         amount:'500만원', amountNum:500, deadline:'상시',        prob:88, checked:false },
  { id:3, icon:'🏥', cat:'건강', tag:'즉시신청', name:'청년 마음건강 지원',       amount:'80만원',  amountNum:80,  deadline:'2025.10.31', prob:76, checked:false },
  { id:4, icon:'💰', cat:'금융', tag:'조건필요', name:'청년도약계좌',             amount:'70만원/년',amountNum:70, deadline:'상시',        prob:65, checked:false },
  { id:5, icon:'🎓', cat:'청년', tag:'조건필요', name:'청년 취업아카데미',        amount:'150만원', amountNum:150, deadline:'2025.08.31', prob:72, checked:false },
];

export default function RecentlyViewedPage() {
  const router = useRouter();
  const [items, setItems] = useState(SAMPLE_ITEMS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [selectAll, setSelectAll] = useState(false);
  const [toast, setToast] = useState({ msg:'', show:false });

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }

    // localStorage에서 실제 최근 본 항목 로드 시도
    try {
      const rv = JSON.parse(localStorage.getItem('benefic_rv') || '[]');
      if (rv.length > 0) {
        const POLICY_DB = window.POLICY_DB || [];
        const loaded = rv.slice(0, 20).map((name, i) => {
          const p = POLICY_DB.find(p => p.서비스명 === name);
          if (!p) return null;
          return { id: i+1, icon:'📋', cat: p.서비스분야||'복지', tag:'즉시신청', name: p.서비스명, amount: '-', amountNum:0, deadline:'상시', prob:60, checked:false };
        }).filter(Boolean);
        if (loaded.length > 0) setItems(loaded);
      }
    } catch(e) {}
  }, []);

  const showToast = (msg) => {
    setToast({ msg, show:true });
    setTimeout(() => setToast(prev => ({...prev, show:false})), 2200);
  };

  const getFiltered = () => {
    let d = items;
    if (search) d = d.filter(p => p.name.includes(search) || p.cat.includes(search));
    if (sort === 'amount') d = [...d].sort((a,b) => b.amountNum - a.amountNum);
    return d;
  };

  const toggleCb = (id, checked) => setItems(prev => prev.map(p => p.id === id ? {...p, checked} : p));
  const handleSelectAll = (checked) => { setSelectAll(checked); setItems(prev => prev.map(p => ({...p, checked}))); };
  const deleteChecked = () => {
    if (!items.some(p => p.checked)) { showToast('삭제할 항목을 선택해주세요'); return; }
    setTimeout(() => { setItems(prev => prev.filter(p => !p.checked)); setSelectAll(false); showToast('🗑️ 선택한 항목을 삭제했어요'); }, 200);
  };
  const removeOne = (id) => { setItems(prev => prev.filter(p => p.id !== id)); showToast('삭제했어요'); };

  const filtered = getFiltered();
  const total = items.reduce((s, p) => s + p.amountNum, 0);
  const sorted = [...items].sort((a,b) => b.amountNum - a.amountNum);

  return (
    <>
      <style>{`
        .rv-page-header{margin-bottom:24px}
        .rv-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius) var(--radius) 0 0;border-bottom:1px solid var(--gray-100)}
        .rv-toolbar-left{display:flex;align-items:center;gap:10px}
        .rv-toolbar-label{font-size:13px;font-weight:600;color:var(--gray-700)}
        .rv-toolbar-del{background:none;border:none;font-size:13px;font-weight:600;color:#E74C3C;cursor:pointer;padding:0;font-family:inherit}
        .rv-toolbar-divider{width:1px;height:14px;background:var(--gray-200)}
        .rv-search-input{border:none;outline:none;font-size:13px;color:var(--gray-700);font-family:inherit;background:transparent;width:160px}
        .rv-search-input::placeholder{color:var(--gray-400)}
        .rv-sort-select{border:1.5px solid var(--gray-200);border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;color:var(--gray-700);background:#fff;cursor:pointer;font-family:inherit;outline:none}
        .rv-list{display:flex;flex-direction:column;gap:0;background:#fff;border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--radius) var(--radius);overflow:hidden}
        .rv-item{display:flex;align-items:center;padding:16px;gap:12px;border-bottom:1px solid var(--gray-100);background:#fff;transition:background 0.12s}
        .rv-item:last-child{border-bottom:none}
        .rv-item:hover{background:var(--gray-50)}
        .rv-item-cb{width:16px;height:16px;accent-color:var(--blue);cursor:pointer;flex-shrink:0}
        .rv-item-icon{font-size:28px;flex-shrink:0;width:44px;height:44px;border-radius:12px;background:var(--gray-100);display:flex;align-items:center;justify-content:center}
        .rv-item-info{flex:1;min-width:0}
        .rv-item-cat{font-size:11px;font-weight:700;color:var(--blue);margin-bottom:2px}
        .rv-item-name{font-size:15px;font-weight:700;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
        .rv-item-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray-500)}
        .rv-item-tag-badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px}
        .tag-instant{background:var(--green-light);color:var(--green)}
        .tag-cond{background:var(--orange-light);color:var(--orange)}
        .rv-item-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;min-width:100px}
        .rv-item-apply-btn{background:var(--blue);color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none}
        .rv-item-del{background:none;border:none;color:var(--gray-300);cursor:pointer;font-size:16px;padding:4px;transition:color 0.15s;flex-shrink:0}
        .rv-item-del:hover{color:#E74C3C}
        .rv-item-amount{font-size:12px;font-weight:700;color:var(--green)}
        .rv-empty{display:flex;flex-direction:column;align-items:center;padding:60px 40px;text-align:center}
        .rv-empty-icon{font-size:48px;margin-bottom:12px;opacity:0.4}
        .rv-empty h3{font-size:16px;font-weight:700;color:var(--gray-700);margin-bottom:6px}
        .rv-empty p{font-size:13px;color:var(--gray-500)}
        .rv-summary{background:linear-gradient(135deg,#0F172A,#1E293B);border:none;border-radius:var(--radius);padding:20px;margin-bottom:16px}
        .rv-summary-label{font-size:12px;font-weight:700;color:#94A3B8;margin-bottom:8px}
        .rv-summary-amount{font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-weight:800;color:#10B981;margin-bottom:4px}
        .rv-summary-sub{font-size:12px;color:#64748B}
        .rv-sidebar-card{background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:18px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
        .rv-sidebar-card h4{font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:12px}
        .rv-rank-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-100)}
        .rv-rank-item:last-child{border-bottom:none}
        .rv-rank-num{width:22px;height:22px;border-radius:50%;background:var(--gray-100);font-size:11px;font-weight:700;color:var(--gray-500);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .rv-rank-num.top{background:var(--blue-light);color:var(--blue)}
        .rv-rank-name{font-size:13px;font-weight:600;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rv-rank-amount{font-size:11px;color:var(--green);font-weight:700}
        .rv-toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--gray-900);color:#fff;font-size:13px;font-weight:600;padding:12px 22px;border-radius:30px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9999;opacity:0;transition:opacity 0.2s,transform 0.25s cubic-bezier(.34,1.56,.64,1);white-space:nowrap}
        .rv-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      `}</style>

      <div className={`rv-toast${toast.show ? ' show' : ''}`}>{toast.msg}</div>

      <NavBar activePage="" />

      <div className="container">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>

          <div className="rv-page-header">
            <h1 style={{fontSize:'22px',fontWeight:'800',color:'var(--gray-900)',marginBottom:'6px'}} data-i18n="rv_page_title">🕐 최근 본 공고</h1>
            <p style={{fontSize:'14px',color:'var(--gray-500)'}} data-i18n="rv_page_desc">최근에 확인한 정책 공고를 모아서 볼 수 있습니다.</p>
          </div>

          <div className="grid-main" style={{gridTemplateColumns:'1fr 280px'}}>
            <div>
              {/* Toolbar */}
              <div className="rv-toolbar">
                <div className="rv-toolbar-left">
                  <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} id="checkAll" style={{width:'15px',height:'15px',accentColor:'var(--blue)',cursor:'pointer'}} />
                  <label className="rv-toolbar-label" htmlFor="checkAll" data-i18n="rv_select_all">전체선택</label>
                  <button className="rv-toolbar-del" onClick={deleteChecked} data-i18n="rv_delete">삭제</button>
                  <div className="rv-toolbar-divider"></div>
                  <input className="rv-search-input" type="text" placeholder="최근 본 공고 내 검색" data-i18n-placeholder="rv_search_placeholder"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="rv-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent" data-i18n="rv_sort_recent">최근 조회순</option>
                  <option value="amount" data-i18n="rv_sort_amount">혜택 큰 순</option>
                </select>
              </div>

              {/* List */}
              <div className="rv-list">
                {filtered.length === 0 ? (
                  <div className="rv-empty">
                    <div className="rv-empty-icon">🕐</div>
                    <h3 data-i18n="rv_empty_full">최근 본 공고가 없습니다.</h3>
                    <p>정책을 검색하고 상세페이지를 방문해보세요.</p>
                  </div>
                ) : filtered.map(p => (
                  <div key={p.id} className="rv-item">
                    <input type="checkbox" className="rv-item-cb" checked={p.checked} onChange={(e) => toggleCb(p.id, e.target.checked)} />
                    <div className="rv-item-icon">{p.icon}</div>
                    <div className="rv-item-info">
                      <div className="rv-item-cat">{p.cat}</div>
                      <div className="rv-item-name">{p.name}</div>
                      <div className="rv-item-meta">
                        <span className={`rv-item-tag-badge ${p.tag === '즉시신청' ? 'tag-instant' : 'tag-cond'}`}>
                          {p.tag === '즉시신청' ? '✅ 즉시신청' : '⚡ 조건필요'}
                        </span>
                        <span>마감: {p.deadline}</span>
                        <span className="rv-item-amount">{p.amount}</span>
                      </div>
                    </div>
                    <div className="rv-item-right">
                      <Link href="/apply" className="rv-item-apply-btn">즉시신청</Link>
                    </div>
                    <button className="rv-item-del" onClick={() => removeOne(p.id)} title="삭제">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div>
              <div className="rv-summary">
                <div className="rv-summary-label" data-i18n="rv_sidebar_total_label">💰 저장 정책 총 혜택</div>
                <div className="rv-summary-amount">{total.toLocaleString()}만원</div>
                <div className="rv-summary-sub" data-i18n="rv_sidebar_total_sub">최근 본 공고 기준 연간 예상액</div>
              </div>
              <div className="rv-sidebar-card">
                <h4 data-i18n="rv_sidebar_rank_title">🏆 혜택 큰 순서</h4>
                {sorted.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="rv-rank-item">
                    <div className={`rv-rank-num${i === 0 ? ' top' : ''}`}>{i + 1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="rv-rank-name">{p.name}</div>
                      <div className="rv-rank-amount">{p.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="" />
    </>
  );
}
