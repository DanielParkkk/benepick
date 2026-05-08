// Firebase ID 토큰에서 uid 추출 (서버사이드)
// Firebase Admin SDK 없이 JWT payload만 디코딩 (서명 검증 생략 — 내부 API 전용)
// 보안을 강화하려면 firebase-admin 패키지로 verifyIdToken()을 사용하세요.

export function getUserIdFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → JSON
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    // Firebase ID 토큰의 uid 필드 (또는 sub)
    const uid = payload.user_id || payload.sub;
    if (!uid) return null;
    // 만료 확인
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return uid;
  } catch {
    return null;
  }
}
