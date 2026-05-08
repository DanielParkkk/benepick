import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db.js';
import { authFromHeader } from '../../../../lib/auth.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const pool   = getPool();
    const result = await pool.query('SELECT * FROM notice WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '공지사항을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[GET /api/notices/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const username = authFromHeader(request);
    if (!username) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    const pool   = getPool();
    const result = await pool.query('DELETE FROM notice WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '공지사항을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { deleted_id: parseInt(id, 10) } });
  } catch (err) {
    console.error('[DELETE /api/notices/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
