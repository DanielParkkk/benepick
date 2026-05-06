const KAKAO_JS_KEY =
  process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '8364c8aa16b940b51d4e5883c86fa0b8';

function getKakaoRedirectUri() {
  if (process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;
  }

  return `${window.location.origin}/auth/kakao`;
}

export function loginWithKakao() {
  const redirectUri = getKakaoRedirectUri();
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_JS_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&prompt=login`;

  window.location.href = kakaoAuthUrl;
}

export async function logoutKakao() {
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}
