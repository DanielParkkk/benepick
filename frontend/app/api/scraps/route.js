import { NextResponse } from 'next/server';
import { getPool, initDB } from '../../../lib/db.js';
import { getUserIdFromRequest } from '../../../lib/userAuth.js';

// GET /api/scraps  →  해당 유저의 스크랩 policy_id 목록
export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    await initDB();
    const pool = getPool();
    const result = await pool.query(
      'SELECT policy_id, created_at FROM user_scrap WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[GET /api/scraps]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/scraps  { policy_id }  →  스크랩 추가
export async function POST(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    const { policy_id } = await request.json();
    if (!policy_id) {
      return NextResponse.json({ error: 'policy_id가 필요합니다.' }, { status: 400 });
    }
    await initDB();
    const pool = getPool();
    await pool.query(
      `INSERT INTO user_scrap (user_id, policy_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, policy_id) DO NOTHING`,
      [userId, policy_id]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/scraps]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/scraps  { policy_id } 또는 { all: true }  →  스크랩 삭제
export async function DELETE(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    await initDB();
    const pool = getPool();
    if (body.all) {
      await pool.query('DELETE FROM user_scrap WHERE user_id = $1', [userId]);
    } else if (Array.isArray(body.policy_ids) && body.policy_ids.length > 0) {
      await pool.query(
        'DELETE FROM user_scrap WHERE user_id = $1 AND policy_id = ANY($2::text[])',
        [userId, body.policy_ids]
      );
    } else if (body.policy_id) {
      await pool.query(
        'DELETE FROM user_scrap WHERE user_id = $1 AND policy_id = $2',
        [userId, body.policy_id]
      );
    } else {
      return NextResponse.json({ error: 'policy_id 또는 all이 필요합니다.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/scraps]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
