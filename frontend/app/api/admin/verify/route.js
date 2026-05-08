import { NextResponse } from 'next/server';
import { authFromHeader } from '../../../../lib/auth.js';

export async function GET(request) {
  const username = authFromHeader(request);
  if (!username) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: { username, is_admin: true } });
}
