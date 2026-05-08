// app/api/auth/naver/route.js
// 네이버 OAuth code → access_token + 유저 정보 교환
// Client Secret은 여기서만 사용 (서버 사이드 → 외부에 노출 안 됨)

import { NextResponse } from 'next/server';

const NAVER_CLIENT_ID     = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET; // NEXT_PUBLIC 아님 (서버 전용)
const REDIRECT_URI        = 'https://benepick.vercel.app/auth/naver';

export async function POST(request) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json({ error: 'code와 state가 필요합니다.' }, { status: 400 });
    }

    // 1) 네이버에 access_token 요청
    const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     NAVER_CLIENT_ID,
        client_secret: NAVER_CLIENT_SECRET,
        code,
        state,
        redirect_uri:  REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.json(
        { error: tokenData.error_description || '토큰 발급 실패' },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // 2) 네이버 유저 정보 요청
    const userRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userJson = await userRes.json();

    if (userJson.resultcode !== '00') {
      return NextResponse.json({ error: '유저 정보 조회 실패' }, { status: 400 });
    }

    const profile = userJson.response;
    const name    = profile.name    || '네이버 사용자';
    const email   = profile.email   || '';
    const photo   = profile.profile_image || null;
    const uid     = profile.id;

    return NextResponse.json({
      accessToken,
      user: {
        name,
        email,
        photo,
        uid,
        provider: 'naver',
        initial: name[0].toUpperCase(),
      },
    });
  } catch (err) {
    console.error('[네이버 OAuth API] 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
