// lib/naver.js

const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || 'Yr1ewAn_ZH3mkVq9Wfsh';
const REDIRECT_URI = 'http://localhost:3000/auth/naver';

// 네이버 인가 페이지로 리다이렉트
export function loginWithNaver() {
  const state = Math.random().toString(36).substring(2, 15); // CSRF 방지용 랜덤 state
  sessionStorage.setItem('naver_oauth_state', state);

  const naverAuthUrl =
    `https://nid.naver.com/oauth2.0/authorize` +
    `?response_type=code` +
    `&client_id=${NAVER_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;

  console.log('[네이버 로그인] 이동 URL:', naverAuthUrl); // 디버그용
  window.location.href = naverAuthUrl;
}

export async function logoutNaver() {
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}
