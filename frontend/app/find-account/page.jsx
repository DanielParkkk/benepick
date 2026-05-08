'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getFirebaseErrorMessage, checkEmailExists, resetPassword } from '@/lib/firebase';

function FindAccountContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'pw' ? 'pw' : 'id');

  // 아이디 찾기 상태
  const [idEmail, setIdEmail]     = useState('');
  const [idLoading, setIdLoading] = useState(false);
  const [idResult, setIdResult]   = useState(null); // null | 'found' | 'notfound'
  const [idError, setIdError]     = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // 비밀번호 찾기 상태
  const [pwEmail, setPwEmail]     = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwResult, setPwResult]   = useState(null); // null | 'sent'
  const [pwError, setPwError]     = useState('');

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // 이메일 마스킹: mki699@naver.com → mk***@naver.com
  const maskEmail = (email) => {
    const [local, domain] = email.split('@');
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
  };

  // ── 아이디 찾기: 계정 존재 여부만 확인 ────────────────────────
  const handleFindId = async () => {
    setIdError('');
    setIdResult(null);
    if (!isValidEmail(idEmail)) { setIdError('올바른 이메일 형식을 입력해 주세요.'); return; }
    setIdLoading(true);
    try {
      const exists = await checkEmailExists(idEmail);
      if (exists) {
        setMaskedEmail(maskEmail(idEmail));
        setIdResult('found');
      } else {
        setIdResult('notfound');
      }
    } catch (err) {
      setIdError(getFirebaseErrorMessage(err.code));
    } finally {
      setIdLoading(false);
    }
  };

  // ── 비밀번호 찾기: Firebase 재설정 메일 발송 ──────────────────
  const handleFindPw = async () => {
    setPwError('');
    setPwResult(null);
    if (!isValidEmail(pwEmail)) { setPwError('올바른 이메일 형식을 입력해 주세요.'); return; }
    setPwLoading(true);
    try {
      const exists = await checkEmailExists(pwEmail);
      if (!exists) {
        setPwError('가입된 계정을 찾을 수 없습니다. 이메일을 다시 확인해 주세요.');
        return;
      }
      await resetPassword(pwEmail);
      setPwResult('sent');
    } catch (err) {
      setPwError(getFirebaseErrorMessage(err.code));
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .find-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;padding:40px 16px 60px}
        .find-logo-wrap{margin-bottom:32px;text-align:center}
        .find-logo-link{display:inline-flex;align-items:center;gap:12px;text-decoration:none;transition:opacity 0.15s}
        .find-logo-link:hover{opacity:0.82}
        .find-logo-mark{width:44px;height:44px;background:linear-gradient(135deg,#4A90E2,#2ECC71);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff}
        .find-logo-name{font-size:28px;font-weight:800;color:#4A90E2;letter-spacing:-1px;font-family:'Plus Jakarta Sans',sans-serif}
        .find-card{width:100%;max-width:480px;background:#fff;border:1px solid #dadada;border-radius:6px;padding:28px 24px}
        .tab-switcher{display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:28px}
        .tab-btn{flex:1;padding:10px;font-size:14px;font-weight:700;font-family:'Pretendard',sans-serif;color:#9ca3af;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
        .tab-btn:hover{color:#111}
        .tab-btn.active{color:#4A90E2;border-bottom-color:#4A90E2}
        .panel{display:none}
        .panel.active{display:block}
        .panel-title{font-size:18px;font-weight:800;color:#111;margin-bottom:6px}
        .panel-desc{font-size:13px;color:#6b7280;margin-bottom:20px;line-height:1.6}
        .find-input-wrap{margin-bottom:12px}
        .find-input{display:block;width:100%;border:1.5px solid #dadada;border-radius:4px;padding:14px 16px;font-size:14px;font-family:'Pretendard',sans-serif;color:#222;outline:none;background:#fff;box-sizing:border-box;transition:border-color .15s}
        .find-input:focus{border-color:#4A90E2}
        .find-input.error{border-color:#e74c3c;background:#fff8f8}
        .field-error{font-size:12px;font-weight:600;color:#e74c3c;margin-top:5px;padding-left:2px}
        .btn-find{width:100%;padding:14px;background:linear-gradient(135deg,#4A90E2,#2B6CB0);color:#fff;border:none;border-radius:4px;font-size:15px;font-weight:700;font-family:'Pretendard',sans-serif;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:8px}
        .btn-find:hover{opacity:0.9}
        .btn-find:disabled{opacity:0.6;cursor:not-allowed}
        .btn-find-outline{width:100%;padding:14px;background:#fff;color:#4A90E2;border:1.5px solid #4A90E2;border-radius:4px;font-size:14px;font-weight:700;font-family:'Pretendard',sans-serif;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;margin-top:10px;text-decoration:none}
        .btn-find-outline:hover{background:#f0f7ff}
        .result-box-success{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;text-align:center;margin-bottom:14px}
        .result-box-fail{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;text-align:center;margin-bottom:14px}
        .result-icon{font-size:36px;margin-bottom:10px}
        .result-title-success{font-size:16px;font-weight:800;color:#15803d;margin-bottom:8px}
        .result-title-fail{font-size:16px;font-weight:800;color:#c2410c;margin-bottom:8px}
        .result-email{font-size:20px;font-weight:800;color:#1d4ed8;margin:8px 0}
        .result-desc{font-size:13px;color:#6b7280;line-height:1.6}
        .find-footer{display:flex;align-items:center;justify-content:center;margin-top:18px}
        .find-footer a{font-size:13px;color:#666;text-decoration:none;padding:0 14px;border-right:1px solid #ddd}
        .find-footer a:last-child{border-right:none}
        .find-footer a:hover{color:#4A90E2;text-decoration:underline}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:540px){.find-card{border:none;padding:20px 0}}
      `}</style>

      <div className="find-page">
        <div className="find-logo-wrap">
          <Link href="/" className="find-logo-link">
            <div className="find-logo-mark">B</div>
            <span className="find-logo-name">베네픽</span>
          </Link>
        </div>

        <div className="find-card">
          <div className="tab-switcher">
            <button className={`tab-btn${activeTab === 'id' ? ' active' : ''}`} onClick={() => { setActiveTab('id'); setIdResult(null); setIdError(''); }}>아이디 찾기</button>
            <button className={`tab-btn${activeTab === 'pw' ? ' active' : ''}`} onClick={() => { setActiveTab('pw'); setPwResult(null); setPwError(''); }}>비밀번호 찾기</button>
          </div>

          {/* ── 아이디 찾기 ── */}
          <div className={`panel${activeTab === 'id' ? ' active' : ''}`}>
            {idResult === 'found' ? (
              <>
                <div className="result-box-success">
                  <div className="result-icon">✅</div>
                  <div className="result-title-success">가입된 계정을 찾았어요!</div>
                  <div className="result-email">{maskedEmail}</div>
                  <div className="result-desc">위 이메일로 가입된 계정이 있어요.</div>
                </div>
                <Link href="/login" className="btn-find" style={{textDecoration:'none'}}>로그인하러 가기</Link>
                <button className="btn-find-outline" onClick={() => { setIdResult(null); setIdEmail(''); }}>다시 찾기</button>
              </>
            ) : idResult === 'notfound' ? (
              <>
                <div className="result-box-fail">
                  <div className="result-icon">❌</div>
                  <div className="result-title-fail">가입된 계정이 없어요</div>
                  <div className="result-desc">입력한 이메일로 가입된 계정을 찾을 수 없어요.<br />이메일을 다시 확인하거나 회원가입을 해주세요.</div>
                </div>
                <button className="btn-find-outline" onClick={() => { setIdResult(null); setIdEmail(''); }}>다시 찾기</button>
                <Link href="/signup" className="btn-find" style={{textDecoration:'none',marginTop:'10px'}}>회원가입하기</Link>
              </>
            ) : (
              <>
                <div className="panel-title">가입한 이메일을 입력해 주세요</div>
                <div className="panel-desc">
                  베네픽은 이메일을 아이디로 사용해요.<br />
                  이메일을 입력하면 가입 여부를 바로 확인해드려요.
                </div>
                <div className="find-input-wrap">
                  <input
                    className={`find-input${idError ? ' error' : ''}`}
                    type="email"
                    placeholder="가입한 이메일"
                    value={idEmail}
                    onChange={(e) => { setIdEmail(e.target.value); setIdError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFindId(); }}
                  />
                  {idError && <div className="field-error">{idError}</div>}
                </div>
                <button className="btn-find" onClick={handleFindId} disabled={idLoading}>
                  {idLoading && <div className="spinner" />}
                  {idLoading ? '확인 중...' : '아이디 확인하기'}
                </button>
              </>
            )}
          </div>

          {/* ── 비밀번호 찾기 ── */}
          <div className={`panel${activeTab === 'pw' ? ' active' : ''}`}>
            {pwResult === 'sent' ? (
              <>
                <div className="result-box-success">
                  <div className="result-icon">📧</div>
                  <div className="result-title-success">재설정 메일을 보냈어요!</div>
                  <div className="result-desc">
                    <strong>{pwEmail}</strong>으로<br />
                    비밀번호 재설정 링크를 보냈어요.<br />
                    메일의 링크를 클릭해 새 비밀번호를 설정해 주세요.
                    <span style={{display:'block',marginTop:'8px',fontSize:'12px',color:'#9ca3af'}}>
                      메일이 안 보이면 스팸함을 확인해 주세요.
                    </span>
                  </div>
                </div>
                <Link href="/login" className="btn-find" style={{textDecoration:'none'}}>로그인하러 가기</Link>
                <button className="btn-find-outline" onClick={() => { setPwResult(null); setPwEmail(''); }}>다시 보내기</button>
              </>
            ) : (
              <>
                <div className="panel-title">가입한 이메일을 입력해 주세요</div>
                <div className="panel-desc">
                  이메일로 비밀번호 재설정 링크를 보내드려요.<br />
                  링크를 클릭하면 새 비밀번호를 설정할 수 있어요.
                </div>
                <div className="find-input-wrap">
                  <input
                    className={`find-input${pwError ? ' error' : ''}`}
                    type="email"
                    placeholder="가입한 이메일"
                    value={pwEmail}
                    onChange={(e) => { setPwEmail(e.target.value); setPwError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFindPw(); }}
                  />
                  {pwError && <div className="field-error">{pwError}</div>}
                </div>
                <button className="btn-find" onClick={handleFindPw} disabled={pwLoading}>
                  {pwLoading && <div className="spinner" />}
                  {pwLoading ? '발송 중...' : '비밀번호 재설정 메일 보내기'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="find-footer">
          <Link href="/login">로그인</Link>
          <Link href="/signup">회원가입</Link>
        </div>
      </div>
    </>
  );
}

export default function FindAccountPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>로딩 중...</div>}>
      <FindAccountContent />
    </Suspense>
  );
}
