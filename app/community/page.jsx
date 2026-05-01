'use client';

import { useEffect, useRef, useState } from 'react';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import AiLoadingOverlay from '../../components/AiLoadingOverlay';

export default function CommunityPage() {
  const [sortOpen, setSortOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState('최신순');
  const sortRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (typeof window.initComm === 'function') window.initComm();
      if (typeof window.renderCommPosts === 'function') window.renderCommPosts();
      if (typeof window.insightAnimateBars === 'function') window.insightAnimateBars();
      if (typeof window.insightRenderReviews === 'function') window.insightRenderReviews();

      const fabEl = document.getElementById('fabWrite');
      if (fabEl) fabEl.classList.add('visible');

      const p = document.getElementById('iStatPosts');
      const l = document.getElementById('iStatLikes');
      if (p && window.commPosts) p.textContent = window.commPosts.length;
      if (l && window.commPosts) l.textContent = window.commPosts.reduce((s, post) => s + post.likes, 0);
    }

    const handleClick = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const filterComm = (cat, el) => {
    if (typeof window !== 'undefined' && typeof window.filterComm === 'function') {
      window.filterComm(cat, el);
    }
  };

  const insightRefresh = () => {
    if (typeof window !== 'undefined' && typeof window.insightRefresh === 'function') {
      window.insightRefresh();
    }
  };

  const openWriteModal = () => {
    if (typeof window !== 'undefined' && typeof window.openWriteModal === 'function') {
      window.openWriteModal();
    }
  };

  const onCommSearch = () => {
    if (typeof window !== 'undefined' && typeof window.onCommSearch === 'function') {
      window.onCommSearch();
    }
  };

  const clearCommSearch = () => {
    if (typeof window !== 'undefined' && typeof window.clearCommSearch === 'function') {
      window.clearCommSearch();
    }
  };

  const selectSortOption = (el, label) => {
    setCurrentSort(label);
    setSortOpen(false);
    if (typeof window !== 'undefined' && typeof window.selectSortOption === 'function') {
      window.selectSortOption(el);
    }
  };

  const toggleSortDropdown = (e) => {
    e.stopPropagation();
    setSortOpen(prev => !prev);
  };

  const showCommList = () => {
    if (typeof window !== 'undefined' && typeof window.showCommList === 'function') {
      window.showCommList();
    }
  };

  const submitPost = () => {
    if (typeof window !== 'undefined' && typeof window.submitPost === 'function') {
      window.submitPost();
    }
  };

  const closeWriteModalDirect = () => {
    if (typeof window !== 'undefined' && typeof window.closeWriteModalDirect === 'function') {
      window.closeWriteModalDirect();
    }
  };

  const closeWriteModal = (e) => {
    if (typeof window !== 'undefined' && typeof window.closeWriteModal === 'function') {
      window.closeWriteModal(e);
    }
  };

  const closeDeleteModal = (e) => {
    if (typeof window !== 'undefined' && typeof window.closeDeleteModal === 'function') {
      window.closeDeleteModal(e);
    }
  };

  const closeDeleteModalDirect = () => {
    if (typeof window !== 'undefined' && typeof window.closeDeleteModalDirect === 'function') {
      window.closeDeleteModalDirect();
    }
  };

  const confirmDelete = () => {
    if (typeof window !== 'undefined' && typeof window.confirmDelete === 'function') {
      window.confirmDelete();
    }
  };

  return (
    <>
      <AiLoadingOverlay />
      <NavBar activePage="community" />

      <div className="container">
        <div className="screen active" id="screen-community">

          <div id="comm-list-view">
            <div className="comm-header">
              <div>
                <h2 data-i18n="comm_title">💬 커뮤니티</h2>
                <p data-i18n="comm_desc">베네픽 사용자들의 수급 후기, 질문, 지역 정보를 나눠요</p>
              </div>
            </div>

            {/* 검색 & 정렬 섹션 */}
            <div className="comm-search-section">
              <div className="comm-search-bar-wrap">
                <svg className="comm-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  id="commSearchInput"
                  className="comm-search-input"
                  data-i18n-placeholder="search_placeholder"
                  placeholder="검색어를 입력하세요"
                  onInput={onCommSearch}
                  autoComplete="off"
                />
                <button className="comm-search-clear" id="commSearchClear" onClick={clearCommSearch} style={{display:'none'}} aria-label="검색 초기화">✕</button>
              </div>
              <div className="sort-container" id="sortContainer" ref={sortRef}>
                <button
                  id="sortBtn"
                  className="sort-select-button"
                  onClick={toggleSortDropdown}
                  aria-haspopup="true"
                  aria-expanded={sortOpen}
                >
                  <span id="currentSortText" data-i18n="sort_latest">{currentSort}</span>
                  <svg className="sort-arrow-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div id="sortDropdown" className={`sort-dropdown-content${sortOpen ? ' visible' : ''}`}>
                  <div className="sort-option active" data-sort="latest" onClick={(e) => selectSortOption(e.currentTarget, '최신순')} data-i18n="sort_latest">
                    최신순
                    <svg className="sort-check" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="sort-option" data-sort="popular" onClick={(e) => selectSortOption(e.currentTarget, '인기순')} data-i18n="sort_popular">인기순</div>
                  <div className="sort-option" data-sort="comments" onClick={(e) => selectSortOption(e.currentTarget, '댓글순')} data-i18n="sort_comments">댓글순</div>
                </div>
              </div>
            </div>

            <div className="comm-filter-bar">
              <button className="comm-filter-btn active" onClick={(e) => filterComm('all', e.currentTarget)} data-i18n="filter_all">🔥 전체</button>
              <button className="comm-filter-btn" onClick={(e) => filterComm('popular', e.currentTarget)} data-i18n="filter_popular">⭐ 인기글</button>
              <button className="comm-filter-btn" onClick={(e) => filterComm('qna', e.currentTarget)} data-i18n="filter_qna">❓ 질문/답변</button>
              <button className="comm-filter-btn" onClick={(e) => filterComm('review', e.currentTarget)} data-i18n="filter_review">🎉 수급 후기</button>
              <button className="comm-filter-btn" onClick={(e) => filterComm('regional', e.currentTarget)} data-i18n="filter_regional">📍 지역 정보</button>
              <button className="comm-filter-btn" onClick={(e) => filterComm('anonymous', e.currentTarget)} data-i18n="filter_anonymous">🤫 익명 고민</button>
            </div>

            <div className="comm-layout">
              <div>
                <div className="comm-post-list" id="commPostList"></div>
                <div className="comm-empty" id="commEmpty" style={{display:'none'}}>
                  <div className="icon">📭</div>
                  <h4 data-i18n="comm_empty_title">아직 게시글이 없어요</h4>
                  <p data-i18n="comm_empty_desc">첫 번째 글을 작성해 보세요!</p>
                </div>
              </div>
              <div className="comm-sidebar">
                {/* 실시간 정책 인사이트 위젯 */}
                <div className="insight-widget">
                  <div className="insight-widget-header">
                    <div className="insight-widget-title">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      <span data-i18n="insight_title">실시간 정책 인사이트</span>
                    </div>
                    <button className="insight-refresh-btn" onClick={insightRefresh}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      <span data-i18n="insight_refresh">새로고침</span>
                    </button>
                  </div>
                  <div className="insight-section-label" data-i18n="insight_top3">이번 주 가장 많이 조회된 정책 TOP 3</div>
                  <div className="insight-policy-row">
                    <div className="insight-policy-meta">
                      <span className="insight-policy-name">청년 월세 지원</span>
                      <span className="insight-policy-pct">85%</span>
                    </div>
                    <div className="insight-bar-track"><div className="insight-bar-fill" id="iBar1" style={{width:'0%'}}></div></div>
                  </div>
                  <div className="insight-policy-row">
                    <div className="insight-policy-meta">
                      <span className="insight-policy-name">중소기업 소득세 감면</span>
                      <span className="insight-policy-pct">62%</span>
                    </div>
                    <div className="insight-bar-track"><div className="insight-bar-fill" id="iBar2" style={{width:'0%'}}></div></div>
                  </div>
                  <div className="insight-policy-row">
                    <div className="insight-policy-meta">
                      <span className="insight-policy-name">내일배움카드</span>
                      <span className="insight-policy-pct">45%</span>
                    </div>
                    <div className="insight-bar-track"><div className="insight-bar-fill" id="iBar3" style={{width:'0%'}}></div></div>
                  </div>
                  <div className="insight-stats-row">
                    <div className="insight-stat-chip"><div className="val" id="iStatPosts">6</div><div className="lbl" data-i18n="insight_stat_posts">총 게시글</div></div>
                    <div className="insight-stat-chip"><div className="val" id="iStatLikes">219</div><div className="lbl" data-i18n="insight_stat_likes">누적 좋아요</div></div>
                    <div className="insight-stat-chip"><div className="val">98%</div><div className="lbl" data-i18n="insight_stat_positive">긍정 후기율</div></div>
                  </div>
                  <div className="insight-divider"></div>
                  <div className="insight-review-header">
                    <div className="insight-review-label">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      실제 수급자 한줄평
                    </div>
                    <span className="insight-badge-positive">긍정 98%</span>
                  </div>
                  <div id="iReviewList"></div>
                  <div className="insight-nav-dots" id="iNavDots"></div>
                </div>

                <div className="comm-sidebar-card">
                  <h4 data-i18n="hot_posts_title">🔥 주간 인기글</h4>
                  <div id="hotPostList"></div>
                </div>
                <div className="comm-sidebar-card" style={{background:'var(--blue-light)',borderColor:'transparent'}}>
                  <h4 style={{color:'var(--blue-dark)'}} data-i18n="ai_tip_title">💡 AI 복지 팁</h4>
                  <p style={{fontSize:'12px',color:'var(--blue-dark)',lineHeight:'1.7'}} id="aiTip">로딩 중...</p>
                </div>
              </div>
            </div>
          </div>

          {/* 상세 보기 */}
          <div id="comm-detail-view" style={{display:'none'}}>
            <div className="comm-detail-back">
              <button onClick={showCommList} data-i18n="back_to_comm_list">← 목록으로</button>
              <span style={{fontSize:'13px',color:'var(--gray-500)'}} data-i18n="breadcrumb_comm">/ 게시글 상세</span>
            </div>
            <div className="comm-layout">
              <div>
                <div className="comm-detail-card" id="commDetailCard"></div>
              </div>
              <div className="comm-sidebar">
                <div className="comm-sidebar-card">
                  <h4 data-i18n="hot_posts_title2">🔥 다른 인기글도 보기</h4>
                  <div id="hotPostList2"></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* FAB */}
      <button className="fab-write" id="fabWrite" onClick={openWriteModal} data-i18n="fab_write">✏️ 글쓰기</button>

      {/* 삭제 확인 모달 */}
      <div className="comm-modal-bg" id="deleteModalBg" onClick={closeDeleteModal}>
        <div className="comm-modal comm-delete-modal">
          <div className="delete-modal-icon">🗑️</div>
          <h3 data-i18n="delete_confirm_title">게시글 삭제</h3>
          <p data-i18n="delete_confirm">게시글을 삭제하시겠습니까?</p>
          <p style={{fontSize:'12px',color:'var(--gray-400)',marginTop:'4px'}} data-i18n="delete_confirm_sub">삭제된 게시글은 복구할 수 없습니다.</p>
          <div className="comm-modal-actions">
            <button className="btn-cancel" onClick={closeDeleteModalDirect} data-i18n="modal_cancel">취소</button>
            <button className="btn-danger" onClick={confirmDelete} data-i18n="delete_btn">삭제</button>
          </div>
        </div>
      </div>

      {/* 글쓰기 모달 */}
      <div className="comm-modal-bg" id="writeModalBg" onClick={closeWriteModal}>
        <div className="comm-modal">
          <h3 data-i18n="modal_title">✏️ 새 글 작성</h3>
          <label data-i18n="modal_cat_label">카테고리</label>
          <select id="modalCat">
            <option value="qna" data-i18n-opt="modal_opt_qna">❓ 질문/답변</option>
            <option value="review" data-i18n-opt="modal_opt_review">🎉 수급 후기</option>
            <option value="regional" data-i18n-opt="modal_opt_regional">📍 지역 정보</option>
            <option value="anonymous" data-i18n-opt="modal_opt_anonymous">🤫 익명 고민</option>
          </select>
          <label data-i18n="modal_region_label">지역 태그 (선택)</label>
          <input type="text" id="modalRegion" placeholder="예: 서울 강남구, 부산 해운대구" data-i18n-placeholder="modal_region_placeholder" />
          <label data-i18n="modal_title_label">제목</label>
          <input type="text" id="modalTitle" placeholder="제목을 입력하세요" data-i18n-placeholder="modal_title_placeholder" maxLength={80} />
          <label data-i18n="modal_content_label">내용</label>
          <textarea id="modalContent" rows={6} placeholder="내용을 입력하세요. 복지 혜택과 관련된 경험이나 질문을 공유해 주세요!" data-i18n-placeholder="modal_content_placeholder"></textarea>
          <div className="comm-modal-actions">
            <button className="btn-cancel" onClick={closeWriteModalDirect} data-i18n="modal_cancel">취소</button>
            <button className="btn-primary" onClick={submitPost} data-i18n="modal_submit">등록하기</button>
          </div>
        </div>
      </div>

      <TabBar active="community" />
    </>
  );
}
