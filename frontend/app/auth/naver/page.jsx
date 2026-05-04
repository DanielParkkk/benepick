'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function NaverCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('네이버 로그인 처리 중...');

  useEffect(() => {
    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('로그인이 취소되었습니다.');
      setTimeout(() => router.push('/login'), 1500);
      return;
    }

    if (!code || !state) {
      setStatus('잘못된 접근입니다.');
      setTimeout(() => router.push('/login'), 1500);
      return;
    }

    // CSRF state 검증
    const savedState = sessionStorage.getItem('naver_oauth_state');
    if (state !== savedState) {
      setStatus('보안 검증에 실패했습니다.');
      setTimeout(() => router.push('/login'), 1500);
      return;
    }
    sessionStorage.removeItem('naver_oauth_state');

    // Next.js API Route로 토큰 교환 요청 (Client Secret 숨김 처리)
    fetch('/api/auth/naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);

        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('benefic_user', JSON.stringify(data.user));

        setStatus('로그인 성공! 이동 중...');
        router.push('/');
      })
      .catch((err) => {
        console.error('[네이버 콜백] 오류:', err);
        setStatus('로그인 처리 중 오류가 발생했습니다.');
        setTimeout(() => router.push('/login'), 2000);
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: "'Pretendard', sans-serif",
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <circle cx="12" cy="12" r="10" stroke="#03C75A" strokeWidth="3" fill="none" strokeDasharray="40 20" />
      </svg>
      <p style={{ fontSize: '16px', color: '#555' }}>{status}</p>
    </div>
  );
}

export default function NaverCallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>}>
      <NaverCallback />
    </Suspense>
  );
}
