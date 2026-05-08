import { getPool, initDB } from './db.js';
import { hashPassword } from './auth.js';

const DEFAULT_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'benepick_admin_2026!';

export async function seedAdminIfEmpty() {
  await initDB();
  const pool   = getPool();
  const result = await pool.query('SELECT COUNT(*) FROM admin_user');
  if (parseInt(result.rows[0].count, 10) > 0) return;

  const hashed = hashPassword(DEFAULT_PASSWORD);
  await pool.query(
    'INSERT INTO admin_user (username, hashed_password) VALUES ($1, $2)',
    [DEFAULT_USERNAME, hashed]
  );
}

export async function seedNoticesIfEmpty() {
  const pool   = getPool();
  const result = await pool.query('SELECT COUNT(*) FROM notice');
  if (parseInt(result.rows[0].count, 10) > 0) return;

  const samples = [
    { title: '베네픽 서비스 오픈 안내', content: '안녕하세요, 베네픽입니다.\n\n복지 수급 확률 분석 플랫폼 베네픽이 정식 오픈하였습니다.\n\n여러분의 맞춤 복지 혜택을 빠르고 정확하게 찾아드리겠습니다.\n\n앞으로도 더 나은 서비스로 보답하겠습니다. 감사합니다.', pinned: true },
    { title: '정책 데이터베이스 업데이트 안내 (2026년 5월)', content: '2026년 5월 정책 데이터베이스가 업데이트되었습니다.\n\n- 청년 주거 지원 정책 신규 등록\n- 출산·육아 지원 정책 내용 갱신\n- 노인 복지 프로그램 추가\n\n최신 정보를 바탕으로 더욱 정확한 맞춤 정책을 추천해드립니다.', pinned: false },
    { title: '서버 점검 안내 (5월 10일 새벽 2시~4시)', content: '안정적인 서비스 제공을 위해 서버 점검을 진행합니다.\n\n■ 점검 일시: 2026년 5월 10일(일) 새벽 02:00 ~ 04:00\n■ 점검 내용: 서버 인프라 업그레이드 및 성능 개선\n\n점검 시간 동안 서비스 이용이 일시적으로 제한될 수 있습니다.\n불편을 드려 죄송합니다.', pinned: false },
  ];

  for (const s of samples) {
    await pool.query(
      'INSERT INTO notice (title, content, pinned) VALUES ($1, $2, $3)',
      [s.title, s.content, s.pinned]
    );
  }
}
