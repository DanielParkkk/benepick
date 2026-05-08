import { NextResponse } from 'next/server';
import { getPool, initDB } from '../../../lib/db.js';
import { getUserIdFromRequest } from '../../../lib/userAuth.js';

const MAX_ITEMS = 10; // 최근 본 공고 최대 보관 수

// GET /api/recently-viewed  →  최근 본 공고 목록 (최신순)
export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    await initDB();
    const pool = getPool();
    const result = await pool.query(
      'SELECT policy_id, viewed_at FROM user_recently_viewed WHERE user_id = $1 ORDER BY viewed_at DESC LIMIT $2',
      [userId, MAX_ITEMS]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[GET /api/recently-viewed]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/recently-viewed  { policy_id }  →  열람 기록 추가/갱신
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
    // UPSERT: 이미 있으면 viewed_at만 갱신
    await pool.query(
      `INSERT INTO user_recently_viewed (user_id, policy_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, policy_id) DO UPDATE SET viewed_at = NOW()`,
      [userId, policy_id]
    );
    // MAX_ITEMS 초과 시 오래된 것 정리
    await pool.query(
      `DELETE FROM user_recently_viewed
       WHERE user_id = $1
         AND policy_id NOT IN (
           SELECT policy_id FROM user_recently_viewed
           WHERE user_id = $1
           ORDER BY viewed_at DESC
           LIMIT $2
         )`,
      [userId, MAX_ITEMS]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/recently-viewed]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/recently-viewed  { policy_ids[] } 또는 { all: true }
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
      await pool.query('DELETE FROM user_recently_viewed WHERE user_id = $1', [userId]);
    } else if (Array.isArray(body.policy_ids) && body.policy_ids.length > 0) {
      await pool.query(
        'DELETE FROM user_recently_viewed WHERE user_id = $1 AND policy_id = ANY($2::text[])',
        [userId, body.policy_ids]
      );
    } else if (body.policy_id) {
      await pool.query(
        'DELETE FROM user_recently_viewed WHERE user_id = $1 AND policy_id = $2',
        [userId, body.policy_id]
      );
    } else {
      return NextResponse.json({ error: 'policy_id 또는 all이 필요합니다.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/recently-viewed]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
