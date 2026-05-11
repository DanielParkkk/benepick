'use client';

import Link from 'next/link';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';

const NOTICE_ITEMS = [
  {
    id: 1,
    title: 'BenePick 커뮤니티 오픈 안내',
    date: '2025-01-10',
    summary: '커뮤니티 기능이 열렸습니다. 수급 후기, 질문, 지역 정보 등을 자유롭게 나눠 주세요.',
    body: [
      '안녕하세요, BenePick 팀입니다.',
      '드디어 BenePick 커뮤니티가 오픈되었습니다.',
      '수급 후기, 질문, 지역 정보 등 다양한 이야기를 나눠 주세요. 서로의 경험을 공유하면 더 많은 분들이 도움을 받을 수 있습니다.',
    ],
  },
  {
    id: 2,
    title: '정책 검색 정확도 개선 안내',
    date: '2025-01-17',
    summary: '정책 검색 예시 태그와 검색 결과 렌더링 방식을 손봐서 검색 흐름을 더 안정적으로 개선했습니다.',
    body: [
      '정책 검색 페이지의 빠른 검색 태그와 검색 결과 초기화 흐름을 정리했습니다.',
      '브라우저에서 페이지가 먼저 뜨고 공통 스크립트가 늦게 로딩되는 경우에도 예시 태그가 안정적으로 보이도록 보완했습니다.',
      '검색 결과가 비어 보이거나 페이지 일부가 초기화되지 않던 현상도 함께 점검했습니다.',
    ],
  },
];

export default function NoticesPage() {
  return (
    <>
      <NavBar activePage="community" />

      <div className="container">
        <div className="screen active">
          <div style={{ maxWidth: '920px', margin: '0 auto', padding: '8px 0 48px' }}>
            <div style={{ marginBottom: '24px' }}>
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
                <span>📢</span>
                <span>공지사항</span>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '8px' }}>
                BenePick 공지사항
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                서비스 운영 안내와 업데이트 소식을 한 곳에서 확인할 수 있습니다.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {NOTICE_ITEMS.map((notice) => (
                <article
                  key={notice.id}
                  style={{
                    background: 'var(--white)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: '18px',
                    padding: '24px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)', margin: 0 }}>
                      {notice.title}
                    </h3>
                    <span style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>{notice.date}</span>
                  </div>

                  <p style={{ fontSize: '15px', color: 'var(--gray-700)', lineHeight: 1.7, marginBottom: '14px' }}>
                    {notice.summary}
                  </p>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {notice.body.map((line, idx) => (
                      <p
                        key={idx}
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
                </article>
              ))}
            </div>

            <div
              style={{
                marginTop: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
                커뮤니티 공지 성격의 안내를 별도 페이지로 정리해 두었습니다.
              </p>
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
                커뮤니티로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="community" />
    </>
  );
}
