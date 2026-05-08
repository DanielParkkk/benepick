'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';

export default function SearchPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // main.js의 initSearch 호출
    if (typeof window !== 'undefined' && typeof window.initSearch === 'function') {
      window.initSearch();
    }
  }, []);

  const doSearch = () => {
    if (typeof window !== 'undefined' && typeof window.doSearch === 'function') {
      window.doSearch();
    }
  };

  return (
    <>
      {/* AI LOADING OVERLAY */}
      <div className="ai-loading" id="aiLoading">
        <div className="ai-loading-card">
          <div className="ai-spinner"></div>
          <div className="ai-loading-text">
            <h3 data-i18n="ai_loading_title">AI 분석 중입니다...</h3>
            <p>입력하신 조건으로<br />수급 가능성을 계산하고 있어요</p>
            <br />
            <div className="ai-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <NavBar activePage="search" />

      <div className="container">
        <div className="screen active" id="screen-search">
          <div style={{maxWidth:'860px',margin:'0 auto',padding:'8px 0 40px'}}>
            <div style={{marginBottom:'24px'}}>
              <h2 style={{fontSize:'22px',fontWeight:'800',color:'var(--gray-900)',marginBottom:'6px'}} data-i18n="search_title">🔍 정책 통합 검색</h2>
              <p style={{fontSize:'14px',color:'var(--gray-500)'}} data-i18n="search_subtitle">키워드 검색 또는 자연어로 원하는 복지 정책을 찾아보세요.</p>
            </div>
            <div style={{background:'var(--white)',border:'1px solid var(--gray-200)',borderRadius:'var(--radius)',padding:'20px',boxShadow:'var(--shadow-sm)',marginBottom:'16px'}}>
              <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                <input
                  id="search-input"
                  placeholder="예: 청년 월세, 취업 후 생계 지원, 장애인 활동지원 받고 싶어요"
                  data-i18n-placeholder="search_input_placeholder"
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
                  style={{flex:'1',border:'1px solid var(--gray-200)',borderRadius:'10px',padding:'12px 16px',fontSize:'14px',fontFamily:'inherit',outline:'none',background:'var(--gray-50)',color:'var(--gray-900)',transition:'all .15s'}}
                />
                <button
                  onClick={doSearch}
                  style={{background:'linear-gradient(135deg,var(--blue),var(--blue-dark))',color:'#fff',border:'none',borderRadius:'10px',padding:'12px 24px',fontSize:'14px',fontWeight:'700',fontFamily:'inherit',cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(74,144,226,.3)'}}
                >
                  <span data-i18n="search_btn">🔍 검색</span>
                </button>
              </div>
              <div style={{marginTop:'12px',display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:'12px',color:'var(--gray-500)',fontWeight:'600'}} data-i18n="quick_search_label">빠른 검색:</span>
                <span id="quick-tags" style={{display:'flex',gap:'5px',flexWrap:'wrap'}}></span>
              </div>
            </div>
            <div id="search-status" style={{fontSize:'13px',color:'var(--gray-500)',marginBottom:'12px',minHeight:'18px'}}></div>
            <div id="search-results"></div>
            <div id="search-pagination" style={{display:'none',marginTop:'20px',textAlign:'center'}}></div>
            <div id="search-browse-wrap">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                <h3 style={{fontSize:'15px',fontWeight:'700',color:'var(--gray-900)'}} data-i18n="browse_title">
                  📋 전체 복지 정책 목록
                  <span id="browse-total-badge" style={{fontSize:'12px',fontWeight:'500',color:'var(--gray-500)'}}></span>
                </h3>
              </div>
              <div id="browse-list"></div>
              <div id="browse-pagination" style={{marginTop:'20px',textAlign:'center'}}></div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="search" />
    </>
  );
}
