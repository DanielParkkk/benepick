import { NextResponse } from 'next/server';
import { getPool, initDB } from '../../../../lib/db.js';
import { verifyPassword, makeToken } from '../../../../lib/auth.js';
import { seedAdminIfEmpty } from '../../../../lib/seed.js';

export async function POST(request) {
  try {
    await initDB();
    await seedAdminIfEmpty();

    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }

    const pool   = getPool();
    const result = await pool.query(
      'SELECT * FROM admin_user WHERE username = $1 AND is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0 || !verifyPassword(password, result.rows[0].hashed_password)) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const token = makeToken(username);
    return NextResponse.json({
      success: true,
      data: { access_token: token, token_type: 'bearer', username },
    });
  } catch (err) {
    console.error('[admin/login]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
