"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import {
  getCommunityPosts,
  createCommunityPost,
  likePost,
  getHotPosts,
  type CommunityPost,
} from "../../lib/api";

const FILTERS = [
  { key: "all", label: "🔥 전체" },
  { key: "popular", label: "⭐ 인기글" },
  { key: "qna", label: "❓ 질문/답변" },
  { key: "review", label: "🎉 수급 후기" },
  { key: "regional", label: "📍 지역 정보" },
  { key: "anonymous", label: "🤫 익명 고민" },
];

const CAT_COLORS: Record<string, string> = {
  popular: "cat-popular", qna: "cat-qna", review: "cat-review",
  regional: "cat-regional", anonymous: "cat-anonymous", notice: "cat-notice",
};

const CAT_LABELS: Record<string, string> = {
  popular: "⭐ 인기", qna: "❓ Q&A", review: "🎉 후기",
  regional: "📍 지역", anonymous: "🤫 익명", notice: "📢 공지",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const STATIC_POSTS: CommunityPost[] = [
  { id: 1, category: "review", title: "청년 월세 지원 드디어 받았어요! 🎉", content: "신청한 지 3주 만에 승인됐습니다. 주민센터에서 전입신고 먼저 하고 복지로에서 신청했는데 생각보다 쉬웠어요!", region_text: "서울 마포구", like_count: 47, view_count: 312, created_at: "2026-04-10T09:00:00" },
  { id: 2, category: "qna", title: "내일배움카드 신청 조건이 궁금해요", content: "현재 단기 알바 중인데 신청 가능한가요? 직전 직장 퇴사 후 3개월 됐고 현재는 주 15시간 일하고 있어요.", region_text: null, like_count: 23, view_count: 189, created_at: "2026-04-09T14:30:00" },
  { id: 3, category: "regional", title: "서울 마포구 청년 지원 추가 혜택 있어요", content: "마포구청에서 청년 대상 추가 지원이 있더라고요. 구청 홈페이지에서 확인해보세요!", region_text: "서울 마포구", like_count: 31, view_count: 256, created_at: "2026-04-08T11:00:00" },
  { id: 4, category: "anonymous", title: "혼자 사는데 생활이 너무 빡빡해요..", content: "취업 준비 중인데 월세 내기도 버거워서요. 어떤 지원 받을 수 있을까요?", region_text: null, like_count: 18, view_count: 143, created_at: "2026-04-07T20:00:00" },
  { id: 5, category: "review", title: "청년도약계좌 가입 완료! 후기 남겨요", content: "은행 앱에서 5분 만에 가입했어요. 월 70만원 납입하면 정부기여금도 받을 수 있어서 강추!", region_text: "경기도 수원", like_count: 62, view_count: 421, created_at: "2026-04-06T16:00:00" },
  { id: 6, category: "qna", title: "중위소득 60% 기준이 어떻게 되나요?", content: "저 혼자 살고 있는데 월 소득이 얼마 이하여야 청년 월세 지원 받을 수 있는지 알려주세요.", region_text: null, like_count: 15, view_count: 98, created_at: "2026-04-05T10:00:00" },
];

export default function CommunityPage() {
  const [filter, setFilter] = useState("all");
  const [posts, setPosts] = useState<CommunityPost[]>(STATIC_POSTS);
  const [hotPosts, setHotPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  // 글쓰기 폼
  const [modalCat, setModalCat] = useState("qna");
  const [modalRegion, setModalRegion] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [postsData, hot] = await Promise.all([
          getCommunityPosts(filter === "all" ? "all" : filter),
          getHotPosts(),
        ]);
        setPosts(postsData.items.length > 0 ? postsData.items : STATIC_POSTS);
        setHotPosts(hot.length > 0 ? hot : STATIC_POSTS.slice(0, 3));
      } catch {
        setPosts(STATIC_POSTS);
        setHotPosts(STATIC_POSTS.slice(0, 3));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  const filteredPosts =
    filter === "all"
      ? posts
      : posts.filter((p) => p.category === filter);

  const handleLike = async (post: CommunityPost) => {
    if (likedPosts.has(post.id)) return;
    try {
      await likePost(post.id);
      setLikedPosts((prev) => new Set([...prev, post.id]));
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, like_count: p.like_count + 1 } : p))
      );
      if (selectedPost?.id === post.id) {
        setSelectedPost((prev) => prev ? { ...prev, like_count: prev.like_count + 1 } : prev);
      }
    } catch {}
  };

  const handleSubmitPost = async () => {
    if (!modalTitle.trim() || !modalContent.trim()) return;
    setSubmitting(true);
    try {
      const newPost = await createCommunityPost(
        modalCat, modalTitle, modalContent, modalRegion || undefined
      );
      setPosts((prev) => [newPost, ...prev]);
      setModalOpen(false);
      setModalTitle(""); setModalContent(""); setModalRegion("");
    } catch {
      // 폴백: 로컬에만 추가
      const fakePost: CommunityPost = {
        id: Date.now(), category: modalCat, title: modalTitle,
        content: modalContent, region_text: modalRegion || null,
        like_count: 0, view_count: 0, created_at: new Date().toISOString(),
      };
      setPosts((prev) => [fakePost, ...prev]);
      setModalOpen(false);
      setModalTitle(""); setModalContent(""); setModalRegion("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="screen active">

          {/* 목록 뷰 */}
          {!selectedPost && (
            <div>
              <div className="comm-header">
                <div>
                  <h2>💬 커뮤니티</h2>
                  <p>베네픽 사용자들의 수급 후기, 질문, 지역 정보를 나눠요</p>
                </div>
              </div>

              <div className="comm-filter-bar">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`comm-filter-btn${filter === f.key ? " active" : ""}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="comm-layout">
                {/* 게시글 목록 */}
                <div>
                  {loading ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--gray-500)" }}>
                      불러오는 중...
                    </div>
                  ) : filteredPosts.length === 0 ? (
                    <div className="comm-empty">
                      <div className="icon">📭</div>
                      <h4>아직 게시글이 없어요</h4>
                      <p>첫 번째 글을 작성해 보세요!</p>
                    </div>
                  ) : (
                    <div className="comm-post-list">
                      {filteredPosts.map((post) => (
                        <div
                          key={post.id}
                          className="comm-post-card"
                          onClick={() => setSelectedPost(post)}
                        >
                          <span className={`comm-post-cat-badge ${CAT_COLORS[post.category] || "cat-qna"}`}>
                            {CAT_LABELS[post.category] || post.category}
                          </span>
                          <div className="comm-post-body">
                            <h4>{post.title}</h4>
                            <p>{post.content.substring(0, 60)}{post.content.length > 60 ? "..." : ""}</p>
                            <div className="comm-post-meta">
                              {post.region_text && (
                                <span className="comm-meta-item">📍 {post.region_text}</span>
                              )}
                              <span className="comm-meta-item">{formatDate(post.created_at)}</span>
                            </div>
                          </div>
                          <div className="comm-post-right">
                            <div className="comm-stats">
                              <span className="comm-stat">❤️ {post.like_count}</span>
                              <span className="comm-stat">👁 {post.view_count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 사이드바 */}
                <div className="comm-sidebar">
                  {/* 실시간 인사이트 */}
                  <div className="insight-widget">
                    <div className="insight-widget-header">
                      <div className="insight-widget-title">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        실시간 정책 인사이트
                      </div>
                    </div>
                    <div className="insight-section-label">이번 주 가장 많이 조회된 정책 TOP 3</div>
                    {[
                      { name: "청년 월세 지원", pct: 85 },
                      { name: "중소기업 소득세 감면", pct: 62 },
                      { name: "내일배움카드", pct: 45 },
                    ].map((item) => (
                      <div className="insight-policy-row" key={item.name}>
                        <div className="insight-policy-meta">
                          <span className="insight-policy-name">{item.name}</span>
                          <span className="insight-policy-pct">{item.pct}%</span>
                        </div>
                        <div className="insight-bar-track">
                          <div className="insight-bar-fill" style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="insight-stats-row">
                      <div className="insight-stat-chip">
                        <div className="val">{filteredPosts.length}</div>
                        <div className="lbl">총 게시글</div>
                      </div>
                      <div className="insight-stat-chip">
                        <div className="val">{filteredPosts.reduce((s, p) => s + p.like_count, 0)}</div>
                        <div className="lbl">누적 좋아요</div>
                      </div>
                      <div className="insight-stat-chip">
                        <div className="val">98%</div>
                        <div className="lbl">긍정 후기율</div>
                      </div>
                    </div>
                  </div>

                  {/* 주간 인기글 */}
                  <div className="comm-sidebar-card">
                    <h4>🔥 주간 인기글</h4>
                    {(hotPosts.length > 0 ? hotPosts : STATIC_POSTS.slice(0, 3)).map((p, i) => (
                      <div className="hot-item" key={p.id} onClick={() => setSelectedPost(p)}>
                        <span className="hot-num">{i + 1}</span>
                        <span className="hot-title">{p.title}</span>
                        <span className="hot-likes">❤️ {p.like_count}</span>
                      </div>
                    ))}
                  </div>

                  {/* AI 복지 팁 */}
                  <div className="comm-sidebar-card" style={{ background: "var(--blue-light)", borderColor: "transparent" }}>
                    <h4 style={{ color: "var(--blue-dark)" }}>💡 AI 복지 팁</h4>
                    <p style={{ fontSize: 12, color: "var(--blue-dark)", lineHeight: 1.7 }}>
                      청년 월세 지원은 신청 전 반드시 현 주소지로 전입신고를 완료해야 합니다.
                      전입신고 없이 신청하면 100% 탈락이니 주의하세요! 복지로에서 온라인으로 쉽게 신청할 수 있어요.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 상세 보기 */}
          {selectedPost && (
            <div>
              <div className="comm-detail-back">
                <button onClick={() => setSelectedPost(null)}>← 목록으로</button>
                <span style={{ fontSize: 13, color: "var(--gray-500)" }}>/ 게시글 상세</span>
              </div>
              <div className="comm-layout">
                <div>
                  <div className="comm-detail-card">
                    <div className="comm-detail-meta">
                      <span className={`comm-post-cat-badge ${CAT_COLORS[selectedPost.category] || "cat-qna"}`}>
                        {CAT_LABELS[selectedPost.category] || selectedPost.category}
                      </span>
                      {selectedPost.region_text && (
                        <span style={{ fontSize: 12, color: "var(--gray-500)" }}>📍 {selectedPost.region_text}</span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                        {formatDate(selectedPost.created_at)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                        👁 {selectedPost.view_count}
                      </span>
                    </div>
                    <h2>{selectedPost.title}</h2>
                    <div className="comm-detail-content">{selectedPost.content}</div>
                    <button
                      className={`comm-like-btn${likedPosts.has(selectedPost.id) ? " liked" : ""}`}
                      onClick={() => handleLike(selectedPost)}
                    >
                      ❤️ 좋아요 {selectedPost.like_count + (likedPosts.has(selectedPost.id) ? 0 : 0)}
                    </button>
                  </div>
                </div>
                <div className="comm-sidebar">
                  <div className="comm-sidebar-card">
                    <h4>🔥 다른 인기글도 보기</h4>
                    {STATIC_POSTS.slice(0, 3).map((p, i) => (
                      <div className="hot-item" key={p.id} onClick={() => setSelectedPost(p)}>
                        <span className="hot-num">{i + 1}</span>
                        <span className="hot-title">{p.title}</span>
                        <span className="hot-likes">❤️ {p.like_count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        className="fab-write visible"
        onClick={() => setModalOpen(true)}
      >
        ✏️ 글쓰기
      </button>

      {/* 글쓰기 모달 */}
      {modalOpen && (
        <div
          className="comm-modal-bg open"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="comm-modal">
            <h3>✏️ 새 글 작성</h3>
            <label>카테고리</label>
            <select value={modalCat} onChange={(e) => setModalCat(e.target.value)}>
              <option value="qna">❓ 질문/답변</option>
              <option value="review">🎉 수급 후기</option>
              <option value="regional">📍 지역 정보</option>
              <option value="anonymous">🤫 익명 고민</option>
            </select>
            <label>지역 태그 (선택)</label>
            <input
              type="text"
              value={modalRegion}
              onChange={(e) => setModalRegion(e.target.value)}
              placeholder="예: 서울 강남구, 부산 해운대구"
            />
            <label>제목</label>
            <input
              type="text"
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={80}
            />
            <label>내용</label>
            <textarea
              value={modalContent}
              onChange={(e) => setModalContent(e.target.value)}
              rows={6}
              placeholder="내용을 입력하세요. 복지 혜택과 관련된 경험이나 질문을 공유해 주세요!"
            />
            <div className="comm-modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>취소</button>
              <button
                className="btn-primary"
                onClick={handleSubmitPost}
                disabled={submitting}
              >
                {submitting ? "등록 중..." : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
