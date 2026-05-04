'use client';

import { useEffect } from 'react';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';

export default function PolicyDetailPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (typeof window.initAuthNav === 'function') window.initAuthNav();

    // policy-detail.html의 인라인 스크립트 로직을 그대로 실행
    const CATEGORY_ICONS = {
      '주거': '🏠', '고용': '💼', '금융': '💰', '보건': '🏥',
      '창업': '🚀', '기초생활': '🛡️', '가족': '👨‍👩‍👧', '노인': '👴',
      '장애인': '♿', '교육': '🎓',
    };
    const TYPE_TAG_CLASS = { '현금': 'pd-tag-green', '이용권': 'pd-tag-blue', '서비스': 'pd-tag-orange' };

    function fmtPhone(tel) { return tel ? tel.replace(/[^0-9\-]/g, '') : ''; }
    function extractBenefit(p) {
      const txt = p.지원내용 || '';
      const match = txt.match(/[\d,]+만원|최대\s*[\d,]+원|월\s*[\d,]+만?원/);
      return match ? match[0] : (txt.substring(0, 20) + '...');
    }
    function getRelated(current, db) {
      return db.filter(p => p.서비스명 !== current.서비스명 &&
        (p.서비스분야 === current.서비스분야 || p.지원유형 === current.지원유형)).slice(0, 4);
    }

    window.switchTab = function(tabId) {
      document.querySelectorAll('.pd-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });
      document.querySelectorAll('.pd-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'pd-panel-' + tabId);
      });
    };

    let _isScraped = false;
    window.toggleScrap = function(policyName) {
      _isScraped = !_isScraped;
      const btn = document.getElementById('pdScrapBtn');
      if (!btn) return;
      if (_isScraped) { btn.classList.add('active'); btn.innerHTML = '⭐ 스크랩됨'; }
      else { btn.classList.remove('active'); btn.innerHTML = '☆ 스크랩'; }
      try {
        const scraps = JSON.parse(localStorage.getItem('benefic_scraps') || '[]');
        if (_isScraped) { if (!scraps.includes(policyName)) scraps.push(policyName); }
        else { const idx = scraps.indexOf(policyName); if (idx > -1) scraps.splice(idx, 1); }
        localStorage.setItem('benefic_scraps', JSON.stringify(scraps));
      } catch(e) {}
    };

    window.sharePolicy = function(name) {
      if (navigator.share) { navigator.share({ title: name + ' — 베네픽', url: location.href }).catch(() => {}); }
      else { try { navigator.clipboard.writeText(location.href); alert('링크가 복사되었습니다!'); } catch(e) { alert('공유 기능이 지원되지 않는 브라우저입니다.'); } }
    };

    window.startAIAnalysis = function() {
      const policyName = document.getElementById('pd-policy-name')?.textContent;
      try {
        const currentKey = window.__BENEPICK_CURRENT_POLICY_ID || policyName;
        if (currentKey) localStorage.setItem('benefic_detail_id', String(currentKey));
        if (window.__BENEPICK_CURRENT_POLICY_CARD) {
          localStorage.setItem(
            'benefic_detail_card',
            JSON.stringify({ policy_id: currentKey, card: window.__BENEPICK_CURRENT_POLICY_CARD })
          );
        }
      } catch(e) {}
      window.location.href = '/analysis';
    };

    function renderPolicyDetail(p, related) {
      const currentPolicyId = p.policy_id || p.정책ID || p.서비스명;
      window.__BENEPICK_CURRENT_POLICY_ID = currentPolicyId;
      window.__BENEPICK_CURRENT_POLICY_CARD = {
        policy_id: currentPolicyId,
        서비스명: p.서비스명,
        policy_name: p.서비스명,
        서비스분야: p.서비스분야,
        지원유형: p.지원유형,
        소관기관명: p.소관기관명,
        지원대상: p.지원대상,
        지원내용: p.지원내용,
        신청방법: p.신청방법,
        전화문의: p.전화문의,
        상세조회url: p.상세조회url,
        description: p.지원대상,
        benefit_summary: p.지원내용,
        application_url: p.상세조회url,
        source_label: p.소관기관명 || 'BenePick',
      };
      const icon = CATEGORY_ICONS[p.서비스분야] || '📋';
      const typeTagClass = TYPE_TAG_CLASS[p.지원유형] || 'pd-tag-gray';
      const defaultDocs = ['신분증 (주민등록증 또는 운전면허증)', '주민등록등본 (3개월 이내 발급)', '소득 증빙서류', '신청서 (해당 기관 양식)'];
      const reqRaw = p.선정기준 || p.지원대상 || '';
      const reqs = reqRaw.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 3);
      const targetRaw = p.지원대상 || '';
      const targets = targetRaw.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 3);

      document.getElementById('pd-content').innerHTML = `
        <div class="pd-hero">
          <div class="pd-breadcrumb">
            <a href="/search">정책 검색</a>
            <span>›</span>
            <span>${p.서비스분야 || '복지'}</span>
            <span>›</span>
            <span style="color:var(--gray-700);font-weight:600;">${p.서비스명}</span>
          </div>
          <div class="pd-hero-top">
            <div class="pd-icon-wrap">${icon}</div>
            <div class="pd-hero-info">
              <div class="pd-category-tags">
                <span class="pd-tag pd-tag-gray">${p.서비스분야 || '복지'}</span>
                <span class="pd-tag ${typeTagClass}">${p.지원유형 || '지원'}</span>
                ${p.소관기관명 ? `<span class="pd-tag pd-tag-gray">🏛️ ${p.소관기관명}</span>` : ''}
              </div>
              <h1 class="pd-title" id="pd-policy-name">${p.서비스명}</h1>
              <p class="pd-agency">${p.소관기관명 || ''} · ${p.신청기한 || '연중 상시'}</p>
            </div>
          </div>
          <div class="pd-hero-actions">
            <button class="pd-scrap-btn" id="pdScrapBtn" onclick="toggleScrap('${p.서비스명}')">☆ 스크랩</button>
            <button class="pd-share-btn" onclick="sharePolicy('${p.서비스명}')">📤 공유하기</button>
          </div>
        </div>
        <div>
          <div class="pd-tabs">
            <button class="pd-tab-btn active" data-tab="benefit" onclick="switchTab('benefit')">지원 내용</button>
            <button class="pd-tab-btn" data-tab="target" onclick="switchTab('target')">지원 대상</button>
            <button class="pd-tab-btn" data-tab="apply" onclick="switchTab('apply')">신청 방법</button>
            <button class="pd-tab-btn" data-tab="contact" onclick="switchTab('contact')">문의처</button>
          </div>
          <div class="pd-tab-panel active" id="pd-panel-benefit">
            <div class="pd-section">
              <div class="pd-section-label">상세 지원 내용</div>
              <div class="pd-section-body">${p.지원내용 || '지원 내용 정보가 없습니다.'}</div>
            </div>
          </div>
          <div class="pd-tab-panel" id="pd-panel-target">
            <div class="pd-section">
              <div class="pd-section-label">신청 자격 요건</div>
              <div class="pd-req-list">
                ${targets.map(t => `<div class="pd-req-item"><div class="pd-req-dot"></div><div class="pd-req-text">${t}</div></div>`).join('')}
              </div>
            </div>
            ${p.선정기준 ? `<div class="pd-section"><div class="pd-section-label">선정 기준</div><div class="pd-req-list">${reqs.map(r => `<div class="pd-req-item"><div class="pd-req-dot" style="background:var(--green);"></div><div class="pd-req-text">${r}</div></div>`).join('')}</div></div>` : ''}
          </div>
          <div class="pd-tab-panel" id="pd-panel-apply">
            <div class="pd-section">
              <div class="pd-section-label">신청 방법</div>
              <div class="pd-step-list">
                <div class="pd-step-item"><div class="pd-step-num">1</div><div class="pd-step-content"><div class="pd-step-title">서류 준비</div><div class="pd-step-desc">필요 서류를 미리 준비하세요.</div></div></div>
                <div class="pd-step-item"><div class="pd-step-num">2</div><div class="pd-step-content"><div class="pd-step-title">${p.신청방법 || '신청처 문의'}</div><div class="pd-step-desc">${p.신청기한 ? `신청 기한: ${p.신청기한}` : '연중 상시 신청 가능합니다.'}</div></div></div>
                <div class="pd-step-item"><div class="pd-step-num">3</div><div class="pd-step-content"><div class="pd-step-title">결과 통보 대기</div><div class="pd-step-desc">접수 후 담당 기관에서 심사 결과를 통보합니다.</div></div></div>
              </div>
            </div>
            <div class="pd-section">
              <div class="pd-section-label">필요 서류 목록</div>
              <div class="pd-doc-list">${defaultDocs.map(d => `<div class="pd-doc-item">${d}</div>`).join('')}</div>
            </div>
          </div>
          <div class="pd-tab-panel" id="pd-panel-contact">
            <div class="pd-section">
              <div class="pd-section-label">문의 및 신청처</div>
              <div class="pd-contact-grid">
                ${p.전화문의 ? `<a href="tel:${fmtPhone(p.전화문의)}" class="pd-contact-card"><div><div class="pd-contact-label">전화 문의</div><div class="pd-contact-value">${p.전화문의}</div></div></a>` : ''}
                ${p.상세조회url ? `<a href="${p.상세조회url}" target="_blank" rel="noopener" class="pd-contact-card"><div><div class="pd-contact-label">온라인 신청</div><div class="pd-contact-value" style="font-size:11px;word-break:break-all;">${p.상세조회url.replace('https://','')}</div></div></a>` : ''}
                <div class="pd-contact-card" style="cursor:default;"><div><div class="pd-contact-label">소관 기관</div><div class="pd-contact-value" style="font-size:12px;">${p.소관기관명 || '-'}</div></div></div>
                <div class="pd-contact-card" style="cursor:default;"><div><div class="pd-contact-label">방문 신청</div><div class="pd-contact-value" style="font-size:12px;">주민센터 / 복지관</div></div></div>
              </div>
            </div>
          </div>
        </div>`;

      try {
        const scraps = JSON.parse(localStorage.getItem('benefic_scraps') || '[]');
        if (scraps.includes(p.서비스명)) {
          _isScraped = true;
          const btn = document.getElementById('pdScrapBtn');
          if (btn) { btn.classList.add('active'); btn.innerHTML = '⭐ 스크랩됨'; }
        }
      } catch(e) {}
      document.title = `베네픽 — ${p.서비스명}`;
    }

    function showNotFound() {
      document.getElementById('pd-content').innerHTML = `
        <div class="pd-not-found">
          <div class="icon">🔍</div>
          <h3>정책 정보를 찾을 수 없습니다</h3>
          <p>검색 페이지로 돌아가서 다시 시도해 보세요.</p>
          <br>
          <a href="/search" style="display:inline-block;margin-top:8px;padding:10px 20px;background:var(--blue);color:#fff;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">← 검색으로 돌아가기</a>
        </div>`;
    }

    function saveRecentlyViewed(policyName) {
      try {
        const rv = JSON.parse(localStorage.getItem('benefic_rv') || '[]');
        const idx = rv.indexOf(policyName);
        if (idx > -1) rv.splice(idx, 1);
        rv.unshift(policyName);
        localStorage.setItem('benefic_rv', JSON.stringify(rv.slice(0, 20)));
      } catch(e) {}
    }

    async function initPolicyDetail() {
      const params = new URLSearchParams(location.search);
      const nameParam = params.get('name');
      let policyKey = nameParam;
      if (!policyKey) {
        try { policyKey = localStorage.getItem('benefic_detail_id'); if (policyKey) localStorage.removeItem('benefic_detail_id'); } catch(e) {}
      }
      if (!policyKey) { showNotFound(); return; }

      // 1) 내장 POLICY_DB 먼저 조회 (슬러그 or 서비스명으로)
      const POLICY_DB = window.POLICY_DB || [];
      let policy = POLICY_DB.find(p => p.서비스명 === policyKey);
      if (!policy) {
        policy = POLICY_DB.find(p => {
          const slug = p.서비스명.replace(/\s+/g, '-');
          const slugLower = p.서비스명.replace(/\s+/g, '-').toLowerCase();
          return slug === policyKey
            || slugLower === policyKey.toLowerCase()
            || p.서비스명.includes(policyKey.replace(/-/g, ' '))
            || policyKey.includes(p.서비스명.replace(/\s+/g, '-'));
        });
      }
      if (policy) {
        const related = getRelated(policy, POLICY_DB);
        renderPolicyDetail(policy, related);
        setTimeout(() => { const nameEl = document.getElementById('pd-policy-name'); if (nameEl) saveRecentlyViewed(nameEl.textContent); }, 200);
        return;
      }

      // 2) 백엔드 policy_id는 문자열일 수 있으므로 숫자 여부와 무관하게 상세 API를 조회
      try {
        const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
          ? 'http://localhost:8000' : 'https://web-production-c3410.up.railway.app';
        const res = await fetch(`${API_BASE}/api/v1/policies/${encodeURIComponent(policyKey)}/detail?lang=ko`);
        if (res.ok) {
          const payload = await res.json();
          const d = payload.data || {};
          const raw = d.source_excerpt || {};
          const backendPolicy = {
            policy_id: d.policy_id || policyKey,
            서비스명: d.title || policyKey, 서비스분야: (d.tags && d.tags[0]?.tag_label) || '',
            지원유형: '', 소관기관명: d.managing_agency || '',
            지원대상: raw.support_target_text || d.description || '',
            지원내용: raw.support_content_text || d.description || '',
            선정기준: '', 신청방법: raw.application_method_text || '',
            신청기한: '', 전화문의: raw.contact_text || '',
            상세조회url: raw.official_url || d.application_url || '',
          };
          renderPolicyDetail(backendPolicy, []);
          setTimeout(() => { const nameEl = document.getElementById('pd-policy-name'); if (nameEl) saveRecentlyViewed(nameEl.textContent); }, 200);
          return;
        }
      } catch(e) {}

      showNotFound();
    }

    initPolicyDetail();
  }, []);

  return (
    <>
      <style>{`
        .pd-hero{background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:28px 28px 24px;margin-bottom:16px;box-shadow:var(--shadow-sm);position:relative;overflow:hidden}
        .pd-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--blue),var(--green));border-radius:var(--radius) var(--radius) 0 0}
        .pd-breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray-400);margin-bottom:16px;font-weight:500}
        .pd-breadcrumb a{color:var(--gray-400);text-decoration:none;transition:color .15s}
        .pd-breadcrumb a:hover{color:var(--blue)}
        .pd-breadcrumb span{color:var(--gray-300)}
        .pd-hero-top{display:flex;align-items:flex-start;gap:16px}
        .pd-icon-wrap{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,var(--blue-light),var(--green-light));display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;border:1.5px solid var(--gray-200)}
        .pd-hero-info{flex:1;min-width:0}
        .pd-category-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
        .pd-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;letter-spacing:.2px}
        .pd-tag-blue{background:var(--blue-light);color:var(--blue-dark)}
        .pd-tag-green{background:var(--green-light);color:var(--green-dark)}
        .pd-tag-orange{background:var(--orange-light);color:#92400E}
        .pd-tag-gray{background:var(--gray-100);color:var(--gray-500)}
        .pd-title{font-size:22px;font-weight:800;color:var(--gray-900);line-height:1.3;margin:0 0 6px;word-break:keep-all}
        .pd-agency{font-size:13px;color:var(--gray-500);font-weight:500}
        .pd-hero-actions{display:flex;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-100)}
        .pd-tabs{display:flex;gap:0;border-bottom:2px solid var(--gray-200);margin-bottom:20px;overflow-x:auto;scrollbar-width:none}
        .pd-tabs::-webkit-scrollbar{display:none}
        .pd-tab-btn{padding:10px 18px;font-size:13px;font-weight:700;font-family:'Pretendard',sans-serif;color:var(--gray-500);border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap;transition:all .15s}
        .pd-tab-btn:hover{color:var(--gray-900)}
        .pd-tab-btn.active{color:var(--blue);border-bottom-color:var(--blue)}
        .pd-tab-panel{display:none}
        .pd-tab-panel.active{display:block}
        .pd-section{background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:20px 22px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
        .pd-section-label{font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--gray-400);margin-bottom:10px}
        .pd-section-body{font-size:14px;color:var(--gray-700);line-height:1.75;word-break:keep-all}
        .pd-req-list{display:flex;flex-direction:column;gap:8px;margin-top:4px}
        .pd-req-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--gray-50);border-radius:8px;border:1px solid var(--gray-100)}
        .pd-req-dot{width:8px;height:8px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:5px}
        .pd-req-text{font-size:13px;color:var(--gray-700);line-height:1.6;font-weight:500}
        .pd-step-list{display:flex;flex-direction:column;gap:0}
        .pd-step-item{display:flex;gap:14px;position:relative}
        .pd-step-item:not(:last-child)::after{content:'';position:absolute;left:16px;top:36px;bottom:-8px;width:1.5px;background:var(--gray-200)}
        .pd-step-num{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--green));color:white;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;z-index:1}
        .pd-step-content{padding:4px 0 20px;flex:1}
        .pd-step-item:last-child .pd-step-content{padding-bottom:0}
        .pd-step-title{font-size:14px;font-weight:700;color:var(--gray-900);margin-bottom:3px}
        .pd-step-desc{font-size:12px;color:var(--gray-500);line-height:1.6}
        .pd-doc-list{display:flex;flex-direction:column;gap:6px;margin-top:4px}
        .pd-doc-item{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--gray-50);border-radius:8px;border:1px solid var(--gray-100);font-size:13px;color:var(--gray-700);font-weight:500}
        .pd-doc-item::before{content:'📄';font-size:14px}
        .pd-contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
        .pd-contact-card{display:flex;align-items:center;gap:10px;padding:12px;background:var(--gray-50);border-radius:8px;border:1px solid var(--gray-100);text-decoration:none;transition:all .15s}
        .pd-contact-card:hover{border-color:var(--blue);background:var(--blue-light)}
        .pd-contact-label{font-size:10px;color:var(--gray-400);font-weight:600;letter-spacing:.3px}
        .pd-contact-value{font-size:13px;color:var(--gray-900);font-weight:700}
        .pd-scrap-btn{padding:9px 16px;border:1.5px solid var(--gray-200);border-radius:8px;background:var(--white);font-size:13px;font-weight:700;font-family:'Pretendard',sans-serif;color:var(--gray-500);cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;flex:1;justify-content:center}
        .pd-scrap-btn:hover{border-color:var(--blue);color:var(--blue);background:var(--blue-light)}
        .pd-scrap-btn.active{border-color:#FBBF24;color:#D97706;background:#FFFBEB}
        .pd-share-btn{padding:9px 16px;border:1.5px solid var(--gray-200);border-radius:8px;background:var(--white);font-size:13px;font-weight:700;font-family:'Pretendard',sans-serif;color:var(--gray-500);cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;flex:1;justify-content:center}
        .pd-share-btn:hover{border-color:var(--gray-400);color:var(--gray-700)}
        .pd-not-found{text-align:center;padding:60px 20px;color:var(--gray-400)}
        .pd-not-found .icon{font-size:48px;margin-bottom:12px}
        .pd-not-found h3{font-size:16px;font-weight:700;color:var(--gray-700);margin-bottom:6px}
        .pd-not-found p{font-size:13px}
        @media(max-width:640px){.pd-contact-grid{grid-template-columns:1fr}.pd-hero{padding:20px 16px 16px}.pd-title{font-size:18px}.pd-icon-wrap{width:48px;height:48px;font-size:22px}.pd-section{padding:16px}}
      `}</style>

      <NavBar activePage="search" />

      <div className="container">
        <div className="screen active" id="screen-policy-detail">
          <div style={{maxWidth:'860px',margin:'0 auto',padding:'8px 0 0'}}>
            <div id="pd-content">
              <div className="pd-not-found">
                <div className="icon">⏳</div>
                <h3>정책 정보를 불러오는 중...</h3>
                <p>잠시만 기다려주세요.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="search" />
    </>
  );
}
