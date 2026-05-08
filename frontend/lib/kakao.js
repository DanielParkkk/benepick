// lib/kakao.js

const KAKAO_JS_KEY = '8364c8aa16b940b51d4e5883c86fa0b8';
const REDIRECT_URI = 'https://benepick.vercel.app/auth/kakao';

// 팝업 없이 현재 탭에서 카카오 인가 페이지로 이동
export function loginWithKakao() {
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_JS_KEY}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&prompt=login`; // 매번 카카오 로그인 화면 강제 표시

  window.location.href = kakaoAuthUrl;
}

export async function logoutKakao() {
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}
