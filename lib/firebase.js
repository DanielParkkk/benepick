import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

// ── Firebase 설정 ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 중복 초기화 방지
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// ── 구글 로그인 ────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const token = await user.getIdToken();
  saveAuthUser(token, {
    name:     user.displayName || '사용자',
    email:    user.email || '',
    initial:  (user.displayName || '사용자')[0].toUpperCase(),
    uid:      user.uid,
    photo:    user.photoURL || null,
    provider: 'google',
  });
  return user;
}

// ── 이메일 로그인 ──────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const user = result.user;
  const token = await user.getIdToken();
  saveAuthUser(token, {
    name:     user.displayName || email.split('@')[0],
    email:    user.email || '',
    initial:  (user.displayName || email)[0].toUpperCase(),
    uid:      user.uid,
    photo:    user.photoURL || null,
    provider: 'email',
  });
  return user;
}

// ── 이메일 회원가입 ────────────────────────────────────────────
export async function signupWithEmail(email, password, displayName) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;
  await updateProfile(user, { displayName });
  await sendEmailVerification(user);
  const token = await user.getIdToken();
  saveAuthUser(token, {
    name:     displayName,
    email:    user.email || '',
    initial:  displayName[0].toUpperCase(),
    uid:      user.uid,
    photo:    null,
    provider: 'email',
  });
  return user;
}

// ── 비밀번호 재설정 이메일 ─────────────────────────────────────
// 이메일 계정 존재 여부 확인
// 잘못된 비밀번호 → 계정 있음 / user-not-found → 계정 없음
export async function checkEmailExists(email) {
  try {
    await signInWithEmailAndPassword(auth, email, '__DUMMY_PW_CHECK__');
    return true; // 이 줄엔 도달 안 함
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      return true;  // 비밀번호 틀림 = 계정 존재
    }
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
      return false; // 계정 없음
    }
    throw err; // 네트워크 오류 등 예외
  }
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// 프로필 이름 수정
export async function updateUserProfile(name) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  await updateProfile(user, { displayName: name });
  try {
    const stored = JSON.parse(localStorage.getItem('benefic_user') || '{}');
    stored.name = name;
    stored.initial = name[0].toUpperCase();
    localStorage.setItem('benefic_user', JSON.stringify(stored));
  } catch (_) {}
}

// 비밀번호 변경 (재인증 후)
export async function changePassword(currentPw, newPw) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const credential = EmailAuthProvider.credential(user.email, currentPw);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPw);
}

// 회원 탈퇴 - 이메일 계정 (비밀번호 재인증 후 삭제)
export async function deleteAccount(currentPw) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const credential = EmailAuthProvider.credential(user.email, currentPw);
  await reauthenticateWithCredential(user, credential);
  await deleteUser(user);
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}

// 회원 탈퇴 - 소셜 계정 (재인증 없이 삭제)
export async function deleteSocialAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  await deleteUser(user);
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}

// ── 로그아웃 ───────────────────────────────────────────────────
export async function logout() {
  try { await signOut(auth); } catch (_) {}
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
}

// ── Auth 상태 감시 ─────────────────────────────────────────────
export { onAuthStateChanged };

// ── 헬퍼: localStorage에 유저 저장 ────────────────────────────
function saveAuthUser(token, userData) {
  localStorage.setItem('token', token);
  localStorage.setItem('benefic_user', JSON.stringify(userData));
}

// ── Firebase 에러 → 한국어 메시지 ─────────────────────────────
export function getFirebaseErrorMessage(code) {
  const messages = {
    'auth/user-not-found':          '등록되지 않은 이메일입니다.',
    'auth/wrong-password':          '비밀번호가 올바르지 않습니다.',
    'auth/invalid-email':           '올바른 이메일 형식이 아닙니다.',
    'auth/email-already-in-use':    '이미 사용 중인 이메일입니다.',
    'auth/weak-password':           '비밀번호는 6자 이상이어야 합니다.',
    'auth/too-many-requests':       '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed':  '네트워크 오류가 발생했습니다.',
    'auth/popup-closed-by-user':    '로그인 창이 닫혔습니다.',
    'auth/cancelled-popup-request': '로그인이 취소되었습니다.',
    'auth/invalid-credential':      '이메일 또는 비밀번호가 올바르지 않습니다.',
  };
  return messages[code] ?? '오류가 발생했습니다. 다시 시도해주세요.';
}
