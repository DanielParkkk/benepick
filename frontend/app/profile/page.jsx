'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import TabBar from '../../components/TabBar';
import {
  updateUserProfile,
  changePassword,
  deleteAccount,
  deleteSocialAccount,
  logout,
  getFirebaseErrorMessage,
  auth,
} from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser]           = useState(null);  // Firebase user
  const [storedUser, setStoredUser] = useState({});  // localStorage user
  const [provider, setProvider]   = useState('email'); // 'email' | 'google' | 'kakao' | 'naver'
  const [loading, setLoading]     = useState(true);

  // 이름 수정
  const [name, setName]           = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg]     = useState('');

  // 비밀번호 변경
  const [curPw, setCurPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg]         = useState('');

  // 회원 탈퇴 모달
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawPw, setWithdrawPw] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawConfirmText, setWithdrawConfirmText] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) { router.replace('/login'); return; }
      setUser(firebaseUser);
      // 로그인 방식 파악
      const providerData = firebaseUser.providerData[0]?.providerId || 'password';
      if (providerData === 'google.com') setProvider('google');
      else if (providerData === 'password') setProvider('email');
      else setProvider('social'); // 카카오/네이버는 Firebase 외부 처리
      setLoading(false);
    });

    const stored = (() => { try { return JSON.parse(localStorage.getItem('benefic_user') || '{}'); } catch { return {}; } })();
    setStoredUser(stored);

    // 카카오/네이버 여부 확인
    if (stored.provider === 'kakao') setProvider('kakao');
    if (stored.provider === 'naver') setProvider('naver');

    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) setName(user.displayName || storedUser.name || '');
  }, [user, storedUser]);

  const displayName  = user?.displayName || storedUser.name || '사용자';
  const displayEmail = user?.email || storedUser.email || '';
  const initial      = displayName[0]?.toUpperCase() || '나';
  const photo        = user?.photoURL || storedUser.photo || null;

  // ── 이름 저장 ──────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!name.trim()) { setNameMsg('error:이름을 입력해 주세요.'); return; }
    setNameLoading(true);
    setNameMsg('');
    try {
      await updateUserProfile(name.trim());
      setNameMsg('ok:이름이 저장되었습니다.');
    } catch (err) {
      setNameMsg(`error:${getFirebaseErrorMessage(err.code)}`);
    } finally {
      setNameLoading(false);
    }
  };

  // ── 비밀번호 변경 ──────────────────────────────────────────────
  const handleChangePw = async () => {
    setPwMsg('');
    if (!curPw) { setPwMsg('error:현재 비밀번호를 입력해 주세요.'); return; }
    if (newPw.length < 8 || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPw)) {
      setPwMsg('error:새 비밀번호는 8자 이상, 특수문자를 포함해야 해요.'); return;
    }
    if (newPw !== newPwConfirm) { setPwMsg('error:새 비밀번호가 일치하지 않아요.'); return; }
    setPwLoading(true);
    try {
      await changePassword(curPw, newPw);
      setPwMsg('ok:비밀번호가 변경되었습니다.');
      setCurPw(''); setNewPw(''); setNewPwConfirm('');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwMsg('error:현재 비밀번호가 올바르지 않아요.');
      } else {
        setPwMsg(`error:${getFirebaseErrorMessage(err.code)}`);
      }
    } finally {
      setPwLoading(false);
    }
  };

  // ── 회원 탈퇴 ─────────────────────────────────────────────────
  const handleWithdraw = async () => {
    setWithdrawError('');
    if (provider === 'email' && !withdrawPw) { setWithdrawError('비밀번호를 입력해 주세요.'); return; }
    if (withdrawConfirmText !== '탈퇴하기') { setWithdrawError('"탈퇴하기"를 정확히 입력해 주세요.'); return; }
    setWithdrawLoading(true);
    try {
      if (provider === 'email') {
        await deleteAccount(withdrawPw);
      } else {
        await deleteSocialAccount();
      }
      router.replace('/login');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setWithdrawError('비밀번호가 올바르지 않아요.');
      } else if (err.code === 'auth/requires-recent-login') {
        setWithdrawError('보안을 위해 다시 로그인 후 탈퇴해 주세요.');
        await logout();
        router.replace('/login');
      } else {
        setWithdrawError(getFirebaseErrorMessage(err.code));
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  const msgColor = (msg) => msg.startsWith('ok:') ? '#15803d' : '#e74c3c';
  const msgText  = (msg) => msg.replace(/^(ok|error):/, '');

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'32px',height:'32px',border:'3px solid #e5e7eb',borderTopColor:'#4A90E2',borderRadius:'50%',animation:'spin .6s linear infinite'}} />
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .profile-input { width:100%; border:1.5px solid #e5e7eb; border-radius:8px; padding:12px 14px; font-size:14px; font-family:'Pretendard',sans-serif; outline:none; box-sizing:border-box; transition:border-color .15s; background:#fff; }
        .profile-input:focus { border-color:#4A90E2; box-shadow:0 0 0 3px rgba(74,144,226,0.12); }
        .profile-input:disabled { background:#f9fafb; color:#9ca3af; cursor:not-allowed; }
        .profile-label { display:block; font-size:12px; font-weight:700; color:#6b7280; margin-bottom:6px; letter-spacing:0.3px; text-transform:uppercase; }
        .profile-section { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; margin-bottom:16px; box-shadow:0 1px 4px rgba(0,0,0,0.05); }
        .profile-section-title { font-size:15px; font-weight:700; color:#111; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .btn-save { padding:12px 20px; background:linear-gradient(135deg,#4A90E2,#2B6CB0); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; font-family:'Pretendard',sans-serif; cursor:pointer; transition:all .15s; }
        .btn-save:hover { opacity:0.9; }
        .btn-save:disabled { opacity:0.6; cursor:not-allowed; }
        .field-msg { font-size:12px; font-weight:600; margin-top:6px; }
        .withdraw-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
        .withdraw-modal { background:#fff; border-radius:16px; padding:28px 24px; width:100%; max-width:420px; box-shadow:0 20px 60px rgba(0,0,0,0.2); }
        .withdraw-title { font-size:18px; font-weight:800; color:#111; margin-bottom:6px; }
        .withdraw-desc { font-size:13px; color:#6b7280; line-height:1.6; margin-bottom:20px; }
        .withdraw-warn { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 14px; font-size:13px; color:#c2410c; margin-bottom:16px; line-height:1.5; }
        .withdraw-confirm-input { display:block; width:100%; border:1.5px solid #e5e7eb; border-radius:8px; padding:12px 14px; font-size:14px; font-family:'Pretendard',sans-serif; outline:none; box-sizing:border-box; margin-bottom:8px; }
        .withdraw-confirm-input.ready { border-color:#e74c3c; }
        .btn-withdraw { width:100%; padding:13px; background:#e74c3c; color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:700; font-family:'Pretendard',sans-serif; cursor:pointer; transition:all .15s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .btn-withdraw:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-cancel-modal { width:100%; padding:12px; background:#f9fafb; color:#374151; border:1px solid #e5e7eb; border-radius:8px; font-size:14px; font-weight:700; font-family:'Pretendard',sans-serif; cursor:pointer; margin-top:8px; }
        .btn-cancel-modal:hover { background:#f3f4f6; }
        .spinner-sm { width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; }
      `}</style>

      <NavBar activePage="" />
      <div className="container">
        <div style={{maxWidth:'800px', margin:'0 auto', padding:'24px 0 80px'}}>

          <div style={{marginBottom:'24px'}}>
            <h2 style={{fontSize:'22px', fontWeight:'800', color:'#111', marginBottom:'6px'}}>👤 개인정보 수정</h2>
            <p style={{fontSize:'14px', color:'#6b7280'}}>프로필 정보와 계정을 관리하세요.</p>
          </div>

          {/* 프로필 카드 */}
          <div style={{display:'flex', alignItems:'center', gap:'20px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'24px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
            {photo ? (
              <img src={photo} alt="프로필" style={{width:'72px', height:'72px', borderRadius:'50%', objectFit:'cover', flexShrink:0}} />
            ) : (
              <div style={{width:'72px', height:'72px', borderRadius:'50%', background:'linear-gradient(135deg,#4A90E2,#2ECC71)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', fontWeight:'800', color:'#fff', flexShrink:0}}>
                {initial}
              </div>
            )}
            <div>
              <div style={{fontSize:'20px', fontWeight:'800', color:'#111', marginBottom:'2px'}}>{displayName}</div>
              <div style={{fontSize:'13px', color:'#6b7280', marginBottom:'4px'}}>{displayEmail}</div>
              <div style={{display:'inline-block', fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'99px',
                background: provider === 'google' ? '#fff0f0' : provider === 'kakao' ? '#fffbe6' : provider === 'naver' ? '#f0fff4' : '#f0f7ff',
                color: provider === 'google' ? '#e53e3e' : provider === 'kakao' ? '#b7791f' : provider === 'naver' ? '#15803d' : '#2b6cb0'}}>
                {provider === 'google' ? '🔵 구글 계정' : provider === 'kakao' ? '🟡 카카오 계정' : provider === 'naver' ? '🟢 네이버 계정' : '📧 이메일 계정'}
              </div>
            </div>
          </div>

          {/* 이름 수정 */}
          <div className="profile-section">
            <div className="profile-section-title">✏️ 이름 수정</div>
            <div style={{display:'flex', gap:'10px', alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <label className="profile-label">이름</label>
                <input className="profile-input" type="text" value={name}
                  onChange={(e) => { setName(e.target.value); setNameMsg(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
                  placeholder="이름을 입력하세요" />
                {nameMsg && <div className="field-msg" style={{color: msgColor(nameMsg)}}>{msgText(nameMsg)}</div>}
              </div>
              <button className="btn-save" style={{marginTop:'22px', whiteSpace:'nowrap'}} onClick={handleSaveName} disabled={nameLoading}>
                {nameLoading ? '저장 중...' : '저장'}
              </button>
            </div>

            <div style={{marginTop:'16px'}}>
              <label className="profile-label">이메일 (변경 불가)</label>
              <input className="profile-input" type="email" value={displayEmail} disabled />
            </div>
          </div>

          {/* 비밀번호 변경 - 이메일 계정만 */}
          {provider === 'email' && (
            <div className="profile-section">
              <div className="profile-section-title">🔑 비밀번호 변경</div>
              <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                <div>
                  <label className="profile-label">현재 비밀번호</label>
                  <input className="profile-input" type="password" value={curPw}
                    onChange={(e) => { setCurPw(e.target.value); setPwMsg(''); }}
                    placeholder="현재 비밀번호" autoComplete="current-password" />
                </div>
                <div>
                  <label className="profile-label">새 비밀번호</label>
                  <input className="profile-input" type="password" value={newPw}
                    onChange={(e) => { setNewPw(e.target.value); setPwMsg(''); }}
                    placeholder="8자 이상, 특수문자 포함" autoComplete="new-password" />
                </div>
                <div>
                  <label className="profile-label">새 비밀번호 확인</label>
                  <input className="profile-input" type="password" value={newPwConfirm}
                    onChange={(e) => { setNewPwConfirm(e.target.value); setPwMsg(''); }}
                    placeholder="새 비밀번호 재입력" autoComplete="new-password" />
                </div>
                {pwMsg && <div className="field-msg" style={{color: msgColor(pwMsg)}}>{msgText(pwMsg)}</div>}
                <button className="btn-save" style={{alignSelf:'flex-end'}} onClick={handleChangePw} disabled={pwLoading}>
                  {pwLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          )}

          {/* 소셜 계정 비밀번호 안내 */}
          {provider !== 'email' && (
            <div className="profile-section">
              <div className="profile-section-title">🔑 비밀번호</div>
              <p style={{fontSize:'13px', color:'#6b7280', lineHeight:'1.6'}}>
                소셜 계정으로 로그인하셨어요. 비밀번호는 해당 서비스({provider === 'google' ? '구글' : provider === 'kakao' ? '카카오' : '네이버'})에서 관리해 주세요.
              </p>
            </div>
          )}

          {/* 계정 관리 */}
          <div className="profile-section">
            <div className="profile-section-title">⚙️ 계정 관리</div>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <button onClick={async () => { await logout(); router.push('/login'); }}
                style={{padding:'13px', background:'#f9fafb', color:'#374151', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', fontWeight:'700', fontFamily:'inherit', cursor:'pointer', textAlign:'left'}}>
                🚪 로그아웃
              </button>
              <button onClick={() => { setShowWithdraw(true); setWithdrawPw(''); setWithdrawConfirmText(''); setWithdrawError(''); }}
                style={{padding:'13px', background:'#fff5f5', color:'#e74c3c', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'14px', fontWeight:'700', fontFamily:'inherit', cursor:'pointer', textAlign:'left'}}>
                🗑️ 회원 탈퇴
              </button>
            </div>
          </div>

        </div>
      </div>
      <TabBar active="profile" />

      {/* 회원 탈퇴 모달 */}
      {showWithdraw && (
        <div className="withdraw-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setShowWithdraw(false); }}>
          <div className="withdraw-modal">
            <div className="withdraw-title">🗑️ 정말 탈퇴하시겠어요?</div>
            <div className="withdraw-desc">탈퇴하면 모든 데이터(스크랩, 분석 기록 등)가 삭제되며 복구할 수 없어요.</div>

            <div className="withdraw-warn">
              ⚠️ 탈퇴 즉시 계정이 영구 삭제됩니다.<br />
              저장된 복지 정보와 분석 결과가 모두 사라져요.
            </div>

            {provider === 'email' && (
              <div style={{marginBottom:'12px'}}>
                <label className="profile-label">현재 비밀번호 확인</label>
                <input className="withdraw-confirm-input" type="password" value={withdrawPw}
                  onChange={(e) => { setWithdrawPw(e.target.value); setWithdrawError(''); }}
                  placeholder="비밀번호를 입력하세요" />
              </div>
            )}

            <div style={{marginBottom:'12px'}}>
              <label className="profile-label">아래에 <strong style={{color:'#e74c3c'}}>"탈퇴하기"</strong>를 입력해 주세요</label>
              <input
                className={`withdraw-confirm-input${withdrawConfirmText === '탈퇴하기' ? ' ready' : ''}`}
                type="text" value={withdrawConfirmText}
                onChange={(e) => { setWithdrawConfirmText(e.target.value); setWithdrawError(''); }}
                placeholder="탈퇴하기" />
            </div>

            {withdrawError && (
              <div style={{fontSize:'12px', fontWeight:'600', color:'#e74c3c', marginBottom:'12px'}}>{withdrawError}</div>
            )}

            <button className="btn-withdraw" onClick={handleWithdraw}
              disabled={withdrawLoading || withdrawConfirmText !== '탈퇴하기' || (provider === 'email' && !withdrawPw)}>
              {withdrawLoading ? <div className="spinner-sm" /> : null}
              {withdrawLoading ? '탈퇴 처리 중...' : '회원 탈퇴'}
            </button>
            <button className="btn-cancel-modal" onClick={() => setShowWithdraw(false)}>취소</button>
          </div>
        </div>
      )}
    </>
  );
}
