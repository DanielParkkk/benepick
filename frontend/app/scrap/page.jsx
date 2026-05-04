'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import Link from 'next/link';

const ALL_POLICIES = [
  { id:1, icon:'🏠', cat:'주거', tag:'즉시신청', name:'청년 월세 한시 특별지원', amount:'240만원', amountNum:240, period:'월 20만원 × 12개월', prob:92, date:'2025.04.10', region:'전국', type:'현금지원' },
  { id:2, icon:'📚', cat:'교육', tag:'즉시신청', name:'국민내일배움카드',         amount:'500만원', amountNum:500, period:'훈련비 전액 지원',    prob:88, date:'2025.04.08', region:'전국', type:'바우처'   },
  { id:3, icon:'🏥', cat:'건강', tag:'즉시신청', name:'청년 마음건강 지원',       amount:'80만원',  amountNum:80,  period:'상담 10회 × 8만원',  prob:76, date:'2025.04.07', region:'서울', type:'서비스'   },
  { id:4, icon:'💰', cat:'금융', tag:'조건필요', name:'청년도약계좌',             amount:'70만원/년',amountNum:70, period:'정부기여금 포함',     prob:65, date:'2025.04.05', region:'전국', type:'금융'     },
  { id:5, icon:'🎓', cat:'청년', tag:'조건필요', name:'청년 취업아카데미',        amount:'150만원', amountNum:150, period:'교육비 + 수당',       prob:72, date:'2025.04.02', region:'경기', type:'교육'     },
];

