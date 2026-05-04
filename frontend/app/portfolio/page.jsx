'use client';

import { useEffect } from 'react';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import AiLoadingOverlay from '../../components/AiLoadingOverlay';

export default function PortfolioPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (typeof window.loadPortfolio === 'function') window.loadPortfolio();
      document.querySelectorAll('.progress-fill').forEach((bar, i) => {
        const finalW = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => { bar.style.width = finalW; }, 300 + i * 120);
      });
    }
  }, []);

  const showTab = (tab) => {
    if (typeof window !== 'undefined' && typeof window.showTab === 'function') window.showTab(tab);
  };

  return (
    <>
      <AiLoadingOverlay />
      <NavBar activePage="portfolio" />

      <div className="container">
        <div className="screen active" id="screen-portfolio">
          <div className="portfolio-hero">
            <div style={{position:'relative',zIndex:1}}>
              <p style={{fontSize:'14px',color:'rgba(255,255,255,.5)',marginBottom:'8px',fontWeight:'600',letterSpacing:'.5px',textTransform:'uppercase'}} data-i18n="port_total_label">총 예상 연간 수혜액</p>
              <div className="big-num">1,040만원</div>
              <p data-i18n="port_hero_desc">최적 조합 12개 정책 기준 · 남정현님 맞춤 분석</p>
              <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'16px'}}>
                <span style={{background:'rgba(46,204,113,.2)',border:'1px solid rgba(46,204,113,.3)',color:'var(--green)',fontSize:'12px',fontWeight:'600',padding:'5px 14px',borderRadius:'20px'}}>✅ 즉시 신청 가능 3건</span>
                <span style={{background:'rgba(74,144,226,.2)',border:'1px solid rgba(74,144,226,.3)',color:'#7EC8E3',fontSize:'12px',fontWeight:'600',padding:'5px 14px',borderRadius:'20px'}}>⚡ 조건 보완 후 5건</span>
              </div>
            </div>
          </div>

          <div className="section-title">
            <h3 data-i18n="port_section_title">💼 최적 복지 포트폴리오</h3>
            <a href="#" data-i18n="port_add_link">정책 추가하기 +</a>
          </div>

          <div className="port-grid">
            <div className="port-grid-card">
              <div className="icon">🏠</div>
              <h4 data-i18n="port_card1_name">청년 월세 특별지원</h4>
              <div className="amount" data-i18n="port_card1_amount">240만원</div>
              <div className="period" data-i18n="port_card1_period">월 20만원 × 12개월</div>
              <div style={{marginTop:'10px'}}><span className="badge badge-green" data-i18n="badge_immediate">즉시 신청</span></div>
            </div>
            <div className="port-grid-card">
              <div className="icon">📚</div>
              <h4 data-i18n="port_card2_name">국민내일배움카드</h4>
              <div className="amount" data-i18n="port_card2_amount">500만원</div>
              <div className="period" data-i18n="port_card2_period">훈련비 전액 지원</div>
              <div style={{marginTop:'10px'}}><span className="badge badge-green" data-i18n="badge_immediate">즉시 신청</span></div>
            </div>
            <div className="port-grid-card">
              <div className="icon">🏥</div>
              <h4 data-i18n="port_card3_name">청년 마음건강 지원</h4>
              <div className="amount" data-i18n="port_card3_amount">80만원</div>
              <div className="period" data-i18n="port_card3_period">상담 10회 × 8만원</div>
              <div style={{marginTop:'10px'}}><span className="badge badge-green" data-i18n="badge_immediate">즉시 신청</span></div>
            </div>
            <div className="port-grid-card">
              <div className="icon">💰</div>
              <h4 data-i18n="port_card4_name">청년도약계좌</h4>
              <div className="amount" data-i18n="port_card4_amount">70만원/년</div>
              <div className="period" data-i18n="port_card4_period">정부기여금 포함</div>
              <div style={{marginTop:'10px'}}><span className="badge badge-blue" data-i18n="badge_check">조건 확인 필요</span></div>
            </div>
            <div className="port-grid-card">
              <div className="icon">🎓</div>
              <h4 data-i18n="port_card5_name">청년 취업아카데미</h4>
              <div className="amount" data-i18n="port_card5_amount">150만원</div>
              <div className="period" data-i18n="port_card5_period">교육비 + 수당</div>
              <div style={{marginTop:'10px'}}><span className="badge badge-blue" data-i18n="badge_check">조건 확인 필요</span></div>
            </div>
            <div className="port-grid-card" style={{background:'var(--gray-50)',borderStyle:'dashed',cursor:'pointer'}} onClick={() => alert('더 많은 정책을 분석합니다!')}>
              <div className="icon">➕</div>
              <h4 style={{color:'var(--gray-500)'}} data-i18n="port_add_more">정책 더 추가하기</h4>
              <div className="amount" style={{color:'var(--gray-300)',fontSize:'14px'}} data-i18n="port_add_max">최대 12개까지</div>
              <div className="period" style={{color:'var(--gray-400)'}} data-i18n="port_add_possible">분석 가능</div>
            </div>
          </div>

          <div className="cta-section">
            <div className="cta-text">
              <h3 data-i18n="port_cta_title">🚀 이 조합으로 지금 바로 신청하세요!</h3>
              <p data-i18n="port_cta_desc">총 1,040만원 혜택을 한 번에 챙길 수 있어요</p>
            </div>
            <button className="cta-btn" onClick={() => showTab('apply')} data-i18n="port_cta_btn">
              📋 신청 보조 시작하기 ›
            </button>
          </div>
        </div>
      </div>

      <TabBar active="portfolio" />
    </>
  );
}
