'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const KAKAO_JS_KEY = '8364c8aa16b940b51d4e5883c86fa0b8';
const REDIRECT_URI = 'http://localhost:3000/auth/kakao';

function KakaoCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('카카오 로그인 처리 중...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('로그인이 취소되었습니다.');
      setTimeout(() => router.push('/login'), 1500);
      return;
    }

    if (!code) {
      setStatus('잘못된 접근입니다.');
      setTimeout(() => router.push('/login'), 1500);
      return;
    }

    // 인가 코드로 카카오 토큰 요청
    fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_JS_KEY,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    })
      .then((res) => res.json())
      .then((tokenData) => {
        if (tokenData.error) throw new Error(tokenData.error_description);

        const accessToken = tokenData.access_token;

        // 사용자 정보 요청
        return fetch('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((res) => res.json())
          .then((userInfo) => {
            const profile = userInfo.kakao_account?.profile || {};
            const name = profile.nickname || '카카오 사용자';
            const email = userInfo.kakao_account?.email || '';
            const photo = profile.profile_image_url || null;

            const userData = {
              name,
              email,
              photo,
              uid: String(userInfo.id),
              provider: 'kakao',
              initial: name[0].toUpperCase(),
            };

            localStorage.setItem('token', accessToken);
            localStorage.setItem('benefic_user', JSON.stringify(userData));

            setStatus('로그인 성공! 이동 중...');
            router.push('/');
          });
      })
      .catch((err) => {
        console.error('[카카오 콜백] 오류:', err);
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
        <circle cx="12" cy="12" r="10" stroke="#FEE500" strokeWidth="3" fill="none" strokeDasharray="40 20" />
      </svg>
      <p style={{ fontSize: '16px', color: '#555' }}>{status}</p>
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>}>
      <KakaoCallback />
    </Suspense>
  );
}
