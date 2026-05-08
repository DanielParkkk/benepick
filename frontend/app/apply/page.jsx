'use client';

import { useState, useEffect } from 'react';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import AiLoadingOverlay from '../../components/AiLoadingOverlay';

export default function ApplyPage() {
  const [docCards, setDocCards] = useState([
    { id: 1, icon: '🪪', titleKey: 'doc_resident', title: '주민등록등본', statusKey: 'doc_resident_status', status: '✅ 준비 완료 · 3개월 이내', originalText: '⬜ 미준비 · 3개월 이내', ready: true },
    { id: 2, icon: '💰', titleKey: 'doc_income', title: '소득 증빙서류', statusKey: 'doc_income_status', status: '✅ 건강보험료 납부확인서', originalText: '⬜ 미준비 · 건강보험료 납부확인서', ready: true },
    { id: 3, icon: '🏠', titleKey: 'doc_lease', title: '임대차 계약서', statusKey: 'doc_lease_status', status: '⬜ 미준비 · 원본 + 사본', originalText: '⬜ 미준비 · 원본 + 사본', ready: false },
    { id: 4, icon: '🏦', titleKey: 'doc_bank', title: '통장 사본', statusKey: 'doc_bank_status', status: '⬜ 미준비 · 수급 계좌', originalText: '⬜ 미준비 · 수급 계좌', ready: false },
  ]);

  const [checkItems, setCheckItems] = useState([
    { id: 1, done: true, label: '신청자 기본 정보 입력 완료', i18n: 'check_apply_1' },
    { id: 2, done: true, label: '소득 증빙서류 제출', i18n: 'check_apply_2' },
    { id: 3, done: true, label: '주민등록 전입신고 확인', i18n: 'check_apply_3' },
    { id: 4, done: false, label: '임대차 계약서 업로드', i18n: 'check_apply_4' },
    { id: 5, done: false, label: '수급 계좌 등록', i18n: 'check_apply_5' },
    { id: 6, done: false, label: '신청서 최종 제출', i18n: 'check_apply_6' },
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.querySelectorAll('.progress-fill').forEach((bar, i) => {
        const finalW = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => { bar.style.width = finalW; }, 300 + i * 120);
      });
    }
  }, []);

  const toggleDocCard = (id) => {
    setDocCards(prev => prev.map(card => {
      if (card.id !== id) return card;
      const nowReady = !card.ready;
      return {
        ...card,
        ready: nowReady,
        status: nowReady ? '✅ 준비 완료' : card.originalText,
      };
    }));
  };

  const toggleCheck = (id) => {
    setCheckItems(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const doneCount = docCards.filter(c => c.ready).length;
  const progress = Math.round((doneCount / docCards.length) * 100);

  return (
    <>
      <AiLoadingOverlay />
      <NavBar activePage="apply" />

      <div className="container">
        <div className="screen active" id="screen-apply">

          <div className="grid-main">
            <div>
              <div className="section-title">
                <h3 data-i18n="doc_cards_title">📄 필요 서류 카드</h3>
                <span style={{fontSize:'13px',color:'var(--gray-500)'}} data-i18n="doc_cards_subtitle">청년 월세 지원 기준</span>
              </div>

              <div className="doc-cards">
                {docCards.map(card => (
                  <div key={card.id} className={`doc-card${card.ready ? ' ready' : ''}`} onClick={() => toggleDocCard(card.id)}>
                    <div className="doc-icon">{card.icon}</div>
                    <div className="doc-info">
                      <h5 data-i18n={card.titleKey}>{card.title}</h5>
                      <p data-i18n={card.ready ? undefined : card.statusKey}>{card.status}</p>
                    </div>
                    <div className="doc-status">{card.ready ? '✅' : '⬜'}</div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:'24px'}}>
                <div className="section-title">
                  <h3 data-i18n="checklist_apply_title">☑️ 신청 체크리스트</h3>
                </div>
                <div className="input-card" style={{padding:'20px 24px'}}>
                  <div className="checklist">
                    {checkItems.map(item => (
                      <div key={item.id} className={`check-item${item.done ? ' done' : ''}`} onClick={() => toggleCheck(item.id)}>
                        <div className="check-box">{item.done ? '✓' : ''}</div>
                        <span className="check-text" data-i18n={item.i18n}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="cta-section">
                <div className="cta-text">
                  <h3 data-i18n="cta_title">🏠 청년 월세 지원 신청하기</h3>
                  <p data-i18n="cta_desc">복지로(bokjiro.go.kr)에서 3분 만에 완료</p>
                </div>
                <button className="cta-btn">
                  <span data-i18n="cta_btn">🚀 신청하러 가기</span>
                </button>
              </div>
            </div>

            <div className="sidebar">
              <div className="sidebar-card">
                <h4 data-i18n="apply_status_title">📊 신청 현황</h4>
                <div className="stat-grid">
                  <div className="stat-item"><div className="val green">{doneCount}/{docCards.length}</div><div className="lbl" data-i18n="stat_docs">서류 준비</div></div>
                  <div className="stat-item"><div className="val blue">{progress}%</div><div className="lbl" data-i18n="stat_progress">진행률</div></div>
                </div>
                <div style={{marginTop:'12px'}}>
                  <div className="progress-track" style={{height:'10px'}}>
                    <div className="progress-fill blue" style={{width:`${progress}%`}}></div>
                  </div>
                  <p style={{fontSize:'11px',color:'var(--gray-500)',marginTop:'6px',textAlign:'center'}} data-i18n="progress_hint">서류 {docCards.length - doneCount}개 더 준비하면 신청 가능!</p>
                </div>
              </div>

              <div className="sidebar-card">
                <h4 data-i18n="tip_title">💡 신청 팁</h4>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{background:'var(--blue-light)',borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:'var(--blue-dark)',fontWeight:'500',lineHeight:'1.5'}} data-i18n="tip_deadline">
                    📅 <strong>신청 기한:</strong> 2025년 12월 31일까지 접수 마감
                  </div>
                  <div style={{background:'var(--green-light)',borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:'var(--green-dark)',fontWeight:'500',lineHeight:'1.5'}} data-i18n="tip_fast">
                    ⚡ <strong>빠른 처리:</strong> 온라인 신청 시 처리 기간 단축 (평균 18일)
                  </div>
                  <div style={{background:'var(--orange-light)',borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:'#B7770D',fontWeight:'500',lineHeight:'1.5'}} data-i18n="tip_warning">
                    ⚠️ <strong>주의:</strong> 전입신고 없으면 100% 탈락. 반드시 사전 완료 필수!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="apply" />
    </>
  );
}