export default function ScrapPage() {
  const router = useRouter();
  const [scrapData, setScrapData] = useState(ALL_POLICIES.map(p => ({...p, checked: false})));
  const [scrapFilter, setScrapFilter] = useState('all');
  const [scrapSearch, setScrapSearch] = useState('');
  const [scrapSort, setScrapSort] = useState('date');
  const [toast, setToast] = useState({ msg: '', show: false, orange: false });
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
  }, []);

  const showToast = (msg, orange = false) => {
    setToast({ msg, show: true, orange });
    setTimeout(() => setToast(prev => ({...prev, show: false})), 2200);
  };

  const getFiltered = () => {
    let d = scrapData;
    if (scrapFilter !== 'all') d = d.filter(p => p.tag === scrapFilter || p.cat.includes(scrapFilter));
    if (scrapSearch) d = d.filter(p => p.name.includes(scrapSearch) || p.cat.includes(scrapSearch));
    if (scrapSort === 'amount') d = [...d].sort((a,b) => b.amountNum - a.amountNum);
    else if (scrapSort === 'prob') d = [...d].sort((a,b) => b.prob - a.prob);
    else d = [...d].sort((a,b) => b.date.localeCompare(a.date));
    return d;
  };

  const toggleCb = (id, checked) => {
    setScrapData(prev => prev.map(p => p.id === id ? {...p, checked} : p));
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setScrapData(prev => prev.map(p => ({...p, checked})));
  };

  const deleteSelected = () => {
    const has = scrapData.some(p => p.checked);
    if (!has) { showToast('삭제할 항목을 선택해주세요'); return; }
    setTimeout(() => {
      setScrapData(prev => prev.filter(p => !p.checked));
      setSelectAll(false);
      showToast('🗑️ 선택한 항목을 삭제했어요');
    }, 280);
  };

  const removeOne = (id) => {
    setTimeout(() => {
      setScrapData(prev => prev.filter(p => p.id !== id));
      showToast('🔖 스크랩에서 제거했어요');
    }, 280);
  };

  const filtered = getFiltered();
  const total = scrapData.reduce((s, p) => s + p.amountNum, 0);
  const sorted = [...scrapData].sort((a,b) => b.amountNum - a.amountNum);

  const FILTERS = [
    { key:'all', label:'전체' }, { key:'즉시신청', label:'즉시신청' },
    { key:'조건필요', label:'조건필요' }, { key:'주거', label:'주거' },
    { key:'교육', label:'교육' }, { key:'금융', label:'금융' },
  ];

  return (
    <>
      <style>{`
        .bookmark-btn{background:transparent;border:none;cursor:pointer;padding:2px;line-height:1;transition:opacity 0.15s;flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .bookmark-btn:hover{opacity:0.55}
        .bookmark-btn svg{width:18px;height:18px;fill:var(--orange);display:block}
        .scrap-page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
        .scrap-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius) var(--radius) 0 0;border-bottom:1px solid var(--gray-100)}
        .scrap-toolbar-left{display:flex;align-items:center;gap:10px}
        .scrap-select-all{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer;user-select:none}
        .scrap-select-all input[type="checkbox"]{width:15px;height:15px;accent-color:var(--orange);cursor:pointer}
        .scrap-toolbar-divider{width:1px;height:14px;background:var(--gray-200)}
        .scrap-search-input{border:none;outline:none;font-size:13px;color:var(--gray-700);font-family:inherit;background:transparent;width:160px}
        .scrap-search-input::placeholder{color:var(--gray-400)}
        .scrap-toolbar-right{display:flex;align-items:center;gap:8px}
        .scrap-sort-select{border:1.5px solid var(--gray-200);border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;color:var(--gray-700);background:#fff;cursor:pointer;font-family:inherit;outline:none}
        .scrap-filter-row{display:flex;gap:6px;padding:10px 16px;background:#fff;border:1px solid var(--gray-200);border-top:none;border-bottom:1px solid var(--gray-100)}
        .scrap-filter-chip{padding:5px 14px;border:1.5px solid var(--gray-200);border-radius:20px;font-size:12px;font-weight:600;color:var(--gray-500);background:#fff;cursor:pointer;transition:all 0.15s;font-family:inherit}
        .scrap-filter-chip:hover{border-color:var(--orange);color:var(--orange)}
        .scrap-filter-chip.active{background:var(--orange);border-color:var(--orange);color:#fff;box-shadow:0 2px 8px rgba(59,130,246,.25)}
        .scrap-grid{display:flex;flex-direction:column;gap:0;background:#fff;border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--radius) var(--radius);overflow:hidden}
        .scrap-policy-card{display:flex;align-items:center;padding:18px 16px;gap:12px;border-bottom:1px solid var(--gray-100);background:#fff;transition:background 0.12s;border-radius:0;box-shadow:none;cursor:default;position:relative}
        .scrap-policy-card:last-child{border-bottom:none}
        .scrap-policy-card:hover{background:var(--gray-50);transform:none;box-shadow:none}
        .scrap-item-cb{width:16px;height:16px;accent-color:var(--orange);cursor:pointer;flex-shrink:0}
        .scrap-card-left{flex:1;min-width:0}
        .scrap-card-category{font-size:11px;font-weight:700;color:var(--blue);margin-bottom:3px;letter-spacing:0.2px}
        .scrap-card-name{font-size:16px;font-weight:700;color:var(--gray-900);line-height:1.4;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .scrap-card-meta{display:flex;align-items:center;flex-wrap:wrap;gap:5px;font-size:12px;color:var(--gray-500);margin-bottom:7px}
        .meta-tag{display:inline-flex;align-items:center;background:var(--gray-100);font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;color:var(--gray-600)}
        .meta-tag.green{background:var(--green-light);color:var(--green)}
        .meta-tag.orange{background:var(--orange-light);color:var(--orange)}
        .meta-dot{color:var(--gray-300)}
        .scrap-card-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;min-width:108px}
        .scrap-apply-btn{display:flex;align-items:center;justify-content:center;background:var(--orange);color:#fff;font-size:13px;font-weight:700;padding:9px 0;border-radius:8px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:background 0.15s;white-space:nowrap;width:100%}
        .scrap-apply-btn:hover{background:#2563EB}
        .scrap-amount-badge{font-size:12px;font-weight:700;color:var(--green)}
        .scrap-date{font-size:11px;color:var(--gray-400);font-weight:500}
        .scrap-empty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
        .scrap-empty-icon{font-size:56px;margin-bottom:16px;opacity:0.4;filter:grayscale(1)}
        .scrap-empty h3{font-size:18px;font-weight:700;color:var(--gray-700);margin-bottom:8px}
        .scrap-empty p{font-size:14px;color:var(--gray-500);margin-bottom:24px;line-height:1.7}
        .scrap-empty-cta{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,var(--blue),var(--blue-dark));color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(59,130,246,.35);transition:all 0.15s}
        .scrap-empty-cta:hover{transform:translateY(-2px)}
        .scrap-toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--gray-900);color:#fff;font-size:13px;font-weight:600;padding:12px 22px;border-radius:30px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9999;opacity:0;transition:opacity 0.2s,transform 0.25s cubic-bezier(.34,1.56,.64,1);display:flex;align-items:center;gap:8px;white-space:nowrap}
        .scrap-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
        .scrap-toast.orange{background:var(--orange)}
        .scrap-sidebar-total{background:linear-gradient(135deg,#0F172A,#1E293B);border:none;border-radius:var(--radius);padding:20px;margin-bottom:16px;box-shadow:0 4px 20px rgba(15,23,42,.2)}
        .scrap-sidebar-total h4{font-size:13px;font-weight:700;color:#94A3B8;margin-bottom:12px}
        .scrap-sidebar-total-amount{font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#10B981;margin-bottom:4px}
        .scrap-sidebar-total-sub{font-size:12px;color:#64748B}
        .scrap-sidebar-card{background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:18px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
        .scrap-sidebar-card h4{font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:12px}
        .scrap-rank-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-100)}
        .scrap-rank-item:last-child{border-bottom:none}
        .scrap-rank-num{width:22px;height:22px;border-radius:50%;background:var(--gray-100);font-size:11px;font-weight:700;color:var(--gray-500);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .scrap-rank-num.top{background:var(--orange-light);color:var(--orange)}
        .scrap-rank-info{flex:1;min-width:0}
        .scrap-rank-name{font-size:13px;font-weight:600;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .scrap-rank-amount{font-size:11px;color:var(--green);font-weight:700}
      `}</style>

      <div className={`scrap-toast${toast.show ? ' show' : ''}${toast.orange ? ' orange' : ''}`} id="scrapToast">{toast.msg}</div>

      <NavBar activePage="" />

      <div className="container">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>

          <div className="scrap-page-header">
            <div>
              <h2 style={{fontSize:'22px',fontWeight:'800',color:'var(--gray-900)',marginBottom:'6px'}}>
                🔖 <span data-i18n="scrap_title">스크랩</span>
              </h2>
              <p style={{fontSize:'14px',color:'var(--gray-500)'}} data-i18n="scrap_desc">관심 있는 정책을 모아서 확인하고 신청 상태를 관리하세요.</p>
            </div>
          </div>

          <div className="grid-main" style={{gridTemplateColumns:'1fr 280px'}}>
            <div>
              {/* Toolbar */}
              <div className="scrap-toolbar">
                <div className="scrap-toolbar-left">
                  <label className="scrap-select-all">
                    <input type="checkbox" id="selectAll" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} />
                    <span data-i18n="scrap_select_all">전체선택</span>
                  </label>
                  <button onClick={deleteSelected} style={{background:'none',border:'none',fontSize:'13px',fontWeight:'600',color:'#E74C3C',cursor:'pointer',padding:'0',fontFamily:'inherit'}} data-i18n="scrap_delete">삭제</button>
                  <div className="scrap-toolbar-divider"></div>
                  <input className="scrap-search-input" type="text" placeholder="검색" data-i18n-placeholder="scrap_search_placeholder"
                    value={scrapSearch} onChange={(e) => setScrapSearch(e.target.value)} />
                </div>
                <div className="scrap-toolbar-right">
                  <select className="scrap-sort-select" value={scrapSort} onChange={(e) => setScrapSort(e.target.value)}>
                    <option value="date" data-i18n-opt="scrap_sort_date">스크랩일</option>
                    <option value="amount" data-i18n-opt="scrap_sort_amount">혜택 큰순</option>
                    <option value="prob" data-i18n-opt="scrap_sort_prob">확률 높은순</option>
                  </select>
                </div>
              </div>

              {/* Filter Chips */}
              <div className="scrap-filter-row">
                {FILTERS.map(({key, label}) => (
                  <button key={key} className={`scrap-filter-chip${scrapFilter === key ? ' active' : ''}`} onClick={() => setScrapFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="scrap-grid" id="scrapGrid">
                {filtered.length === 0 ? (
                  <div className="scrap-empty">
                    <div className="scrap-empty-icon">🔖</div>
                    <h3 data-i18n="scrap_empty">스크랩한 정책이 없습니다.</h3>
                    <p data-i18n="scrap_empty_desc">관심 있는 정책을 담아보세요.<br />정책 카드의 🔖 아이콘을 클릭해 저장할 수 있어요.</p>
                    <Link href="/search" className="scrap-empty-cta">
                      <span data-i18n="scrap_search_link">정책 검색하기</span>
                    </Link>
                  </div>
                ) : filtered.map(p => {
                  const isImmediate = p.tag === '즉시신청';
                  return (
                    <div key={p.id} className="scrap-policy-card" id={`card-${p.id}`}>
                      <input type="checkbox" className="scrap-item-cb" checked={p.checked} onChange={(e) => toggleCb(p.id, e.target.checked)} />
                      <div className="scrap-card-left">
                        <div className="scrap-card-category">{p.icon} {p.cat}</div>
                        <div className="scrap-card-name">{p.name}</div>
                        <div className="scrap-card-meta">
                          <span className={`meta-tag ${isImmediate ? 'green' : 'orange'}`}>{isImmediate ? '✅ 즉시신청' : '⚡ 조건필요'}</span>
                          <span className="meta-dot">·</span><span>{p.region}</span>
                          <span className="meta-dot">·</span><span>{p.type}</span>
                          <span className="meta-dot">·</span><span>{p.period}</span>
                        </div>
                      </div>
                      <div className="scrap-card-right">
                        <Link href="/apply" className="scrap-apply-btn" data-i18n="scrap_apply_btn">즉시신청</Link>
                        <div className="scrap-amount-badge">{p.amount}</div>
                        <div className="scrap-date">~{p.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar */}
            <div>
              <div className="scrap-sidebar-total">
                <h4 data-i18n="scrap_sidebar_total_title">💰 저장 정책 총 혜택</h4>
                <div className="scrap-sidebar-total-amount" id="sidebarTotal">{total.toLocaleString()}만원</div>
                <div className="scrap-sidebar-total-sub" data-i18n="scrap_sidebar_total_sub">스크랩된 정책 기준 연간 예상액</div>
              </div>
              <div className="scrap-sidebar-card">
                <h4 data-i18n="scrap_sidebar_rank_title">🏆 혜택 큰 순서</h4>
                <div id="scrapRankList">
                  {sorted.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="scrap-rank-item">
                      <div className={`scrap-rank-num${i === 0 ? ' top' : ''}`}>{i + 1}</div>
                      <div className="scrap-rank-info">
                        <div className="scrap-rank-name">{p.name}</div>
                        <div className="scrap-rank-amount">{p.amount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="" />
    </>
  );
}
