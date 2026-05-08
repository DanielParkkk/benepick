'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginWithGoogle, loginWithEmail, getFirebaseErrorMessage } from '@/lib/firebase';
import { loginWithKakao } from '@/lib/kakao';
import { loginWithNaver } from '@/lib/naver';

const ADMIN_TOKEN_KEY = 'benefic_admin_token';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]           = useState('');
  const [pw, setPw]                 = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [ipSecure, setIpSecure]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const isReady = email.trim().length > 0 && pw.length > 0;

  const handleLogin = async () => {
    setError('');
    if (!isReady) return;
    setLoading(true);

    // 1. 먼저 관리자 로그인 시도
    try {
      const res  = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password: pw }),
      });
      if (res.ok) {
        const json = await res.json();
        try { localStorage.setItem(ADMIN_TOKEN_KEY, json.data.access_token); } catch {}
        setLoading(false);
        router.push('/notice');
        return;
      }
    } catch {}

    // 2. 관리자 아니면 Firebase 일반 로그인
    try {
      await loginWithEmail(email, pw);
      router.push('/');
    } catch (err) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(''); setLoading(true);
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(getFirebaseErrorMessage(err.code));
      }
    } finally { setLoading(false); }
  };

  const handleKakaoLogin = () => { setError(''); loginWithKakao(); };
  const handleNaverLogin = () => { setError(''); loginWithNaver(); };

  return (
    <>
      <style>{`
        .auth-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; padding: 40px 16px 60px; }
        .auth-logo-wrap { margin-bottom: 36px; text-align: center; }
        .auth-logo-link { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; transition: opacity 0.15s; }
        .auth-logo-link:hover { opacity: 0.82; }
        .auth-logo-mark { width: 50px; height: 50px; background: linear-gradient(135deg, #4A90E2, #2ECC71); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 800; color: #fff; box-shadow: 0 4px 14px rgba(74,144,226,0.35); }
        .auth-logo-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 36px; font-weight: 800; color: #4A90E2; letter-spacing: -1.5px; }
        .auth-card { width: 100%; max-width: 500px; background: #fff; border: 1px solid #dadada; border-radius: 6px; padding: 28px 24px 24px; }
        .auth-input-group { border: 1.5px solid #dadada; border-radius: 4px; overflow: hidden; margin-bottom: 12px; transition: border-color 0.15s; }
        .auth-input-group:focus-within { border-color: #4A90E2; }
        .auth-input { display: block; width: 100%; border: none; border-bottom: 1px solid #efefef; padding: 15px 16px; font-size: 15px; font-family: 'Pretendard', sans-serif; color: #222; outline: none; background: #fff; transition: background 0.15s; box-sizing: border-box; }
        .auth-input:last-child { border-bottom: none; }
        .auth-input:focus { background: #f5faff; }
        .auth-input::placeholder { color: #bbb; }
        .global-error { display: none; font-size: 12px; color: #e74c3c; font-weight: 600; margin-bottom: 10px; padding-left: 2px; }
        .global-error.visible { display: block; }
        .auth-options { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .remember-check { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #555; user-select: none; }
        .check-circle { width: 19px; height: 19px; border: 1.5px solid #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; transition: all 0.15s; font-weight: 700; }
        .ip-security { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #555; }
        .toggle { position: relative; width: 46px; height: 24px; cursor: pointer; flex-shrink: 0; }
        .toggle-track { position: absolute; inset: 0; background: #bbb; border-radius: 12px; transition: background 0.2s; display: flex; align-items: center; padding: 3px; justify-content: flex-start; }
        .toggle-knob { width: 18px; height: 18px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.3); flex-shrink: 0; }
        .toggle-label { font-size: 11px; font-weight: 700; color: #888; min-width: 22px; }
        .btn-login { width: 100%; padding: 15px; background: #bbb; color: #fff; border: none; border-radius: 4px; font-size: 17px; font-weight: 700; font-family: 'Pretendard', sans-serif; cursor: pointer; transition: background 0.18s; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-login.ready { background: #4A90E2; }
        .btn-login.ready:hover { background: #2B6CB0; }
        .sns-row { display: flex; gap: 8px; }
        .btn-sns { flex: 1; padding: 11px 8px; border: 1.5px solid #e0e0e0; border-radius: 4px; background: #fff; font-size: 13px; font-weight: 600; font-family: 'Pretendard', sans-serif; color: #555; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: all 0.15s; }
        .btn-sns.kakao { background: #FEE500; border-color: #FEE500; color: #3A1D1D; }
        .btn-sns.kakao:hover { background: #f5dc00; }
        .btn-sns.naver { background: #03C75A; border-color: #03C75A; color: #fff; }
        .btn-sns.naver:hover { background: #02b350; }
        .btn-sns:not(.kakao):not(.naver):hover { background: #f8f8f8; }
        .auth-footer { display: flex; align-items: center; justify-content: center; margin-top: 18px; }
        .auth-footer a { font-size: 13px; color: #666; text-decoration: none; padding: 0 14px; border-right: 1px solid #ddd; }
        .auth-footer a:last-child { border-right: none; }
        .auth-footer a:hover { color: #4A90E2; text-decoration: underline; }
        @media (max-width: 540px) {
          .auth-card { border: none; padding: 20px 0; }
          .auth-logo-name { font-size: 28px; }
        }
      `}</style>

      <div className="auth-page">
        <div className="auth-logo-wrap">
          <Link href="/" className="auth-logo-link">
            <div className="auth-logo-mark">B</div>
            <span className="auth-logo-name">베네픽</span>
          </Link>
        </div>

        <div className="auth-card">
          <div className={`global-error${error ? ' visible' : ''}`}>{error}</div>

          <div className="auth-input-group">
            <input className="auth-input" type="text" placeholder="아이디 또는 이메일" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <input className="auth-input" type="password" placeholder="비밀번호" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          <div className="auth-options">
            <label className="remember-check" onClick={() => setRememberMe(!rememberMe)}>
              <div className="check-circle" style={{ color: rememberMe ? '#4A90E2' : 'transparent', borderColor: rememberMe ? '#4A90E2' : '#ccc' }}>✓</div>
              로그인 상태 유지
            </label>
            <div className="ip-security">
              IP보안
              <label className="toggle" onClick={() => setIpSecure(!ipSecure)}>
                <div className="toggle-track" style={{ background: ipSecure ? '#4A90E2' : '#bbb', justifyContent: ipSecure ? 'flex-end' : 'flex-start' }}>
                  <div className="toggle-knob"></div>
                </div>
              </label>
              <span className="toggle-label">{ipSecure ? 'ON' : 'OFF'}</span>
            </div>
          </div>

          <button className={`btn-login${isReady ? ' ready' : ''}`} onClick={handleLogin} disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <div className="sns-row">
            <button className="btn-sns kakao" onClick={handleKakaoLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#3A1D1D" d="M12 3C7.03 3 3 6.14 3 10c0 2.5 1.6 4.7 4 5.96l-.98 3.64L10.4 17c.52.07 1.05.1 1.6.1 4.97 0 9-3.14 9-7S16.97 3 12 3z"/></svg>
              카카오 로그인
            </button>
            <button className="btn-sns naver" onClick={handleNaverLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13.8 12.3L9.9 6H6v12h4.2V11.7l3.9 6.3H18V6h-4.2v6.3z" fill="#fff"/></svg>
              네이버 로그인
            </button>
            <button className="btn-sns" onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/></svg>
              구글 로그인
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <Link href="/find-account?tab=pw">비밀번호 찾기</Link>
          <Link href="/find-account">아이디 찾기</Link>
          <Link href="/signup">회원가입</Link>
        </div>
      </div>
    </>
  );
}
