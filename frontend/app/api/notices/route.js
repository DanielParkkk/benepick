import { NextResponse } from 'next/server';
import { getPool, initDB } from '../../../lib/db.js';
import { authFromHeader } from '../../../lib/auth.js';
import { seedAdminIfEmpty, seedNoticesIfEmpty } from '../../../lib/seed.js';

export async function GET() {
  try {
    await initDB();
    await seedAdminIfEmpty();
    await seedNoticesIfEmpty();

    const pool   = getPool();
    const result = await pool.query(
      'SELECT * FROM notice ORDER BY pinned DESC, created_at DESC'
    );

    return NextResponse.json({
      success: true,
      data: { items: result.rows, total_count: result.rows.length },
    });
  } catch (err) {
    console.error('[GET /api/notices]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const username = authFromHeader(request);
    if (!username) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
    }

    const { title, content, pinned = false } = await request.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });
    }

    const pool   = getPool();
    const result = await pool.query(
      'INSERT INTO notice (title, content, pinned) VALUES ($1, $2, $3) RETURNING *',
      [title.trim(), content.trim(), pinned]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notices]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
