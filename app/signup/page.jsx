'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signupWithEmail, getFirebaseErrorMessage } from '@/lib/firebase';

export default function SignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailCheckSuccess, setEmailCheckSuccess] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reverse, setReverse] = useState(false);

  // Step1
  const [s1Email, setS1Email] = useState('');
  const [s1Pw, setS1Pw] = useState('');
  const [s1PwConfirm, setS1PwConfirm] = useState('');
  const [terms, setTerms] = useState({ t1: false, t2: false, t3: false, t4: false });
  const [errors, setErrors] = useState({});

  // Step2
  const [s2Name, setS2Name] = useState('');
  const [s2Birth, setS2Birth] = useState('');
  const [s2Gender, setS2Gender] = useState('');
  const [s2Region, setS2Region] = useState('');
  const [s2Phone, setS2Phone] = useState('');

  // Step3
  const [selectedIncome, setSelectedIncome] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedIntents, setSelectedIntents] = useState([]);

  const PROGRESS = { 1: '33%', 2: '66%', 3: '100%' };
  const LABELS = { 1: '1 / 3 단계', 2: '2 / 3 단계', 3: '3 / 3 단계' };

  const validatePw = (pw) => pw.length >= 8 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);

  const getPwStrength = (pw) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) s++;
    if (pw.length >= 12) s++;
    return s;
  };

  const pwStrength = getPwStrength(s1Pw);
  const pwHints = ['비밀번호를 입력해 주세요', '취약 — 특수문자를 추가해 주세요', '보통 — 길이를 늘리면 더 안전해요', '강력한 비밀번호입니다 ✓'];
  const barClass = (idx) => {
    if (idx === 0) return pwStrength >= 1 ? (pwStrength === 1 ? 'pw-bar weak' : pwStrength === 2 ? 'pw-bar medium' : 'pw-bar strong') : 'pw-bar';
    if (idx === 1) return pwStrength >= 2 ? (pwStrength === 2 ? 'pw-bar medium' : 'pw-bar strong') : 'pw-bar';
    if (idx === 2) return pwStrength >= 3 ? 'pw-bar strong' : 'pw-bar';
  };

  const setErr = (field, msg) => setErrors(prev => ({ ...prev, [field]: msg }));
  const clearErr = (field) => setErrors(prev => { const n = {...prev}; delete n[field]; return n; });

  const validateStep = (step) => {
    let ok = true;
    const newErrors = {};
    if (step === 1) {
      if (!s1Email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s1Email)) { newErrors.s1Email = '올바른 이메일 형식을 입력해 주세요.'; ok = false; }
      if (!validatePw(s1Pw)) { newErrors.s1Pw = '8자 이상, 특수문자를 포함해 주세요.'; ok = false; }
      if (s1Pw !== s1PwConfirm || !s1PwConfirm) { newErrors.s1PwConfirm = '비밀번호가 일치하지 않습니다.'; ok = false; }
      if (!terms.t1 || !terms.t2) { alert('필수 약관에 동의해 주세요.'); ok = false; }
    }
    if (step === 2) {
      if (!s2Name.trim()) { newErrors.s2Name = '이름을 입력해 주세요.'; ok = false; }
      if (s2Birth.replace(/\D/g, '').length !== 8) { newErrors.s2Birth = '올바른 생년월일을 입력해 주세요. (YYYYMMDD)'; ok = false; }
      if (!s2Region) { newErrors.s2Region = '거주 지역을 선택해 주세요.'; ok = false; }
    }
    setErrors(newErrors);
    return ok;
  };

  const goStep = (target, rev = false) => {
    if (!validateStep(currentStep)) return;
    setReverse(rev);
    setCurrentStep(target);
  };

  const checkEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s1Email)) {
      setErr('s1Email', '올바른 이메일 형식을 입력해 주세요.'); return;
    }
    setEmailCheckLoading(true);
    try {
      const { fetchSignInMethodsForEmail } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const methods = await fetchSignInMethodsForEmail(auth, s1Email);
      if (methods.length > 0) {
        setErr('s1Email', '이미 사용 중인 이메일입니다.');
      } else {
        setEmailCheckSuccess(true);
        clearErr('s1Email');
        setEmailVerified(true);
      }
    } catch {
      // 네트워크 오류 등 예외 상황엔 통과 허용 (Firebase가 최종 검증)
      setEmailCheckSuccess(true);
      clearErr('s1Email');
      setEmailVerified(true);
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const toggleAllTerms = (checked) => {
    setTerms({ t1: checked, t2: checked, t3: checked, t4: checked });
  };

  const formatBirth = (val) => val.replace(/\D/g, '').slice(0, 8);
  const formatPhone = (val) => {
    let v = val.replace(/\D/g, '');
    if (v.length > 3 && v.length <= 7) v = v.slice(0,3) + '-' + v.slice(3);
    else if (v.length > 7) v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7,11);
    return v;
  };

  const allTermsChecked = terms.t1 && terms.t2 && terms.t3 && terms.t4;

  const handleSubmit = async () => {
    if (!selectedIncome && !selectedHousehold && !selectedEmp) {
      // 3단계는 선택사항이므로 바로 진행
    }
    setSubmitLoading(true);
    try {
      const user = await signupWithEmail(s1Email, s1Pw, s2Name);
      // 추가 프로필 정보를 localStorage에 저장 (백엔드 연동 시 여기서 API 호출)
      const userData = {
        name: s2Name,
        email: s1Email,
        initial: s2Name[0].toUpperCase(),
        uid: user.uid,
        provider: 'email',
        photo: null,
        profile: {
          birth: s2Birth, gender: s2Gender, region: s2Region, phone: s2Phone,
          income: selectedIncome, household: selectedHousehold,
          emp: selectedEmp, intents: selectedIntents,
        },
      };
      localStorage.setItem('benefic_user', JSON.stringify(userData));
      setSuccess(true);
    } catch (err) {
      alert(getFirebaseErrorMessage(err.code));
    } finally {
      setSubmitLoading(false);
    }
  };

  const intentList = [
    {label:'🏠 주거 지원', val:'주거'},{label:'💼 일자리/취업', val:'고용'},
    {label:'🏥 의료/건강', val:'보건'},{label:'💵 금융/자산', val:'금융'},
    {label:'🎓 교육/훈련', val:'교육'},{label:'👨‍👩‍👧 가족/육아', val:'가족'},
  ];

  return (
    <>
      <style>{`
        .auth-page { min-height: 100vh; display: flex; background: var(--gray-50); }
        .auth-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .auth-card { width: 100%; max-width: 520px; background: var(--white); border-radius: var(--radius-lg); box-shadow: 0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04); padding: 44px 40px; border: 1px solid var(--gray-200); }
        .progress-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
        .progress-bar-wrap { flex: 1; height: 5px; background: var(--gray-200); border-radius: 99px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--green)); border-radius: 99px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .progress-label { font-size: 12px; font-weight: 700; color: var(--gray-500); white-space: nowrap; }
        .steps-wrapper { overflow: hidden; position: relative; }
        .step-slide { display: none; animation: slideIn 0.3s ease; }
        .step-slide.active { display: block; }
        .step-slide.reverse { animation: slideInLeft 0.3s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
        .step-title { font-size: 20px; font-weight: 800; color: var(--gray-900); letter-spacing: -0.4px; margin-bottom: 4px; }
        .step-sub { font-size: 13px; color: var(--gray-500); margin-bottom: 24px; }
        .float-group { position: relative; margin-bottom: 16px; }
        .float-group input, .float-group select { width: 100%; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: 18px 16px 8px; font-size: 15px; font-family: 'Pretendard', sans-serif; color: var(--gray-900); background: var(--gray-50); outline: none; transition: all 0.18s ease; appearance: none; line-height: 1; box-sizing: border-box; }
        .float-group input:focus, .float-group select:focus { border-color: var(--blue); background: var(--white); box-shadow: 0 0 0 3px rgba(74,144,226,0.12); transform: scale(1.005); }
        .float-group input.error { border-color: var(--red); background: var(--red-light); }
        .float-label { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 14px; font-weight: 500; color: var(--gray-500); pointer-events: none; transition: all 0.18s ease; }
        .float-group input:focus ~ .float-label, .float-group input:not(:placeholder-shown) ~ .float-label, .float-group select:focus ~ .float-label, .float-group select.filled ~ .float-label { top: 10px; transform: none; font-size: 10px; font-weight: 700; color: var(--blue); letter-spacing: 0.3px; text-transform: uppercase; }
        .field-error { display: none; font-size: 11px; font-weight: 600; color: var(--red); margin-top: 4px; padding-left: 4px; }
        .field-error.visible { display: block; }
        .field-row { display: flex; gap: 12px; }
        .field-row .float-group { flex: 1; }
        .input-action { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
        .btn-inline { background: var(--blue-light); border: none; border-radius: 7px; padding: 6px 11px; font-size: 11px; font-weight: 700; color: var(--blue); cursor: pointer; font-family: 'Pretendard', sans-serif; white-space: nowrap; transition: all 0.15s; }
        .btn-inline:hover { background: var(--blue); color: #fff; }
        .btn-inline.success { background: var(--green-light); color: var(--green-dark); }
        .pw-strength { display: flex; gap: 4px; margin-top: 6px; margin-bottom: 4px; }
        .pw-bar { flex: 1; height: 3px; border-radius: 99px; background: var(--gray-200); transition: background 0.3s; }
        .pw-bar.weak { background: var(--red); }
        .pw-bar.medium { background: var(--orange); }
        .pw-bar.strong { background: var(--green); }
        .pw-hint { font-size: 11px; color: var(--gray-400); margin-bottom: 8px; }
        .select-arrow { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--gray-400); font-size: 12px; }
        .chip-group { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .chip { border: 1.5px solid var(--gray-200); border-radius: 99px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--gray-600); cursor: pointer; transition: all 0.15s; user-select: none; background: var(--white); }
        .chip:hover { border-color: var(--blue); color: var(--blue); }
        .chip.selected { background: var(--blue); border-color: var(--blue); color: #fff; box-shadow: 0 2px 8px rgba(74,144,226,0.3); }
        .chip-label { font-size: 12px; font-weight: 700; color: var(--gray-700); margin-bottom: 8px; margin-top: 4px; }
        .step-nav { display: flex; gap: 10px; margin-top: 28px; }
        .btn-back { background: var(--gray-100); border: none; border-radius: var(--radius-sm); padding: 14px 20px; font-size: 14px; font-weight: 700; color: var(--gray-700); cursor: pointer; font-family: 'Pretendard', sans-serif; transition: all 0.15s; }
        .btn-back:hover { background: var(--gray-200); }
        .btn-next { flex: 1; background: linear-gradient(135deg, var(--blue), var(--blue-dark)); color: #fff; border: none; border-radius: var(--radius-sm); padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Pretendard', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.18s; box-shadow: 0 4px 16px rgba(74,144,226,0.3); }
        .btn-next:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(74,144,226,0.4); }
        .btn-next:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
        .btn-next .spinner { display: none; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
        .btn-next.loading .spinner { display: block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .success-screen { text-align: center; padding: 20px 0; }
        .success-icon { width: 72px; height: 72px; background: linear-gradient(135deg, var(--green-light), #d0f7e3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 20px; animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .success-screen h2 { font-size: 22px; font-weight: 800; color: var(--gray-900); margin-bottom: 8px; }
        .success-screen p { font-size: 14px; color: var(--gray-500); line-height: 1.7; }
        .auth-bottom { text-align: center; margin-top: 24px; font-size: 13px; color: var(--gray-500); border-top: 1px solid var(--gray-100); padding-top: 20px; }
        .auth-bottom a { color: var(--blue); font-weight: 700; text-decoration: none; }
        .auth-bottom a:hover { text-decoration: underline; }
        .terms-box { background: var(--gray-50); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 16px; }
        .terms-row { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 5px 0; font-size: 13px; color: var(--gray-700); user-select: none; }
        .terms-check { width: 18px; height: 18px; flex-shrink: 0; border: 1.5px solid var(--gray-300); border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 11px; transition: all 0.15s; }
        .terms-check.checked { background: var(--blue); border-color: var(--blue); color: #fff; }
        .terms-row.all { font-weight: 700; color: var(--gray-900); border-bottom: 1px solid var(--gray-200); padding-bottom: 10px; margin-bottom: 6px; }
        .terms-link { color: var(--blue); font-size: 12px; margin-left: auto; font-weight: 600; }
        @media (max-width: 820px) {
          .auth-side { display: none; }
          .auth-main { padding: 24px 16px; }
          .auth-card { padding: 32px 24px; }
          .field-row { flex-direction: column; gap: 0; }
        }
      `}</style>

      <div className="auth-page">
        <div className="auth-main">
          <div className="auth-card">

            {/* Progress */}
            <div className="progress-header">
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" id="progressBar" style={{width: success ? '100%' : PROGRESS[currentStep]}}></div>
              </div>
              <div className="progress-label" id="progressLabel">{success ? '완료!' : LABELS[currentStep]}</div>
            </div>

            <div className="steps-wrapper">

              {/* STEP 1 */}
              <div className={`step-slide${currentStep === 1 && !success ? ' active' : ''}${reverse ? ' reverse' : ''}`} id="step1">
                <div className="step-title">계정을 만들어 볼게요 🔐</div>
                <p className="step-sub">로그인에 사용할 이메일과 비밀번호를 입력하세요</p>

                <div className="float-group">
                  <input type="email" id="s1Email" placeholder=" " autoComplete="email" style={{paddingRight:'96px'}}
                    value={s1Email} onChange={(e) => setS1Email(e.target.value)}
                    className={errors.s1Email ? 'error' : ''}
                  />
                  <label className="float-label" htmlFor="s1Email">이메일</label>
                  <div className="input-action">
                    <button
                      className={`btn-inline${emailCheckSuccess ? ' success' : ''}`}
                      id="emailCheckBtn"
                      onClick={checkEmail}
                      disabled={emailCheckLoading}
                    >
                      {emailCheckLoading ? '확인 중...' : emailCheckSuccess ? '✓ 사용 가능' : '중복 확인'}
                    </button>
                  </div>
                  <div className={`field-error${errors.s1Email ? ' visible' : ''}`}>{errors.s1Email || '올바른 이메일 형식을 입력해 주세요.'}</div>
                </div>

                <div className="float-group">
                  <input type="password" id="s1Pw" placeholder=" " autoComplete="new-password"
                    value={s1Pw} onChange={(e) => setS1Pw(e.target.value)}
                    className={errors.s1Pw ? 'error' : ''}
                  />
                  <label className="float-label" htmlFor="s1Pw">비밀번호</label>
                  <div className={`field-error${errors.s1Pw ? ' visible' : ''}`}>{errors.s1Pw || '8자 이상, 특수문자를 포함해 주세요.'}</div>
                </div>
                <div className="pw-strength" id="pwStrengthBars">
                  <div className={barClass(0)} id="bar1"></div>
                  <div className={barClass(1)} id="bar2"></div>
                  <div className={barClass(2)} id="bar3"></div>
                </div>
                <div className="pw-hint" id="pwHint">{pwHints[pwStrength]}</div>

                <div className="float-group">
                  <input type="password" id="s1PwConfirm" placeholder=" " autoComplete="new-password"
                    value={s1PwConfirm} onChange={(e) => setS1PwConfirm(e.target.value)}
                    className={errors.s1PwConfirm ? 'error' : ''}
                  />
                  <label className="float-label" htmlFor="s1PwConfirm">비밀번호 확인</label>
                  <div className={`field-error${errors.s1PwConfirm ? ' visible' : ''}`}>{errors.s1PwConfirm || '비밀번호가 일치하지 않습니다.'}</div>
                </div>

                <div className="terms-box">
                  <label className="terms-row all" onClick={() => toggleAllTerms(!allTermsChecked)}>
                    <div className={`terms-check${allTermsChecked ? ' checked' : ''}`}>{allTermsChecked ? '✓' : ''}</div>
                    <span>전체 동의 (필수 + 선택 항목)</span>
                  </label>
                  {[
                    {key:'t1', label:'[필수] 만 15세 이상입니다'},
                    {key:'t2', label:'[필수] 이용약관 동의', link:true},
                    {key:'t3', label:'[선택] 개인정보 수집 및 이용 동의', link:true},
                    {key:'t4', label:'[선택] 광고성 정보 수신 동의'},
                  ].map(({key, label, link}) => (
                    <label key={key} className="terms-row" onClick={() => setTerms(prev => ({...prev, [key]: !prev[key]}))}>
                      <div className={`terms-check${terms[key] ? ' checked' : ''}`}>{terms[key] ? '✓' : ''}</div>
                      <span>{label}</span>
                      {link && <span className="terms-link">보기</span>}
                    </label>
                  ))}
                </div>

                <div className="step-nav">
                  <button className="btn-next" onClick={() => goStep(2)}>
                    <span>다음 단계 →</span>
                  </button>
                </div>
              </div>

              {/* STEP 2 */}
              <div className={`step-slide${currentStep === 2 && !success ? ' active' : ''}${reverse ? ' reverse' : ''}`} id="step2">
                <div className="step-title">기본 정보를 알려주세요 👤</div>
                <p className="step-sub">정확한 분석을 위해 필요한 정보예요</p>

                <div className="float-group">
                  <input type="text" id="s2Name" placeholder=" " autoComplete="name"
                    value={s2Name} onChange={(e) => setS2Name(e.target.value)}
                    className={errors.s2Name ? 'error' : ''}
                  />
                  <label className="float-label" htmlFor="s2Name">이름 (실명)</label>
                  <div className={`field-error${errors.s2Name ? ' visible' : ''}`}>{errors.s2Name}</div>
                </div>

                <div className="field-row">
                  <div className="float-group">
                    <input type="text" id="s2Birth" placeholder=" " maxLength={8}
                      value={s2Birth} onChange={(e) => setS2Birth(formatBirth(e.target.value))}
                      className={errors.s2Birth ? 'error' : ''}
                    />
                    <label className="float-label" htmlFor="s2Birth">생년월일 (YYYYMMDD)</label>
                    <div className={`field-error${errors.s2Birth ? ' visible' : ''}`}>{errors.s2Birth}</div>
                  </div>
                  <div className="float-group" style={{flex:'none',width:'90px'}}>
                    <select id="s2Gender" value={s2Gender} onChange={(e) => setS2Gender(e.target.value)} className={s2Gender ? 'filled' : ''}>
                      <option value="">성별</option>
                      <option value="male">남성</option>
                      <option value="female">여성</option>
                    </select>
                    <label className="float-label" htmlFor="s2Gender">성별</label>
                    <div className="select-arrow">▾</div>
                  </div>
                </div>

                <div className="float-group">
                  <select id="s2Region" value={s2Region} onChange={(e) => setS2Region(e.target.value)} className={s2Region ? 'filled' : ''}>
                    <option value="">지역을 선택하세요</option>
                    <optgroup label="특별·광역시">
                      <option value="seoul">서울특별시</option>
                      <option value="busan">부산광역시</option>
                      <option value="daegu">대구광역시</option>
                      <option value="incheon">인천광역시</option>
                      <option value="gwangju">광주광역시</option>
                      <option value="daejeon">대전광역시</option>
                      <option value="ulsan">울산광역시</option>
                      <option value="sejong">세종특별자치시</option>
                    </optgroup>
                    <optgroup label="도">
                      <option value="gyeonggi">경기도</option>
                      <option value="gangwon">강원도</option>
                      <option value="chungbuk">충청북도</option>
                      <option value="chungnam">충청남도</option>
                      <option value="jeonbuk">전라북도</option>
                      <option value="jeonnam">전라남도</option>
                      <option value="gyeongbuk">경상북도</option>
                      <option value="gyeongnam">경상남도</option>
                      <option value="jeju">제주특별자치도</option>
                    </optgroup>
                  </select>
                  <label className="float-label" htmlFor="s2Region">거주 지역</label>
                  <div className="select-arrow">▾</div>
                  <div className={`field-error${errors.s2Region ? ' visible' : ''}`}>{errors.s2Region}</div>
                </div>

                <div className="float-group">
                  <input type="tel" id="s2Phone" placeholder=" " maxLength={13} autoComplete="tel"
                    value={s2Phone} onChange={(e) => setS2Phone(formatPhone(e.target.value))}
                  />
                  <label className="float-label" htmlFor="s2Phone">휴대폰 번호 (선택)</label>
                </div>

                <div className="step-nav">
                  <button className="btn-back" onClick={() => goStep(1, true)}>← 이전</button>
                  <button className="btn-next" onClick={() => goStep(3)}>
                    <span>다음 단계 →</span>
                  </button>
                </div>
              </div>

              {/* STEP 3 */}
              <div className={`step-slide${currentStep === 3 && !success ? ' active' : ''}${reverse ? ' reverse' : ''}`} id="step3">
                <div className="step-title">복지 조건을 설정해요 🎯</div>
                <p className="step-sub">AI가 맞춤 분석에 활용해요. 나중에 언제든 변경할 수 있어요.</p>

                <div className="chip-label">💰 소득 수준 (중위소득 기준)</div>
                <div className="chip-group" id="incomeChips">
                  {['50% 이하','50~80%','80~100%','100~150%','150% 초과'].map(v => (
                    <div key={v} className={`chip${selectedIncome === v ? ' selected' : ''}`} onClick={() => setSelectedIncome(v)}>{v}</div>
                  ))}
                </div>

                <div className="chip-label">🏠 가구 형태</div>
                <div className="chip-group" id="householdChips">
                  {['1인 가구','2인 가구','3인 가구','4인 이상','한부모 가구','다자녀 가구'].map(v => (
                    <div key={v} className={`chip${selectedHousehold === v ? ' selected' : ''}`} onClick={() => setSelectedHousehold(v)}>{v}</div>
                  ))}
                </div>

                <div className="chip-label">👔 취업 상태</div>
                <div className="chip-group" id="empChips">
                  {['미취업','정규직','비정규직','자영업','구직자','학생'].map(v => (
                    <div key={v} className={`chip${selectedEmp === v ? ' selected' : ''}`} onClick={() => setSelectedEmp(v)}>{v}</div>
                  ))}
                </div>

                <div className="chip-label">💡 관심 복지 분야 (복수 선택)</div>
                <div className="chip-group" id="intentChips">
                  {intentList.map(({label, val}) => (
                    <div key={val}
                      className={`chip${selectedIntents.includes(val) ? ' selected' : ''}`}
                      onClick={() => setSelectedIntents(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])}
                    >{label}</div>
                  ))}
                </div>

                <div className="step-nav">
                  <button className="btn-back" onClick={() => goStep(2, true)}>← 이전</button>
                  <button className={`btn-next${submitLoading ? ' loading' : ''}`} id="submitBtn" onClick={handleSubmit} disabled={submitLoading}>
                    <div className="spinner"></div>
                    <span>🚀 회원가입 완료하기</span>
                  </button>
                </div>
              </div>

              {/* SUCCESS */}
              <div className={`step-slide${success ? ' active' : ''}`} id="stepSuccess">
                <div className="success-screen">
                  <div className="success-icon">🎉</div>
                  <h2>가입 완료!</h2>
                  <p>베네픽에 오신 것을 환영합니다.<br />AI가 회원님께 맞는 복지 혜택을 분석할게요.</p>
                  <div style={{marginTop:'28px'}}>
                    <button className="btn-next" style={{maxWidth:'260px',margin:'0 auto'}} onClick={() => router.push('/')}>
                      <span>📊 대시보드 시작하기 →</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {!success && (
              <div className="auth-bottom" id="authBottomLink">
                이미 계정이 있으신가요? <Link href="/login">로그인</Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
