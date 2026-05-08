import crypto from 'crypto';

if (!process.env.ADMIN_SECRET_KEY) {
  throw new Error('[auth.js] ADMIN_SECRET_KEY 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.');
}
const SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const TOKEN_TTL  = parseInt(process.env.ADMIN_TOKEN_TTL || '14400', 10); // 기본 4시간

// ── 비밀번호 해시 (Node.js 내장 crypto) ──────────────────────────

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk   = crypto.pbkdf2Sync(plain, salt, 260000, 32, 'sha256').toString('hex');
  return `pbkdf2$sha256$${salt}$${dk}`;
}

export function verifyPassword(plain, hashed) {
  try {
    const [, algo, salt, dkHex] = hashed.split('$');
    const dk = crypto.pbkdf2Sync(plain, salt, 260000, 32, algo).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(dk), Buffer.from(dkHex));
  } catch {
    return false;
  }
}

// ── 토큰 (HMAC-SHA256 서명, JWT 라이브러리 없음) ─────────────────

export function makeToken(username) {
  const expire  = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const payload = `${username}:${expire}`;
  const sig     = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyToken(token) {
  try {
    const raw               = Buffer.from(token, 'base64url').toString();
    const lastColon         = raw.lastIndexOf(':');
    const secondLastColon   = raw.lastIndexOf(':', lastColon - 1);
    const payload           = raw.slice(0, lastColon);
    const sig               = raw.slice(lastColon + 1);
    const username          = raw.slice(0, secondLastColon);
    const expire            = parseInt(raw.slice(secondLastColon + 1, lastColon), 10);

    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    if (Math.floor(Date.now() / 1000) > expire) return null;
    return username;
  } catch {
    return null;
  }
}

// Authorization 헤더에서 토큰 추출 후 검증
export function authFromHeader(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}
