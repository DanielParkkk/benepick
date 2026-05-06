const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || 'Yr1ewAn_ZH3mkVq9Wfsh';

function getNaverRedirectUri() {
  if (process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI;
  }

  return `${window.location.origin}/auth/naver`;
}

export function loginWithNaver() {
  const state = Math.random().toString(36).substring(2, 15);
  const redirectUri = getNaverRedirectUri();
  sessionStorage.setItem('naver_oauth_state', state);

  const naverAuthUrl =
    `https://nid.naver.com/oauth2.0/authorize` +
    `?response_type=code` +
    `&client_id=${NAVER_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  window.location.href = naverAuthUrl;
}

export async function logoutNaver() {
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}
