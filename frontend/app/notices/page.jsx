'use client';

import Link from 'next/link';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';

const NOTICE_ITEMS = [
  {
    id: 1,
    category: '안내',
    pinned: true,
    title: 'BenePick 커뮤니티 오픈 안내',
    date: '2025-01-10',
    summary:
      '커뮤니티 기능이 열렸습니다. 혜택 후기, 질문, 정책 정보를 자유롭게 나누고 다른 이용자의 경험도 참고해보세요.',
    body: [
      '안녕하세요, BenePick 팀입니다.',
      '이제 커뮤니티에서 정책 후기와 질문을 함께 나눌 수 있습니다.',
      '실제 신청 경험과 준비 팁을 공유하면 다른 사용자에게도 큰 도움이 됩니다.',
    ],
  },
  {
    id: 2,
    category: '정책',
    pinned: false,
    title: '정책 검색 정확도 개선 안내',
    date: '2025-01-17',
    summary:
      '검색 초기 화면과 결과 정렬 방식을 보완해, 더 빠르고 안정적으로 정책 결과를 확인할 수 있게 개선했습니다.',
    body: [
      '검색 페이지의 초기 로딩 흐름과 공통 스크립트 적용 순서를 정리했습니다.',
      '일부 브라우저에서 검색 결과가 비어 보이던 문제를 완화했습니다.',
      '정책 결과 화면의 안정성과 가독성을 중심으로 보완했습니다.',
    ],
  },
];

const CATEGORY_STYLES = {
  공지: { color: '#64748B', bg: '#F1F5F9' },
  안내: { color: '#2563EB', bg: '#EFF6FF' },
  정책: { color: '#10B981', bg: '#ECFDF5' },
  업데이트: { color: '#8B5CF6', bg: '#F5F3FF' },
};

function getCategoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.공지;
}

export default function NoticesPage() {
  const pinnedList = NOTICE_ITEMS.filter((notice) => notice.pinned);
  const normalList = NOTICE_ITEMS.filter((notice) => !notice.pinned);

  return (
    <>
      <NavBar activePage="notices" />

      <style>{`
        .notice-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .notice-card:hover {
          transform: translateY(-2px);
          border-color: rgba(37, 99, 235, 0.28);
          box-shadow: 0 10px 28px rgba(37, 99, 235, 0.10);
        }
        .notice-chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }
        .notice-fade {
          animation: noticeFadeIn 0.28s ease forwards;
        }
        @keyframes noticeFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="container">
        <div className="screen active">
          <div style={{ maxWidth: '980px', margin: '0 auto', padding: '8px 0 88px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
                marginBottom: '24px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    fontSize: '12px',
                    fontWeight: 700,
                    marginBottom: '12px',
                  }}
                >
                  <span>공지</span>
                  <span>서비스 운영 소식</span>
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 8px' }}>
                  BenePick 공지사항
                </h1>
                <p style={{ fontSize: '14px', color: 'var(--gray-500)', margin: 0 }}>
                  서비스 운영 안내와 업데이트 소식을 한곳에서 확인할 수 있습니다.
                </p>
              </div>

              <Link
                href="/community"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: 'var(--blue)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                커뮤니티로 이동
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...pinnedList, ...normalList].map((notice, idx) => {
                const category = getCategoryStyle(notice.category);
                return (
                  <article
                    key={notice.id}
                    className="notice-card notice-fade"
                    style={{
                      background: '#fff',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      animationDelay: `${idx * 0.05}s`,
                    }}
                  >
                    <div style={{ padding: '22px 26px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {notice.pinned && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#F59E0B',
                              background: '#FEF3C7',
                              padding: '3px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            상단 고정
                          </span>
                        )}
                        <span className="notice-chip" style={{ color: category.color, background: category.bg }}>
                          {notice.category}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: 600 }}>{notice.date}</span>
                      </div>

                      <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 10px' }}>
                        {notice.title}
                      </h2>

                      <p style={{ fontSize: '15px', color: 'var(--gray-700)', lineHeight: 1.7, margin: '0 0 14px' }}>
                        {notice.summary}
                      </p>

                      <div style={{ display: 'grid', gap: '8px' }}>
                        {notice.body.map((line, lineIdx) => (
                          <p
                            key={lineIdx}
                            style={{
                              fontSize: '14px',
                              color: 'var(--gray-600)',
                              lineHeight: 1.75,
                              margin: 0,
                            }}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div
              style={{
                marginTop: '24px',
                padding: '18px 20px',
                borderRadius: '14px',
                background: '#F8FAFC',
                border: '1px solid var(--gray-200)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
                커뮤니티 공지 성격의 안내를 별도 페이지로 정리해, 주요 운영 소식을 더 쉽게 볼 수 있게 했습니다.
              </p>
              <Link
                href="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: '#fff',
                  border: '1px solid var(--gray-200)',
                  color: 'var(--gray-700)',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                정책 검색으로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="community" />
    </>
  );
}
