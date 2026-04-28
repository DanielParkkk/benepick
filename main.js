const TAB_PAGE_MAP = {
  'dashboard':       'index.html',
  'search':          'search.html',
  'detail':          'analysis.html',
  'portfolio':       'portfolio.html',
  'apply':           'apply.html',
  'community':       'community.html',
  'profile':         'profile.html',
  'recently-viewed': 'recently-viewed.html',
  'scrap':           'scrap.html',
};

function showTab(tab) {
  const page = TAB_PAGE_MAP[tab];
  if (page) {
    window.location.href = page;
    return;
  }
}

// ══════════════════════════════════════════════════════════════
// 베네픽 API 클라이언트 v2.1
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// 베네픽 v2.3 — Claude AI 직접 연동 (백엔드 불필요)
// ══════════════════════════════════════════════════════════════

// 현재 분석 세션
let _currentQueryId = null;

// _currentPortfolio: localStorage 영속화 (페이지 이동 후에도 유지)
function _savePortfolio(data) {
  try { localStorage.setItem('benefic_portfolio', JSON.stringify(data)); } catch(e) {}
}
function _scoreToCSS(score) {
  if (score >= 80) return { card_class:'top', percent_class:'high', progress_color:'green', badge_class:'badge-green', badge_label:'✅ 조건 충족' };
  if (score >= 60) return { card_class:'mid', percent_class:'mid', progress_color:'blue', badge_class:'badge-blue', badge_label:'⚡ 확인 필요' };
  return { card_class:'low', percent_class:'low', progress_color:'orange', badge_class:'badge-orange', badge_label:'⚠️ 조건 부족' };
}

const SCORE_BADGE_LABELS = {
  ko: { high:'✅ 조건 충족', mid:'⚡ 확인 필요', low:'⚠️ 조건 부족' },
  en: { high:'✅ Likely Eligible', mid:'⚡ Check Needed', low:'⚠️ May Not Qualify' },
  zh: { high:'✅ 条件符合', mid:'⚡ 需要确认', low:'⚠️ 条件不足' },
  ja: { high:'✅ 条件を満たす', mid:'⚡ 確認が必要', low:'⚠️ 条件不足' },
  vi: { high:'✅ Đủ điều kiện', mid:'⚡ Cần kiểm tra', low:'⚠️ Chưa đủ điều kiện' },
};

function _scoreToCSSForCurrentLang(score) {
  const css = { ..._scoreToCSS(score) };
  const tier = score >= 80 ? 'high' : (score >= 60 ? 'mid' : 'low');
  const labels = SCORE_BADGE_LABELS[_currentLangCode()] || SCORE_BADGE_LABELS.ko;
  css.badge_label = labels[tier];
  return css;
}
function _loadPortfolio() {
  try {
    const s = localStorage.getItem('benefic_portfolio');
    if (!s) return [];
    const arr = JSON.parse(s);
    // _css 누락 시 재계산
    return arr.map(card => {
      if (!card._css) card._css = _scoreToCSS(card.수급확률 || card.eligibility_percent || 60);
      return card;
    });
  } catch(e) { return []; }
}
let _currentPortfolio = _loadPortfolio();  // 분석 결과 캐시 (페이지 간 공유)

const SUPPORTED_UI_LANGS = new Set(['ko', 'en', 'zh', 'ja', 'vi']);

function _currentLangCode() {
  let lang = 'ko';
  try {
    lang = (typeof loadLang === 'function')
      ? loadLang()
      : (localStorage.getItem('benefic_lang') || 'ko');
  } catch(e) {}
  const displayToCode = {
    '한국어': 'ko',
    'English': 'en',
    '中文': 'zh',
    '日本語': 'ja',
    'Tiếng Việt': 'vi',
    fil: 'vi',
  };
  lang = displayToCode[lang] || String(lang || 'ko').toLowerCase();
  if (lang === 'fil') lang = 'vi';
  return SUPPORTED_UI_LANGS.has(lang) ? lang : 'ko';
}

const DETAIL_I18N = {
  ko: {
    expected_issues: '❌ 탈락 예상 이유',
    no_issue_title: '탈락 사유 없음',
    no_issue_desc: '조건 충족',
    guide_label: '💡 해결 방법 & 행동 가이드',
    count_suffix: '건',
    support_target: '📌 지원 대상',
    support_content: '💰 지원 내용',
    application_method: '📋 신청 방법',
    no_source: '원문 데이터가 없습니다. 공식 페이지에서 확인하세요.',
    official_page: '공식 페이지 →',
    reason_prefix: '확인 필요',
    processing_default: '공식 공고 확인',
    benefit_unknown: '공식 공고 확인',
    loading_policy: '정책 상세 불러오는 중',
  },
  en: {
    expected_issues: '❌ Possible Issues',
    no_issue_title: 'No blocking issue',
    no_issue_desc: 'You appear to meet the conditions',
    guide_label: '💡 Next Steps',
    count_suffix: '',
    support_target: '📌 Eligibility',
    support_content: '💰 Benefit',
    application_method: '📋 How to Apply',
    no_source: 'No source excerpt is available. Please check the official page.',
    official_page: 'Official page →',
    reason_prefix: 'Needs check',
    processing_default: 'Check notice',
    benefit_unknown: 'Check notice',
    loading_policy: 'Loading policy details',
  },
  zh: {
    expected_issues: '❌ 可能不符合的原因',
    no_issue_title: '暂无不符合原因',
    no_issue_desc: '条件看起来符合',
    guide_label: '💡 解决方法与行动指南',
    count_suffix: '项',
    support_target: '📌 支持对象',
    support_content: '💰 支持内容',
    application_method: '📋 申请方法',
    no_source: '没有可显示的原文摘录。请确认官方网站。',
    official_page: '官方网站 →',
    reason_prefix: '需要确认',
    processing_default: '请确认公告',
    benefit_unknown: '请确认公告',
    loading_policy: '正在加载政策详情',
  },
  ja: {
    expected_issues: '❌ 不採用となる可能性のある理由',
    no_issue_title: '該当する問題はありません',
    no_issue_desc: '条件を満たしている可能性があります',
    guide_label: '💡 解決方法と行動ガイド',
    count_suffix: '件',
    support_target: '📌 支援対象',
    support_content: '💰 支援内容',
    application_method: '📋 申請方法',
    no_source: '表示できる原文抜粋がありません。公式ページを確認してください。',
    official_page: '公式ページ →',
    reason_prefix: '確認が必要',
    processing_default: '公示を確認',
    benefit_unknown: '公示を確認',
    loading_policy: '政策詳細を読み込み中',
  },
  vi: {
    expected_issues: '❌ Lý do có thể bị từ chối',
    no_issue_title: 'Không có lý do bị loại',
    no_issue_desc: 'Có vẻ đáp ứng điều kiện',
    guide_label: '💡 Cách xử lý và hướng dẫn hành động',
    count_suffix: 'mục',
    support_target: '📌 Đối tượng hỗ trợ',
    support_content: '💰 Nội dung hỗ trợ',
    application_method: '📋 Cách đăng ký',
    no_source: 'Không có trích đoạn dữ liệu. Vui lòng kiểm tra trang chính thức.',
    official_page: 'Trang chính thức →',
    reason_prefix: 'Cần kiểm tra',
    processing_default: 'Kiểm tra thông báo',
    benefit_unknown: 'Kiểm tra thông báo',
    loading_policy: 'Đang tải chi tiết chính sách',
  },
};

function _detailT(key) {
  const lang = _currentLangCode();
  return (DETAIL_I18N[lang] && DETAIL_I18N[lang][key]) || DETAIL_I18N.ko[key] || key;
}

function _shortText(value, max = 120) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.substring(0, max)}…` : text;
}

// ── 한국 공공복지 정책 데이터베이스 (내장) ──────────────────
const POLICY_DB = [
  { 서비스명:'청년 월세 한시 특별지원', 서비스분야:'주거', 지원유형:'현금', 소관기관명:'국토교통부', 지원대상:'만 19~34세 무주택 청년, 부모와 별도 거주, 월세 60만원 이하', 선정기준:'중위소득 60% 이하, 원가구 중위소득 100% 이하', 신청방법:'복지로 또는 주민센터', 신청기한:'연중 상시', 전화문의:'1600-0777', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'월 최대 20만원, 최대 12개월 지원' },
  { 서비스명:'국민내일배움카드', 서비스분야:'고용', 지원유형:'이용권', 소관기관명:'고용노동부', 지원대상:'실업자, 이직 예정자, 비정규직, 단기근로자, 자영업자', 선정기준:'재직자 중 일부 제외, 고소득 재직자 제외', 신청방법:'고용24(work24.go.kr) 온라인 신청', 신청기한:'연중 상시', 전화문의:'1350', 상세조회url:'https://www.work24.go.kr', 지원내용:'훈련비 최대 500만원, 자부담 15~55%' },
  { 서비스명:'청년도약계좌', 서비스분야:'금융', 지원유형:'현금', 소관기관명:'금융위원회', 지원대상:'만 19~34세, 개인소득 6,000만원 이하, 가구소득 중위 180% 이하', 선정기준:'병역 이행기간 최대 6년 제외, 직전 3년 금융소득종합과세 제외', 신청방법:'은행 앱 또는 영업점', 신청기한:'연중 신청 가능(월별 모집)', 전화문의:'1332', 상세조회url:'https://www.fsc.go.kr', 지원내용:'월 최대 70만원 납입 시 정부기여금 최대 6%, 5년 만기 최대 5,000만원' },
  { 서비스명:'청년 마음건강 지원사업', 서비스분야:'보건', 지원유형:'이용권', 소관기관명:'보건복지부', 지원대상:'만 19~34세 청년, 소득 기준 없음', 선정기준:'심리상담 필요 청년, 정신건강 복지센터 대상자 우선', 신청방법:'정신건강복지센터 또는 지자체 문의', 신청기한:'연중 상시(예산 소진 시 마감)', 전화문의:'1577-0199', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'전문심리상담 연간 10회 이내 지원, 1회당 최대 8만원' },
  { 서비스명:'청년창업사관학교', 서비스분야:'창업', 지원유형:'현금', 소관기관명:'중소벤처기업부', 지원대상:'만 39세 이하 예비창업자 또는 창업 3년 이내', 선정기준:'창업 아이템 보유, 사업계획서 제출, 서류·면접 심사 통과', 신청방법:'K-Startup 홈페이지 온라인 접수', 신청기한:'연 1회 공고(보통 1~2월)', 전화문의:'1357', 상세조회url:'https://www.k-startup.go.kr', 지원내용:'창업지원금 최대 1억원, 사무공간·멘토링 제공' },
  { 서비스명:'기초생활보장 생계급여', 서비스분야:'기초생활', 지원유형:'현금', 소관기관명:'보건복지부', 지원대상:'소득인정액이 기준 중위소득 30% 이하 가구', 선정기준:'부양의무자 기준 완화 적용, 재산·소득 종합 심사', 신청방법:'주민센터 방문 신청, 복지로 온라인 신청', 신청기한:'연중 상시', 전화문의:'129', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'1인 가구 월 최대 713,102원(2024년 기준)' },
  { 서비스명:'기초생활보장 주거급여', 서비스분야:'주거', 지원유형:'현금', 소관기관명:'국토교통부', 지원대상:'소득인정액 기준 중위소득 48% 이하 가구', 선정기준:'임차가구: 기준임대료 내 실제 임차료 지급, 자가가구: 수선비 지원', 신청방법:'주민센터 방문 또는 복지로 신청', 신청기한:'연중 상시', 전화문의:'1600-0777', 상세조회url:'https://www.myhome.go.kr', 지원내용:'서울 1인 가구 월 최대 341,000원' },
  { 서비스명:'실업급여(구직급여)', 서비스분야:'고용', 지원유형:'현금', 소관기관명:'고용노동부', 지원대상:'이직 전 18개월 중 피보험 단위기간 180일 이상, 비자발적 이직자', 선정기준:'적극적 구직활동 의무, 재취업 활동 인정 기준 충족', 신청방법:'고용24 온라인 신청 후 고용센터 방문', 신청기한:'이직일 다음 날부터 12개월 이내', 전화문의:'1350', 상세조회url:'https://www.work24.go.kr', 지원내용:'퇴직 전 평균임금 60%, 최소 1일 63,104원~최대 66,000원' },
  { 서비스명:'아동수당', 서비스분야:'가족', 지원유형:'현금', 소관기관명:'보건복지부', 지원대상:'만 8세 미만(0~95개월) 아동', 선정기준:'소득·재산 기준 없이 연령 조건만 충족하면 지급', 신청방법:'복지로, 정부24, 주민센터', 신청기한:'출생일로부터 60일 이내 신청 시 소급 지급', 전화문의:'129', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'월 10만원 지급' },
  { 서비스명:'한부모가족 아동양육비', 서비스분야:'가족', 지원유형:'현금', 소관기관명:'여성가족부', 지원대상:'소득 기준 중위소득 63% 이하 한부모가족, 만 18세 미만 자녀', 선정기준:'한부모 가구 인정, 소득·재산 심사', 신청방법:'주민센터 방문 신청', 신청기한:'연중 상시', 전화문의:'1577-2514', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'아동 1인당 월 21만원(2024년 기준)' },
  { 서비스명:'노인 기초연금', 서비스분야:'노인', 지원유형:'현금', 소관기관명:'보건복지부', 지원대상:'만 65세 이상, 소득하위 70% 이하 어르신', 선정기준:'단독가구 월 소득인정액 202만원 이하(2024년)', 신청방법:'주민센터, 국민연금공단, 복지로', 신청기한:'만 65세 생일 1개월 전부터 신청 가능', 전화문의:'1355', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'단독가구 최대 월 334,810원(2024년)' },
  { 서비스명:'장애인 활동지원서비스', 서비스분야:'장애인', 지원유형:'서비스', 소관기관명:'보건복지부', 지원대상:'만 6세~만 65세 미만 장애인, 장애등급 1~3급', 선정기준:'활동지원 인정조사 점수 42점 이상', 신청방법:'주민센터 방문 신청', 신청기한:'연중 상시', 전화문의:'129', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'활동지원급여 월 최대 1,869천원(구간별 차등)' },
  { 서비스명:'청년내일저축계좌', 서비스분야:'금융', 지원유형:'현금', 소관기관명:'보건복지부', 지원대상:'만 19~34세 수급자·차상위 청년, 소득 기준 중위소득 100% 이하 근로·사업소득자', 선정기준:'기준 중위소득 50% 이하 가구 우선, 근로·사업소득 월 10만원 이상', 신청방법:'복지로 온라인 또는 주민센터', 신청기한:'연 1회 공고(보통 5~6월)', 전화문의:'129', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'본인 적립 월 10만원 시 정부 지원금 월 10~30만원 매칭, 3년 만기' },
  { 서비스명:'국가장학금(한국장학재단)', 서비스분야:'교육', 지원유형:'현금', 소관기관명:'교육부', 지원대상:'국내 대학 재학생, 소득 기준 충족자', 선정기준:'소득분위 1~8구간, 성적 기준(C학점 이상), 국내 대학 재학', 신청방법:'한국장학재단 홈페이지(www.kosaf.go.kr)', 신청기한:'학기별 신청(2월/8월)', 전화문의:'1599-2000', 상세조회url:'https://www.kosaf.go.kr', 지원내용:'소득 1~3구간 전액, 4구간 390만원, 8구간 67.5만원(학기당)' },
  { 서비스명:'자활근로사업', 서비스분야:'고용', 지원유형:'서비스', 소관기관명:'보건복지부', 지원대상:'기초생활수급자 및 차상위계층 중 근로능력자', 선정기준:'자활센터 상담 후 자활 참여 의사 있는 자', 신청방법:'지역자활센터 또는 주민센터', 신청기한:'연중 상시', 전화문의:'129', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'근로 유형별 급여(시장형: 최저임금 100%, 근로유지형: 최저임금 80%)' },
  { 서비스명:'긴급복지지원', 서비스분야:'기초생활', 지원유형:'현금', 소관기관명:'보건복지부', 지원대상:'위기상황 발생으로 생계유지 곤란한 가구', 선정기준:'갑작스러운 실직·질병·사고 등 위기사유, 소득·재산 기준', 신청방법:'주민센터 또는 복지부 상담 전화', 신청기한:'위기사유 발생 즉시', 전화문의:'129', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'생계지원 1인 가구 월 683,400원, 의료·주거·교육지원 등 연계' },
  { 서비스명:'다문화가족 방문교육서비스', 서비스분야:'가족', 지원유형:'서비스', 소관기관명:'여성가족부', 지원대상:'결혼이민자 및 귀화자로 구성된 다문화가족', 선정기준:'입국 5년 이하 우선 지원, 한국어 교육 미이수자', 신청방법:'다문화가족지원센터 신청', 신청기한:'연중 상시', 전화문의:'1577-1366', 상세조회url:'https://www.mogef.go.kr', 지원내용:'한국어교육·부모교육·자녀생활지원 등 가정방문 교육 서비스 제공' },
  { 서비스명:'노인 일자리 및 사회활동 지원사업', 서비스분야:'노인', 지원유형:'현금', 소관기관명:'보건복지부', 지원대상:'만 65세 이상(일부 사업 60세 이상), 기초연금 수급자 우선', 선정기준:'공익형·사회서비스형·시장형 등 유형별 별도 기준', 신청방법:'주민센터, 노인복지관, 시니어클럽', 신청기한:'연초 공고(1~2월 주로 접수)', 전화문의:'1577-1389', 상세조회url:'https://www.bokjiro.go.kr', 지원내용:'공익형 월 27만원, 사회서비스형 월 78.2만원(2024년 기준)' },
  { 서비스명:'청년 취업성공패키지', 서비스분야:'고용', 지원유형:'서비스', 소관기관명:'고용노동부', 지원대상:'만 18~34세 미취업 청년(Ⅰ유형: 중위소득 60% 이하, Ⅱ유형: 소득 무관)', 선정기준:'고용센터 상담 후 참여 결정, 취업 의지 확인', 신청방법:'고용24(work24.go.kr) 또는 고용센터 방문', 신청기한:'연중 상시', 전화문의:'1350', 상세조회url:'https://www.work24.go.kr', 지원내용:'진단·경력설계 수당 25만원, 훈련수당 월 최대 28.4만원, 취업 장려금 최대 150만원' },
  { 서비스명:'에너지바우처', 서비스분야:'기초생활', 지원유형:'이용권', 소관기관명:'산업통상자원부', 지원대상:'기초생활수급자 중 노인·영유아·장애인·임산부·중증질환자 포함 가구', 선정기준:'에너지 취약계층 요건 충족, 소득 기준 충족', 신청방법:'주민센터 방문 신청', 신청기한:'매년 5~6월 신청', 전화문의:'1600-3190', 상세조회url:'https://www.energyv.or.kr', 지원내용:'1인 가구 연간 최대 95,000원, 가구원수 및 계절에 따라 차등' },
];

// ── 검색 상태 ────────────────────────────────────────────────
const _searchCache = {};

// ── Claude AI 직접 호출 ──────────────────────────────────────
async function callClaudeSearch(userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  if (!res.ok) throw new Error(`Claude API 오류: ${res.status}`);
  const data = await res.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    return JSON.parse(clean);
  } catch(e) {
    return { raw: text };
  }
}

// ── 내장 DB 검색 (키워드 기반) ──────────────────────────────
function localKeywordSearch(keyword, category, supportType, limit = 20) {
  const kw = (keyword || '').toLowerCase();
  return POLICY_DB.filter(p => {
    const matchKw = !kw ||
      (p.서비스명||'').toLowerCase().includes(kw) ||
      (p.지원내용||'').toLowerCase().includes(kw) ||
      (p.지원대상||'').toLowerCase().includes(kw) ||
      (p.서비스분야||'').toLowerCase().includes(kw) ||
      (p.소관기관명||'').toLowerCase().includes(kw);
    const matchCat  = !category    || (p.서비스분야||'').includes(category);
    const matchType = !supportType || (p.지원유형||'').includes(supportType);
    return matchKw && matchCat && matchType;
  }).slice(0, limit);
}

// ── AI 자연어 검색 (Claude 활용) ────────────────────────────
async function localNaturalSearch(query, topK = 15) {
  const cacheKey = query + topK;
  if (_searchCache[cacheKey]) return _searchCache[cacheKey];

  const dbSummary = POLICY_DB.map((p,i) =>
    `[${i}] ${p.서비스명} / ${p.서비스분야} / ${p.지원유형} / 대상: ${(p.지원대상||'').substring(0,60)}`
  ).join('\n');

  const prompt = `당신은 한국 복지 정책 검색 전문가입니다.
다음은 복지 정책 데이터베이스입니다:
${dbSummary}

사용자 검색어: "${query}"

위 정책 중 사용자 검색어와 가장 관련 있는 정책의 인덱스 번호를 최대 ${topK}개 골라서,
관련도 높은 순으로 JSON 배열로만 응답하세요. 예: [2, 7, 0, 14]
다른 설명 없이 JSON 배열만 출력하세요.`;

  try {
    const result = await callClaudeSearch(prompt);
    let indices = Array.isArray(result) ? result : (result.raw ? JSON.parse(result.raw) : []);
    const results = indices
      .filter(i => i >= 0 && i < POLICY_DB.length)
      .map(i => ({ ...POLICY_DB[i], score: 1 - (indices.indexOf(i) * 0.05) }));
    _searchCache[cacheKey] = results;
    return results;
  } catch(e) {
    // AI 실패 시 키워드 검색으로 폴백
    return localKeywordSearch(query, '', '', topK);
  }
}

// ── /analyze 대체: 로컬 조건 기반 분석 ─────────────────────
async function localAnalyze(payload) {
  const cacheKey = `local-analysis-v7:${_currentLangCode()}:${JSON.stringify(payload || {})}`;
  if (_searchCache[cacheKey]) return _searchCache[cacheKey];
  _searchCache[cacheKey] = _fallbackAnalysisData(payload || {});
  return _searchCache[cacheKey];
}

// ── 카테고리 목록 반환 ────────────────────────────────────────
function getLocalCategories() {
  const cats = [...new Set(POLICY_DB.map(p => p.서비스분야).filter(Boolean))].sort();
  return { categories: cats };
}

// ── benepick-main FastAPI 호환 어댑터 ─────────────────────────
function _toApiIncomeBand(percent) {
  const value = Number(percent) || 55;
  if (value <= 60) return 'MID_50_60';
  if (value <= 80) return 'MID_60_80';
  return 'MID_80_100';
}

function _toApiHouseholdType(value) {
  const text = String(value || '');
  if (text.includes('1인') || text.includes('단독')) return 'SINGLE';
  if (text.includes('2인') || text.includes('한부모') || text.includes('조손')) return 'TWO_PERSON';
  return 'MULTI_PERSON';
}

function _toApiEmploymentStatus(value) {
  const text = String(value || '');
  if (text.includes('자영')) return 'SELF_EMPLOYED';
  if (text.includes('취업') || text.includes('직') || text.includes('육아휴직')) return 'EMPLOYED';
  return 'UNEMPLOYED';
}

function _toApiAnalyzePayload(body = {}) {
  const region = body.region || body.region_name || body.거주지역 || '서울특별시';
  return {
    age: Number(body.age) || 27,
    region_code: region,
    region_name: region,
    income_band: _toApiIncomeBand(body.income_percent),
    household_type: _toApiHouseholdType(body.household_type || body.family_type || body.가구유형),
    employment_status: _toApiEmploymentStatus(body.employment_status || body.employment || body.고용상태),
    housing_status: 'MONTHLY_RENT',
    interest_tags: body.interest_tags || body.intent_tags || [],
  };
}

function _slugPolicyName(name) {
  return String(name || '')
    .replace(/[^\w가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function _inferPolicyIcon(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('월세') || value.includes('주거') || value.includes('rent') || value.includes('housing') || value.includes('住') || value.includes('家賃') || value.includes('nhà ở')) return '🏠';
  if (value.includes('취업') || value.includes('일자리') || value.includes('고용') || value.includes('job') || value.includes('employment') || value.includes('就业') || value.includes('就職') || value.includes('việc làm')) return '💼';
  if (value.includes('장학') || value.includes('교육') || value.includes('훈련') || value.includes('education') || value.includes('training') || value.includes('教育') || value.includes('đào tạo')) return '🎓';
  if (value.includes('의료') || value.includes('건강') || value.includes('마음') || value.includes('health') || value.includes('medical') || value.includes('健康') || value.includes('sức khỏe')) return '🏥';
  if (value.includes('금융') || value.includes('계좌') || value.includes('저축') || value.includes('finance') || value.includes('account') || value.includes('金融') || value.includes('tài chính')) return '🏦';
  if (value.includes('창업') || value.includes('startup') || value.includes('创业') || value.includes('起業') || value.includes('khởi nghiệp')) return '🚀';
  return '📋';
}

function _apiPolicyToUiCard(item, index = 1) {
  const title = item.title || item.서비스명 || item.policy_name || '복지 정책';
  const score = Math.max(1, Math.min(99, Number(item.match_score ?? item.수급확률 ?? 70)));
  const benefitLabel = item.benefit_amount_label || item.benefit_summary ||
    (item.benefit_amount ? `${Number(item.benefit_amount).toLocaleString()}원` : '공식 공고 확인');
  const description = item.description || item.benefit_summary || '';
  const css = _scoreToCSS(score);
  return {
    policy_id: item.policy_id || _slugPolicyName(title) || `policy-${index}`,
    서비스명: title,
    서비스분야: (item.badge_items && item.badge_items[0]) || '',
    지원유형: item.benefit_amount ? '현금' : '서비스',
    소관기관명: (item.badge_items && item.badge_items[0]) || 'BenePick',
    지원대상: description,
    선정기준: description,
    신청방법: '상세 페이지에서 공식 안내를 확인하세요.',
    신청기한: '공식 공고 확인',
    전화문의: '',
    상세조회url: '',
    지원내용: benefitLabel,
    score: score / 100,
    icon: _inferPolicyIcon(`${title} ${description}`),
    subtitle: description || '조건 확인 후 신청 가능',
    benefit_label: benefitLabel,
    source_label: (item.badge_items && item.badge_items[0]) || 'BenePick',
    수급확률: score,
    탈락사유: [],
    해결방법: [
      { icon: '✅', html: '<strong>1단계:</strong> 자격 조건을 확인하세요.' },
      { icon: '📎', html: '<strong>2단계:</strong> 필요 서류를 준비하세요.' },
      { icon: '🚀', html: '<strong>3단계:</strong> 공식 신청처에서 신청하세요.' },
    ],
    우선순위: item.sort_order || index,
    _css: css,
  };
}

function _localBrowseResponse(path) {
  const params = new URLSearchParams(path.split('?')[1] || '');
  const page = Math.max(1, parseInt(params.get('page') || '1'));
  const perPage = Math.max(1, parseInt(params.get('per_page') || '20'));
  const total = POLICY_DB.length;
  return {
    results: POLICY_DB.slice((page - 1) * perPage, page * perPage),
    total,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

function _backendPathFor(path) {
  if (path === '/analyze') return '/api/v1/eligibility/analyze';

  if (path.startsWith('/search/keyword')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const q = params.get('keyword') || params.get('q') || '복지';
    const size = params.get('limit') || '20';
    return '/api/v1/policies/search?' + new URLSearchParams({ q, size, lang: _currentLangCode() }).toString();
  }

  if (path.startsWith('/search/natural')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const q = params.get('q') || '복지';
    const size = params.get('top_k') || '20';
    return '/api/v1/policies/search?' + new URLSearchParams({ q, size, lang: _currentLangCode() }).toString();
  }

  if (path.startsWith('/portfolio')) return '/api/v1/portfolio';
  return path;
}

function _normalizeBackendResponse(path, json) {
  const data = json && json.data ? json.data : json;

  if (path === '/analyze') {
    const cards = (data.policies || []).map(_apiPolicyToUiCard);
    const average = cards.length
      ? Math.round(cards.reduce((sum, card) => sum + (card.수급확률 || 0), 0) / cards.length)
      : 0;
    return {
      query_id: Date.now().toString(),
      cards,
      dashboard_data: {
        recommendation_cards: cards,
        stats: {
          해당정책수: cards.length,
          평균확률: average,
          예상수혜액: cards[0]?.benefit_label || '-',
          즉시신청가능: cards.filter(card => (card.수급확률 || 0) >= 80).length,
        },
        summary: data.rag_answer || 'AI 분석 결과를 기반으로 맞춤 정책을 추천했습니다.',
      },
    };
  }

  if (path.startsWith('/search/keyword')) {
    const results = (data.items || []).map(_apiPolicyToUiCard);
    return { results, count: data.total_count || results.length };
  }

  if (path.startsWith('/search/natural')) {
    return { results: (data.items || []).map(_apiPolicyToUiCard) };
  }

  if (path.startsWith('/portfolio')) {
    return data;
  }

  return json;
}

function _detailColorFromScore(detail, pct) {
  const level = String(detail?.score_level || '').toUpperCase();
  if (level === 'HIGH') return 'green';
  if (level === 'LOW') return 'orange';
  return pct >= 80 ? 'green' : pct >= 60 ? 'blue' : 'orange';
}

function _apiDetailToUiDetail(payload) {
  const detail = payload && payload.data ? payload.data : (payload || {});
  const source = detail.source_excerpt || {};
  const reasons = Array.isArray(detail.blocking_reasons)
    ? detail.blocking_reasons.filter(Boolean)
    : [];
  const actions = Array.isArray(detail.recommended_actions)
    ? detail.recommended_actions.filter(Boolean)
    : [];
  const pct = Math.max(1, Math.min(99, Math.round(Number(detail.match_score ?? 60))));
  const color = _detailColorFromScore(detail, pct);
  const benefitText = source.support_content_text || detail.description || '';

  return {
    policy_id: detail.policy_id,
    policy_header: {
      policy_name: detail.title || '복지 정책',
      eligibility_percent: pct,
      progress_color: color,
      icon: _inferPolicyIcon(`${detail.title || ''} ${detail.description || ''} ${source.support_content_text || ''}`),
      subtitle: detail.description || '',
    },
    personal_summary: detail.eligibility_summary || detail.description || '',
    source_excerpt: source,
    issues: reasons.map(reason => ({
      icon: '⚠️',
      html: `<strong>${escHtml(_detailT('reason_prefix'))}:</strong> ${escHtml(reason)}`,
    })),
    guides: actions.map((action, index) => ({
      icon: index === 0 ? '✅' : index === 1 ? '📎' : '🚀',
      html: `<strong>${index + 1}. </strong>${escHtml(action)}`,
    })),
    summary_stats: {
      benefit_label: _shortText(benefitText || _detailT('benefit_unknown'), 18),
      processing_period_label: _detailT('processing_default'),
      issue_count: reasons.length,
      source_label: detail.managing_agency || 'BenePick',
    },
  };
}

async function _fetchBackendDetail(policyId) {
  const qs = new URLSearchParams({ lang: _currentLangCode() }).toString();
  const res = await fetch(`${API_BASE}/api/v1/policies/${encodeURIComponent(policyId)}/detail?${qs}`, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || `상세 조회 오류 ${res.status}`);
  }
  const uiDetail = _apiDetailToUiDetail(await res.json());
  return _localizeDetailData(uiDetail, policyId);
}

// ── API 베이스 설정 ───────────────────────────────────────────
const API_BASE = 'http://localhost:8000';
let _useBackend = null;

async function _checkBackend() {
  if (_useBackend !== null) return _useBackend;
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) });
    _useBackend = r.ok;
  } catch { _useBackend = false; }
  return _useBackend;
}

// ── apiFetch: FastAPI 우선 → 폴백(내장 로직) ─────────────────
async function apiFetch(path, options = {}) {
  const body = options.body ? JSON.parse(options.body) : null;

  if (path === '/analyze') {
    return localAnalyze(body);
  }

  if (path === '/categories' || path === '/search/categories') {
    return getLocalCategories();
  }
  if (path.startsWith('/browse')) {
    return _localBrowseResponse(path);
  }

  const useBackend = await _checkBackend();

  if (useBackend) {
    const backendPath = _backendPathFor(path);
    const requestBody = path === '/analyze' ? JSON.stringify(_toApiAnalyzePayload(body)) : options.body;
    const res = await fetch(API_BASE + backendPath, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...(requestBody ? { body: requestBody } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || `서버 오류 ${res.status}`);
    }
    return _normalizeBackendResponse(path, await res.json());
  }

  // ── 폴백: 내장 로직 ──
  if (path === '/categories' || path === '/search/categories') {
    return getLocalCategories();
  }
  if (path.startsWith('/search/keyword')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const results = localKeywordSearch(
      params.get('keyword') || '', params.get('category') || '',
      params.get('support_type') || '', parseInt(params.get('limit') || '20')
    );
    return { results, count: results.length };
  }
  if (path.startsWith('/search/natural')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const results = await localNaturalSearch(params.get('q') || '', parseInt(params.get('top_k') || '15'));
    return { results };
  }
  if (path.startsWith('/portfolio')) {
    return { items: _currentPortfolio };
  }
  throw new Error(`지원하지 않는 경로: ${path}`);
}

// ══════════════════════════════════════════════════════════════
// 스크랩 기능 (localStorage 기반)
// ══════════════════════════════════════════════════════════════

const SCRAP_KEY = 'benefic_scraps';

function _getScraps() {
  try {
    return JSON.parse(localStorage.getItem(SCRAP_KEY) || '[]');
  } catch(e) { return []; }
}

function _isScrapped(policyId) {
  return _getScraps().includes(policyId);
}

function _showScrapToast(msg) {
  // 기존 토스트가 있으면 제거
  document.querySelectorAll('.scrap-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'scrap-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  });
}

function toggleScrap(policyId, btnEl) {
  // 로그인 체크
  const token = localStorage.getItem('token');
  if (!token) {
    _showScrapToast('🔑 로그인 후 스크랩할 수 있어요');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }

  const scraps = _getScraps();
  const idx = scraps.indexOf(policyId);
  const willScrap = idx === -1;

  if (willScrap) {
    scraps.push(policyId);
    btnEl.classList.add('active');
    btnEl.textContent = '★';
    btnEl.title = '스크랩 해제';
    btnEl.setAttribute('aria-label', '스크랩 해제');
    _showScrapToast('⭐ 스크랩에 저장됐어요');
  } else {
    scraps.splice(idx, 1);
    btnEl.classList.remove('active');
    btnEl.textContent = '☆';
    btnEl.title = '스크랩 저장';
    btnEl.setAttribute('aria-label', '스크랩 저장');
    _showScrapToast('스크랩이 해제됐어요');
  }

  // 팝 애니메이션
  btnEl.classList.remove('pop');
  void btnEl.offsetWidth; // reflow 강제
  btnEl.classList.add('pop');
  btnEl.addEventListener('animationend', () => btnEl.classList.remove('pop'), { once: true });

  try {
    localStorage.setItem(SCRAP_KEY, JSON.stringify(scraps));
  } catch(e) {
    console.warn('스크랩 저장 실패:', e);
  }
}

// ── handleScrapToggle: 프롬프트 명세 호환 alias ────────────────
// event.stopPropagation 포함, 비로그인 체크, UI 즉시 반영, localStorage 동기화
function handleScrapToggle(event, policyId) {
  event.stopPropagation();
  toggleScrap(policyId, event.currentTarget);
}

// ── 에러 토스트 ───────────────────────────────────────────────
function showToast(msg, type = 'error') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${type === 'error' ? '#E74C3C' : '#2ECC71'};
    color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;
    font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Intent 태그 토글 (최대 2개) ──────────────────────────────
function toggleIntent(el) {
  const tags = document.querySelectorAll('.intent-tag');
  const activeTags = document.querySelectorAll('.intent-tag.active');

  if (el.classList.contains('active')) {
    el.classList.remove('active');
    // 2개 제한 해제 시 disabled 해제
    tags.forEach(t => t.classList.remove('disabled'));
  } else {
    if (activeTags.length >= 2) return; // 이미 2개 선택됨
    el.classList.add('active');
    // 2개 꽉 찼으면 나머지 비활성화 (시각적 피드백)
    if (activeTags.length + 1 >= 2) {
      tags.forEach(t => { if (!t.classList.contains('active')) t.classList.add('disabled'); });
    }
  }
}

// ── 선택된 Intent 태그 수집 ────────────────────────────────
function getSelectedIntents() {
  return Array.from(document.querySelectorAll('.intent-tag.active'))
    .map(el => el.dataset.intent)
    .filter(Boolean);
}

// ── 입력 폼에서 사용자 데이터 수집 ──────────────────────────
function collectFormData() {
  const ageVal        = document.getElementById('sel-age')?.value        || '만 27세';
  const regionVal     = document.getElementById('sel-region')?.value     || '서울특별시';
  const incomeVal     = document.getElementById('sel-income')?.value     || '중위소득 50~60%';
  const familyVal     = document.getElementById('sel-family')?.value     || '1인 가구';
  const empVal        = document.getElementById('sel-employment')?.value || '미취업';
  const disabilityVal = document.getElementById('sel-disability')?.value || '없음';

  // ── 나이 파싱: "만 27세" / "만 65세 이상" → 숫자
  const ageMatch = ageVal.match(/\d+/);
  const age = ageMatch ? parseInt(ageMatch[0]) : 27;

  // ── 소득 파싱 → income_percent
  let income_percent = 55;
  const rangeMatch  = incomeVal.match(/(\d+)[~\-](\d+)/);
  const singleMatch = incomeVal.match(/(\d+)%\s*(이하|초과)/);
  if (rangeMatch) {
    income_percent = Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
  } else if (singleMatch) {
    income_percent = singleMatch[2] === '이하'
      ? Math.round(parseInt(singleMatch[1]) * 0.7)
      : parseInt(singleMatch[1]) + 10;
  }

  // ── 가구원수 추정
  const sizeMap = {
    '1인 가구':1, '2인 가구':2, '3인 가구':3, '4인 이상 가구':4,
    '한부모 가구':2, '다자녀 가구':4, '다문화 가구':3,
    '조손 가구':2, '노인 단독 가구':1,
  };
  const household_size = sizeMap[familyVal] || 1;

  // ── 취업상태 → scoring.py 호환
  const empMap = {
    '미취업':                     '구직자 (실업)',
    '취업자 (정규직)':             '취업자 (정규직)',
    '취업자 (비정규직/계약직)':    '취업자 (비정규직/계약직)',
    '자영업자':                    '자영업자',
    '구직자 (실업)':               '구직자 (실업)',
    '학생':                        '학생',
    '육아휴직 중':                 '육아휴직 중',
    '무직':                        '무직',
  };

  // ── 다문화가구 여부 (가구유형에서 자동 판단)
  const multicultural = familyVal === '다문화 가구';

  // ── scoring.py 6개 항목과 완전 일치하는 payload
  return {
    user_name:         document.querySelector('.avatar-name')?.textContent?.replace('님','') || '사용자',
    age,                                          // → 나이
    region:            regionVal,                 // → 거주지역
    income_percent,                               // → 연소득 (중위소득 % 환산)
    household_type:    familyVal,                 // → 가구유형
    household_size,                               // → 가구원수
    employment_status: empMap[empVal] || empVal,  // → 고용상태
    disability:        disabilityVal,             // → 장애여부 ← 새로 추가
    veteran:           false,
    multicultural,
    education_level:   '대졸',
    language:          _currentLangCode(),
    intent_tags:       getSelectedIntents(),  // ← 관심 분야 태그
  };
}

// ── 대시보드 렌더링 ───────────────────────────────────────────
function renderDashboard(data) {
  // Claude API 응답 구조와 기존 구조 모두 호환
  const recommendation_cards = data.recommendation_cards || data.포트폴리오 || [];
  const stats = data.stats || data.대시보드통계 || {};
  const summary = data.summary || data.종합요약 || '';
  const probLabel = _t('prob_label') || '수급 확률';
  const detailBtn = _t('detail_btn') || '상세 분석 보기 →';
  const fallbackBadge = (SCORE_BADGE_LABELS[_currentLangCode()] || SCORE_BADGE_LABELS.ko).mid;

  // 사용자 프로필 업데이트 (폼 값 기반)
  const ageVal    = document.getElementById('sel-age')?.value    || '';
  const regionVal = document.getElementById('sel-region')?.value || '';
  const familyVal = document.getElementById('sel-family')?.value || '';
  const empVal    = document.getElementById('sel-employment')?.value || '';
  const incomeVal = document.getElementById('sel-income')?.value || '';

  const profileH2 = document.querySelector('.profile-info h2');
  if (profileH2) {
    const userName = getAuthUser()?.name || '사용자';
    profileH2.textContent = `${userName}의 복지 분석 결과`;
  }

  const profileP = document.querySelector('.profile-info p');
  const now = new Date(); const hm = `${now.getHours()}시 ${now.getMinutes()}분`;
  if (profileP) profileP.textContent = `마지막 업데이트: 오늘 ${hm} · ${regionVal}`;

  const tagsEl = document.querySelector('.profile-tags');
  if (tagsEl && ageVal) {
    tagsEl.innerHTML = [
      ageVal ? `📅 ${ageVal}` : '',
      regionVal ? `📍 ${regionVal}` : '',
      incomeVal ? `💰 ${incomeVal}` : '',
      familyVal ? `🏠 ${familyVal}` : '',
      empVal ? `👔 ${empVal}` : '',
    ].filter(Boolean).map(t => `<span class="profile-tag">${t}</span>`).join('');
  }

  // 통계 업데이트
  const statEl = (sel) => document.querySelector(sel);
  if (stats.해당정책수) {
    const valEls = document.querySelectorAll('.stat-item .val');
    if (valEls[0]) valEls[0].textContent = stats.해당정책수;
    if (valEls[1]) valEls[1].textContent = (stats.평균확률 || 0) + '%';
    if (valEls[2]) valEls[2].innerHTML = (stats.예상수혜액 || '-') + '<span style="font-size:14px">원</span>';
    if (valEls[3]) valEls[3].textContent = stats.즉시신청가능 || 0;
    const scoreNum = document.querySelector('.score-num');
    if (scoreNum) scoreNum.textContent = stats.평균확률 || 0;
  }

  // 정책 카드 목록
  const policyList = document.querySelector('.policy-list');
  if (policyList && recommendation_cards.length) {
    policyList.innerHTML = recommendation_cards.map(card => {
      const css      = card._css || {};
      const pct      = card.수급확률 || card.eligibility_percent || 0;
      const name     = card.서비스명 || card.policy_name || '';
      const subtitle = card.subtitle || '';
      const benefit  = card.benefit_label || '';
      const source   = card.source_label || 'Gov24';
      const icon     = card.icon || '📋';
      const pid      = card.policy_id || '';
      const barColor = css.progress_color || 'blue';
      const isScrapped = _isScrapped(pid);
      return `
        <div class="policy-card ${css.card_class || 'mid'}" onclick="showDetail('${escHtml(pid)}')">
          <button
            class="scrap-btn ${isScrapped ? 'active' : ''}"
            data-policy-id="${escHtml(pid)}"
            onclick="handleScrapToggle(event, '${escHtml(pid)}')"
            title="${isScrapped ? '스크랩 해제' : '스크랩 저장'}"
            aria-label="${isScrapped ? '스크랩 해제' : '스크랩 저장'}"
          >${isScrapped ? '★' : '☆'}</button>
          <div class="policy-top-row">
            <div class="policy-left" style="padding-right:44px">
              <div class="policy-icon ${css.icon_color || css.progress_color || 'blue'}">${icon}</div>
              <div class="policy-meta">
                <h4>${escHtml(name)}</h4>
                <p>${escHtml(subtitle)}</p>
                <div class="policy-badges">
                  <span class="badge ${css.badge_class || 'badge-blue'}">${escHtml(css.badge_label || fallbackBadge)}</span>
                  <span class="badge badge-blue">${escHtml(source)}</span>
                  <span class="badge badge-gray">${escHtml(benefit)}</span>
                </div>
              </div>
            </div>
            <div class="policy-percent">
              <div class="percent-num ${css.percent_class || 'mid'}">${pct}<span style="font-size:18px">%</span></div>
              <div class="percent-label">${escHtml(probLabel)}</div>
            </div>
          </div>
          <div class="progress-row">
            <div class="progress-track">
              <div class="progress-fill ${barColor}" style="width:${pct}%"></div>
            </div>
            <div class="benefit-chip">${escHtml(benefit)}</div>
          </div>
          <div class="policy-action">${escHtml(detailBtn)}</div>
        </div>`;
    }).join('');
  }

  // 포트폴리오 프리뷰 사이드바 업데이트 (있을 경우)
  const portTotal = document.querySelector('.portfolio-total .amount');
  if (portTotal && stats.예상수혜액) portTotal.textContent = stats.예상수혜액;

  // 종합요약이 있으면 표시
  if (summary) {
    const summaryEls = document.querySelectorAll('.insight-section-label, .cta-text p');
    summaryEls.forEach(el => { if (el && !el.closest('.inline-ad')) el.textContent = summary; });
  }
}

// ── 상세 분석 화면 렌더링 ─────────────────────────────────────
function renderDetail(detailData) {
  const { policy_header = {}, issues = [], guides = [], summary_stats = {} } = detailData || {};
  const pct   = policy_header.eligibility_percent || 60;
  const color = policy_header.progress_color || (pct >= 80 ? 'green' : pct >= 60 ? 'blue' : 'orange');

  // 정책명
  document.getElementById('detail-policy-name').textContent = policy_header.policy_name;

  // 아이콘
  const iconEl = document.querySelector('#screen-detail .detail-icon');
  if (iconEl && policy_header.icon) iconEl.textContent = policy_header.icon;

  // 수급 확률 숫자 + % 색상
  const pctEl = document.getElementById('detail-pct');
  if (pctEl) pctEl.textContent = pct;
  const pctSign = document.querySelector('#screen-detail .detail-prob span[style]');
  const pctColor = color === 'green' ? 'var(--green)' : color === 'blue' ? 'var(--blue)' : 'var(--orange)';
  if (pctSign) pctSign.style.color = pctColor;

  // 진행바
  const bar = document.getElementById('detail-bar');
  if (bar) {
    bar.className   = `progress-fill ${color}`;
    bar.style.width = pct + '%';
    // 애니메이션
    bar.style.width = '0';
    requestAnimationFrame(() => { setTimeout(() => { bar.style.width = pct + '%'; }, 60); });
  }

  // issue-item 렌더링
  const issueSection = document.getElementById('detail-issue-section');
  if (issueSection) {
    const noIssue = !issues || issues.length === 0 ||
      (issues.length === 1 && (issues[0].icon === '✅' ||
        (issues[0].html || '').includes('탈락 요인 없음') ||
        (issues[0].html || '').includes('분석 전')));
    issueSection.innerHTML = `
      <div class="analysis-label">${_detailT('expected_issues')}</div>
      ${noIssue
        ? `<div class="issue-item"><span class="icon">✅</span><p><strong>${_detailT('no_issue_title')}</strong> — ${_detailT('no_issue_desc')}</p></div>`
        : issues.map(iss => {
            const icon = iss.icon || '⚠️';
            const text = typeof iss.html === 'string' ? iss.html : (iss.html?.html || JSON.stringify(iss.html));
            return `<div class="issue-item"><span class="icon">${icon}</span><p>${text}</p></div>`;
          }).join('')
      }
    `;
  }

  // guide-item 렌더링
  const guideSection = document.getElementById('detail-guide-section');
  if (guideSection) {
    guideSection.innerHTML = `
      <div class="analysis-label">${_detailT('guide_label')}</div>
      ${guides.map(g => {
        const icon = g.icon || '✅';
        const text = typeof g.html === 'string' ? g.html : (g.html?.html || JSON.stringify(g.html));
        return `<div class="guide-item"><span class="icon">${icon}</span><p>${text}</p></div>`;
      }).join('')}
    `;
  }

  // 사이드바 통계 (detail 화면)
  const detailStats = document.querySelectorAll('#screen-detail .stat-item .val');
  if (detailStats.length >= 4) {
    detailStats[0].textContent  = pct + '%';
    detailStats[0].className    = `val ${color}`;
    detailStats[1].textContent  = summary_stats.benefit_label || _detailT('benefit_unknown');
    detailStats[2].textContent  = summary_stats.processing_period_label || _detailT('processing_default');
    detailStats[3].textContent  = String(summary_stats.issue_count ?? issues.length) + _detailT('count_suffix');
  }

  // AI 핵심요약 박스 로드
  renderAiSummary(detailData);
}

// ── 원문 발췌 박스 렌더링 ────────────────────────────────────
async function renderAiSummary(detailData) {
  const box = document.getElementById('ai-summary-content');
  if (!box) return;

  const personalSummary = detailData.개인요약 || detailData.personal_summary || '';
  const policyName = detailData.policy_header?.policy_name || '';
  const raw = POLICY_DB.find(p => p.서비스명 === policyName) || {};
  const source = detailData.source_excerpt || {};
  const rawTarget  = source.support_target_text      || raw.지원대상   || '';
  const rawContent = source.support_content_text     || raw.지원내용   || '';
  const rawMethod  = source.application_method_text  || raw.신청방법   || '';
  const rawPhone   = source.contact_text             || raw.전화문의   || '';
  const rawUrl     = source.official_url             || raw.상세조회url || '';

  if (!personalSummary && !rawTarget && !rawContent && !rawMethod) {
    box.innerHTML = `<div class="ai-summary-row"><span class="ai-summary-icon">📌</span><span style="font-size:12px;color:var(--gray-500)">${escHtml(_detailT('no_source'))}</span></div>`;
    return;
  }

  const md2html = s => escHtml(s || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const rows = [
    rawTarget  ? { label:_detailT('support_target'), value: _shortText(rawTarget, 120)  } : null,
    rawContent ? { label:_detailT('support_content'), value: _shortText(rawContent, 120) } : null,
    rawMethod  ? { label:_detailT('application_method'), value: _shortText(rawMethod, 80) } : null,
  ].filter(Boolean);

  const personalHtml = personalSummary
    ? `<div class="ai-summary-row" style="border-bottom:1px solid rgba(245,195,60,.15);margin-bottom:8px;padding-bottom:8px;">
        <span class="ai-summary-icon">📄</span>
        <div style="flex:1;font-size:13.5px;font-weight:500;line-height:1.65;color:#2D2200">${md2html(personalSummary)}</div>
      </div>`
    : '';

  box.innerHTML = personalHtml + rows.map(r =>
    `<div class="ai-summary-row">
      <span class="ai-summary-icon" style="font-size:13px;min-width:16px;">▍</span>
      <div style="flex:1;">
        <div class="ai-summary-source-label">${r.label}</div>
        <div class="ai-summary-excerpt">${md2html(r.value)}</div>
      </div>
    </div>`
  ).join('') + (rawPhone || rawUrl ? `
    <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(245,195,60,.2)">
      ${rawPhone ? `<span style="font-size:11px;color:var(--gray-500)">📞 ${escHtml(rawPhone)}</span>` : ''}
      ${rawUrl   ? `<a href="${escHtml(rawUrl)}" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none;font-weight:600">🔗 ${escHtml(_detailT('official_page'))}</a>` : ''}
    </div>` : '');
}

// ── 정적 정책 데이터 (백엔드 없이도 상세 보기 동작) ─────────
const _STATIC_DETAIL = {
  '청년-월세-한시-특별지원': {
    policy_header: {
      policy_name: '청년 월세 한시 특별지원',
      eligibility_percent: 92,
      progress_color: 'green',
      icon: '🏠',
    },
    issues: [
      { icon: '⚠️', html: '<strong>주민등록 전입 미완료:</strong> 현재 거주지 주민등록이 신청 주소와 일치하지 않을 수 있습니다. 서류 심사 시 탈락 요인이 될 수 있습니다.' },
      { icon: '📋', html: '<strong>임대차 계약서 미비:</strong> 월세 계약 기간이 남은 계약서 원본 및 확정일자가 필요합니다.' },
    ],
    guides: [
      { icon: '✅', html: '<strong>1단계: 전입신고 완료하기</strong> — 거주지 주민센터를 방문하여 현 주소로 전입신고를 진행하세요. 처리 기간: 당일' },
      { icon: '📎', html: '<strong>2단계: 임대차 계약서 확인</strong> — 계약서에 확정일자 도장이 찍혀 있는지 확인하고, 없다면 주민센터 방문 시 동시에 신청하세요.' },
      { icon: '🚀', html: '<strong>3단계: 복지로에서 온라인 신청</strong> — 위 서류 준비 후 <a href="https://bokjiro.go.kr" target="_blank" style="color:var(--blue)">bokjiro.go.kr</a>에서 신청서를 제출하세요. 30일 이내 결과를 통보받습니다.' },
    ],
    summary_stats: { benefit_label: '연 240만원', processing_period_label: '1개월', issue_count: 2, source_label: '국토부' },
  },
  '국민내일배움카드': {
    policy_header: { policy_name: '국민내일배움카드', eligibility_percent: 85, progress_color: 'green', icon: '📚' },
    issues: [
      { icon: '⚠️', html: '<strong>재직자 소득 기준 확인 필요:</strong> 연 소득 5,000만원 초과 대기업 재직자는 지원 대상에서 제외됩니다.' },
      { icon: '📋', html: '<strong>훈련 기관 선택 필요:</strong> 지정된 직업훈련기관에서만 카드 사용이 가능합니다. 사전 확인 후 신청하세요.' },
    ],
    guides: [
      { icon: '✅', html: '<strong>1단계: 고용24 회원가입</strong> — <a href="https://www.work24.go.kr" target="_blank" style="color:var(--blue)">work24.go.kr</a>에서 회원가입 후 신청 페이지로 이동하세요.' },
      { icon: '📎', html: '<strong>2단계: 수강 희망 과정 선택</strong> — 직업훈련포털에서 수강 희망 훈련과정을 미리 검색해두세요.' },
      { icon: '🚀', html: '<strong>3단계: 카드 신청 및 발급</strong> — 신청 승인 후 카드 수령까지 약 2주 소요됩니다. 국민은행 또는 우리은행으로 발급됩니다.' },
    ],
    summary_stats: { benefit_label: '최대 500만원', processing_period_label: '2주', issue_count: 2, source_label: '고용부' },
  },
  '청년-취업성공패키지': {
    policy_header: { policy_name: '청년도약계좌', eligibility_percent: 78, progress_color: 'blue', icon: '💼' },
    issues: [
      { icon: '⚠️', html: '<strong>소득 기준 재확인 필요:</strong> 개인소득 6,000만원 이하, 가구소득 중위 180% 이하 조건을 모두 충족해야 합니다.' },
      { icon: '🔎', html: '<strong>5년 유지 의무:</strong> 중도 해지 시 정부기여금 및 비과세 혜택이 소멸됩니다. 장기 납입 계획 수립이 필요합니다.' },
    ],
    guides: [
      { icon: '✅', html: '<strong>1단계: 가입 자격 셀프 체크</strong> — 소득 기준(개인·가구 모두)과 나이(만 19~34세) 조건을 사전에 확인하세요.' },
      { icon: '📎', html: '<strong>2단계: 은행 앱에서 신청</strong> — 취급 은행(국민·신한·하나·우리 등) 앱에서 비대면으로 신청 가능합니다.' },
      { icon: '🚀', html: '<strong>3단계: 매월 40~70만원 납입</strong> — 월 최대 70만원 납입 시 정부기여금 최대 6%를 추가로 받을 수 있습니다.' },
    ],
    summary_stats: { benefit_label: '최대 5,000만원', processing_period_label: '5년 만기', issue_count: 2, source_label: '금융위' },
  },
  '청년-마음건강-지원사업': {
    policy_header: { policy_name: '청년 마음건강 지원사업', eligibility_percent: 74, progress_color: 'blue', icon: '🏥' },
    issues: [
      { icon: '⚠️', html: '<strong>지역별 바우처 공급량 제한:</strong> 거주 지역에 따라 제공 가능한 상담사 및 기관 수가 다릅니다. 조기 신청을 권장합니다.' },
      { icon: '📌', html: '<strong>연 10회 한도:</strong> 회기당 50분 기준이며, 잔여 회기는 다음 연도로 이월되지 않습니다.' },
    ],
    guides: [
      { icon: '✅', html: '<strong>1단계: 거주지 주민센터 방문 신청</strong> — 신분증 지참 후 복지 담당자에게 청년 마음건강 바우처 신청 의사를 밝히세요.' },
      { icon: '📎', html: '<strong>2단계: 상담 기관 선택</strong> — 정신건강복지센터 또는 지정 민간 상담 기관 중 선택 가능합니다.' },
      { icon: '🚀', html: '<strong>3단계: 상담 예약 및 이용</strong> — 바우처 카드 수령 후 지정 기관에서 상담 예약을 진행하세요. 본인부담금은 회당 3,000원입니다.' },
    ],
    summary_stats: { benefit_label: '연 80만원 상당', processing_period_label: '상시', issue_count: 2, source_label: '복지부' },
  },
  '청년창업사관학교': {
    policy_header: { policy_name: '청년창업사관학교', eligibility_percent: 41, progress_color: 'orange', icon: '🚀' },
    issues: [
      { icon: '❗', html: '<strong>사업계획서 준비 미흡:</strong> 서류 심사 + 발표 심사 2단계로 진행되며, 구체적인 매출 계획과 시장 분석이 필수입니다.' },
      { icon: '⚠️', html: '<strong>창업 아이템 구체성 부족:</strong> 단순 아이디어 수준이 아닌, MVP(최소 기능 제품) 또는 프로토타입이 있을 경우 합격률이 크게 높아집니다.' },
      { icon: '🔎', html: '<strong>경쟁률 높음:</strong> 연간 선발 인원이 제한되어 있어 평균 경쟁률이 5:1 이상입니다.' },
    ],
    guides: [
      { icon: '✅', html: '<strong>1단계: 창업 아이템 구체화</strong> — 문제 정의 → 솔루션 → 목표 시장 → 수익 모델 순서로 사업계획서의 뼈대를 작성하세요.' },
      { icon: '📎', html: '<strong>2단계: K-스타트업 포털에서 공고 확인</strong> — <a href="https://www.k-startup.go.kr" target="_blank" style="color:var(--blue)">k-startup.go.kr</a>에서 모집 일정과 지원 자격을 확인하세요.' },
      { icon: '🚀', html: '<strong>3단계: 서류·면접 준비</strong> — 사전에 창업진흥원 무료 컨설팅(창업 교육 프로그램)을 받으면 합격률이 올라갑니다.' },
    ],
    summary_stats: { benefit_label: '최대 1억원', processing_period_label: '1년', issue_count: 3, source_label: '중기부' },
  },
};

const DETAIL_POLICY_ALIASES = {
  '청년-취업성공패키지': '청년도약계좌',
};

const LOCAL_DETAIL_BLUEPRINTS = {
  '청년-월세-한시-특별지원': {
    meta: { pct: 92, color: 'green', icon: '🏠', source: '국토부', contact: '1600-0777', url: 'https://www.bokjiro.go.kr' },
    ko: {
      title: '청년 월세 한시 특별지원',
      benefit: '연 240만원',
      period: '1개월',
      target: '만 19~34세 무주택 청년, 부모와 별도 거주, 월세 60만원 이하',
      content: '월 최대 20만원, 최대 12개월 지원',
      method: '복지로 또는 주민센터',
      issues: [
        ['주민등록 전입 미완료', '현재 거주지 주민등록이 신청 주소와 일치하지 않을 수 있습니다. 서류 심사 시 탈락 요인이 될 수 있습니다.'],
        ['임대차 계약서 미비', '월세 계약 기간이 남은 계약서 원본 및 확정일자가 필요합니다.'],
      ],
      guides: [
        ['1단계: 전입신고 완료하기', '거주지 주민센터를 방문하여 현 주소로 전입신고를 진행하세요. 처리 기간: 당일'],
        ['2단계: 임대차 계약서 확인', '계약서에 확정일자 도장이 찍혀 있는지 확인하고, 없다면 주민센터 방문 시 동시에 신청하세요.'],
        ['3단계: 복지로에서 온라인 신청', '위 서류 준비 후 bokjiro.go.kr에서 신청서를 제출하세요. 30일 이내 결과를 통보받습니다.'],
      ],
    },
    en: {
      title: 'Temporary Youth Monthly Rent Support',
      benefit: 'Up to 2.4M KRW/year',
      period: '1 month',
      target: 'Homeless young adults aged 19-34 living separately from parents, monthly rent of 600,000 KRW or less',
      content: 'Up to 200,000 KRW per month for up to 12 months',
      method: 'Apply through Bokjiro or a local resident center',
      issues: [
        ['Address registration not completed', 'Your registered residence may not match the application address, which can become a screening issue.'],
        ['Lease document incomplete', 'A valid lease contract with remaining term and confirmed date may be required.'],
      ],
      guides: [
        ['Step 1: Complete address transfer', 'Visit the local resident center and register your current address. Processing can be done the same day.'],
        ['Step 2: Check the lease contract', 'Confirm that the lease has a fixed-date stamp. If not, request it at the resident center.'],
        ['Step 3: Apply online through Bokjiro', 'Prepare the documents and submit the application at bokjiro.go.kr. Results are usually notified within 30 days.'],
      ],
    },
    zh: {
      title: '青年月租临时特别支援',
      benefit: '年最高240万韩元',
      period: '1个月',
      target: '19至34岁无房青年，与父母分开居住，月租60万韩元以下',
      content: '每月最高20万韩元，最多支援12个月',
      method: '通过福利路或居民中心申请',
      issues: [
        ['户籍迁入未完成', '当前居住地登记可能与申请地址不一致，文件审查时可能成为被淘汰的原因。'],
        ['租赁合同不完整', '需要提供剩余租期的租赁合同原件以及确认日期章。'],
      ],
      guides: [
        ['第1步：完成户籍迁入', '前往居住地居民中心，将户籍迁入当前地址。当天即可办理。'],
        ['第2步：确认租赁合同', '确认合同上是否有确认日期章，如无，可在前往居民中心时同时申请。'],
        ['第3步：通过福利路在线申请', '准备好文件后，在 bokjiro.go.kr 提交申请。30天内会收到结果通知。'],
      ],
    },
    ja: {
      title: '青年月家賃一時特別支援',
      benefit: '年最大240万ウォン',
      period: '1か月',
      target: '満19〜34歳の無住宅青年、親と別居、月家賃60万ウォン以下',
      content: '月最大20万ウォン、最大12か月支援',
      method: '福祉路または住民センター',
      issues: [
        ['住民登録の転入未完了', '現在の居住地の住民登録が申請住所と一致しない可能性があります。書類審査で不合格要因になることがあります。'],
        ['賃貸借契約書の不備', '残存期間のある賃貸借契約書の原本と確定日付が必要です。'],
      ],
      guides: [
        ['第1ステップ：転入届の完了', '居住地の住民センターを訪問し、現在住所への転入届を行ってください。当日処理可能です。'],
        ['第2ステップ：賃貸借契約書の確認', '契約書に確定日付の印があるか確認し、なければ住民センター訪問時に同時に申請してください。'],
        ['第3ステップ：ボクジロでオンライン申請', '書類準備後、bokjiro.go.krで申請書を提出してください。30日以内に結果が通知されます。'],
      ],
    },
    vi: {
      title: 'Hỗ trợ tiền thuê nhà tạm thời cho thanh niên',
      benefit: 'Tối đa 2,4 triệu KRW/năm',
      period: '1 tháng',
      target: 'Thanh niên 19-34 tuổi chưa có nhà, sống riêng với cha mẹ, tiền thuê dưới 600.000 KRW/tháng',
      content: 'Hỗ trợ tối đa 200.000 KRW/tháng trong tối đa 12 tháng',
      method: 'Đăng ký qua Bokjiro hoặc trung tâm cư trú',
      issues: [
        ['Chưa hoàn tất chuyển đăng ký cư trú', 'Địa chỉ đăng ký cư trú hiện tại có thể không khớp với địa chỉ đăng ký, gây rủi ro khi xét hồ sơ.'],
        ['Thiếu hợp đồng thuê nhà', 'Cần bản gốc hợp đồng thuê còn thời hạn và ngày xác nhận hợp lệ.'],
      ],
      guides: [
        ['Bước 1: Hoàn tất chuyển địa chỉ cư trú', 'Đến trung tâm cư trú nơi đang ở để đăng ký địa chỉ hiện tại. Có thể xử lý trong ngày.'],
        ['Bước 2: Kiểm tra hợp đồng thuê', 'Kiểm tra hợp đồng có dấu ngày xác nhận hay chưa; nếu chưa, hãy đăng ký cùng lúc tại trung tâm cư trú.'],
        ['Bước 3: Đăng ký trực tuyến trên Bokjiro', 'Sau khi chuẩn bị hồ sơ, nộp đơn tại bokjiro.go.kr. Kết quả thường được thông báo trong 30 ngày.'],
      ],
    },
  },
  '국민내일배움카드': {
    meta: { pct: 85, color: 'green', icon: '📚', source: '고용부', contact: '1350', url: 'https://www.work24.go.kr' },
    ko: {
      title: '국민내일배움카드', benefit: '최대 500만원', period: '2주',
      target: '실업자, 이직 예정자, 비정규직, 단기근로자, 자영업자',
      content: '훈련비 최대 500만원, 자부담 15~55%',
      method: '고용24(work24.go.kr) 온라인 신청',
      issues: [['재직자 소득 기준 확인 필요', '연 소득 5,000만원 초과 대기업 재직자는 지원 대상에서 제외됩니다.'], ['훈련 기관 선택 필요', '지정된 직업훈련기관에서만 카드 사용이 가능합니다. 사전 확인 후 신청하세요.']],
      guides: [['1단계: 고용24 회원가입', 'work24.go.kr에서 회원가입 후 신청 페이지로 이동하세요.'], ['2단계: 수강 희망 과정 선택', '직업훈련포털에서 수강 희망 훈련과정을 미리 검색해두세요.'], ['3단계: 카드 신청 및 발급', '신청 승인 후 카드 수령까지 약 2주 소요됩니다. 국민은행 또는 우리은행으로 발급됩니다.']],
    },
    en: {
      title: 'National Tomorrow Learning Card', benefit: 'Up to 5M KRW', period: '2 weeks',
      target: 'Unemployed people, job changers, non-regular workers, short-term workers, and self-employed people',
      content: 'Training fee support up to 5M KRW, with 15-55% self-payment',
      method: 'Apply online through Work24',
      issues: [['Income check may be required', 'Some high-income employees at large companies may be excluded.'], ['Training institution selection needed', 'The card can be used only at designated vocational training institutions.']],
      guides: [['Step 1: Sign up for Work24', 'Create an account at work24.go.kr and move to the application page.'], ['Step 2: Choose a course', 'Search for the desired training course in advance.'], ['Step 3: Apply and receive the card', 'It usually takes about two weeks after approval; cards are issued through KB Kookmin or Woori Bank.']],
    },
    zh: {
      title: '国民明日学习卡', benefit: '最高500万韩元', period: '2周',
      target: '失业者、计划转职者、非正式员工、短期劳动者、自营业者',
      content: '培训费最高支援500万韩元，自费比例15~55%',
      method: '通过雇佣24在线申请',
      issues: [['需要确认在职者收入标准', '年收入超过5,000万韩元的大企业在职者可能被排除。'], ['需要选择培训机构', '只能在指定职业培训机构使用，请先确认后申请。']],
      guides: [['第1步：注册雇佣24', '在 work24.go.kr 注册后进入申请页面。'], ['第2步：选择想参加的课程', '提前在职业培训门户搜索希望参加的培训课程。'], ['第3步：申请并领取卡片', '申请批准后约需2周领取，可通过国民银行或友利银行发行。']],
    },
    ja: {
      title: '国民明日学習カード', benefit: '最大500万ウォン', period: '2週間',
      target: '失業者、転職予定者、非正規・短期労働者、自営業者',
      content: '訓練費最大500万ウォン、自己負担15〜55%',
      method: '雇用24(work24.go.kr)でオンライン申請',
      issues: [['在職者の所得基準確認が必要', '年所得5,000万ウォン超の大企業在職者は支援対象から除外されます。'], ['訓練機関の選択が必要', '指定職業訓練機関でのみカードを使用できます。事前確認後に申請してください。']],
      guides: [['第1ステップ：雇用24会員登録', 'work24.go.krで会員登録後、申請ページへ移動してください。'], ['第2ステップ：受講希望課程の選択', '職業訓練ポータルで希望する訓練課程を事前に検索してください。'], ['第3ステップ：カード申請と発行', '承認後、カード受領まで約2週間かかります。国民銀行またはウリ銀行で発行されます。']],
    },
    vi: {
      title: 'Thẻ học tập ngày mai quốc dân', benefit: 'Tối đa 5 triệu KRW', period: '2 tuần',
      target: 'Người thất nghiệp, người dự định chuyển việc, lao động không chính thức/ngắn hạn, người tự kinh doanh',
      content: 'Hỗ trợ học phí tối đa 5 triệu KRW, tự chi trả 15-55%',
      method: 'Đăng ký trực tuyến qua Work24',
      issues: [['Cần kiểm tra tiêu chuẩn thu nhập', 'Một số nhân viên doanh nghiệp lớn có thu nhập cao có thể bị loại.'], ['Cần chọn cơ sở đào tạo', 'Thẻ chỉ dùng được tại cơ sở đào tạo nghề được chỉ định.']],
      guides: [['Bước 1: Đăng ký Work24', 'Tạo tài khoản tại work24.go.kr rồi vào trang đăng ký.'], ['Bước 2: Chọn khóa học mong muốn', 'Tìm trước khóa đào tạo trên cổng đào tạo nghề.'], ['Bước 3: Đăng ký và nhận thẻ', 'Sau khi được phê duyệt, mất khoảng 2 tuần để nhận thẻ qua KB Kookmin hoặc Woori Bank.']],
    },
  },
  '청년도약계좌': {
    meta: { pct: 78, color: 'blue', icon: '💼', source: '금융위', contact: '1332', url: 'https://www.fsc.go.kr' },
    ko: {
      title: '청년도약계좌', benefit: '최대 5,000만원', period: '5년 만기',
      target: '만 19~34세, 개인소득 6,000만원 이하, 가구소득 중위 180% 이하',
      content: '월 최대 70만원 납입 시 정부기여금 최대 6%, 5년 만기 최대 5,000만원',
      method: '은행 앱 또는 영업점',
      issues: [['소득 기준 재확인 필요', '개인소득 6,000만원 이하, 가구소득 중위 180% 이하 조건을 모두 충족해야 합니다.'], ['5년 유지 의무', '중도 해지 시 정부기여금 및 비과세 혜택이 소멸됩니다. 장기 납입 계획 수립이 필요합니다.']],
      guides: [['1단계: 가입 자격 셀프 체크', '소득 기준(개인·가구 모두)과 나이(만 19~34세) 조건을 사전에 확인하세요.'], ['2단계: 은행 앱에서 신청', '취급 은행 앱에서 비대면 신청 가능합니다.'], ['3단계: 매월 40~70만원 납입', '월 최대 70만원 납입 시 정부기여금 최대 6%를 추가로 받을 수 있습니다.']],
    },
    en: {
      title: 'Youth Leap Account', benefit: 'Up to 50M KRW', period: '5-year maturity',
      target: 'Aged 19-34, personal income up to 60M KRW, household income up to 180% of median',
      content: 'Government contribution up to 6% when saving up to 700,000 KRW/month; up to 50M KRW at 5-year maturity',
      method: 'Apply through a bank app or branch',
      issues: [['Income criteria must be rechecked', 'Both personal and household income conditions must be satisfied.'], ['Five-year maintenance required', 'Early cancellation may remove government contributions and tax benefits.']],
      guides: [['Step 1: Self-check eligibility', 'Check income and age conditions before applying.'], ['Step 2: Apply through a bank app', 'Non-face-to-face application is available through participating bank apps.'], ['Step 3: Save 400,000-700,000 KRW monthly', 'Saving up to 700,000 KRW per month can add up to 6% government contribution.']],
    },
    zh: {
      title: '青年跃升账户', benefit: '最高5,000万韩元', period: '5年到期',
      target: '19至34岁，个人收入6,000万韩元以下，家庭收入中位数180%以下',
      content: '每月最高缴纳70万韩元时，政府贡献金最高6%，5年到期最高5,000万韩元',
      method: '通过银行App或营业网点申请',
      issues: [['需要重新确认收入标准', '必须同时满足个人收入和家庭收入条件。'], ['需要维持5年', '中途解约时政府贡献金和免税优惠可能消失。']],
      guides: [['第1步：自行确认资格', '提前确认个人/家庭收入标准和年龄条件。'], ['第2步：通过银行App申请', '可在合作银行App中非面对面申请。'], ['第3步：每月缴纳40~70万韩元', '每月最高70万韩元时可追加获得最高6%的政府贡献金。']],
    },
    ja: {
      title: '青年跳躍口座', benefit: '最大5,000万ウォン', period: '5年満期',
      target: '満19〜34歳、個人所得6,000万ウォン以下、世帯所得中位180%以下',
      content: '月最大70万ウォン納入時、政府寄与金最大6%、5年満期で最大5,000万ウォン',
      method: '銀行アプリまたは支店',
      issues: [['所得基準の再確認が必要', '個人所得6,000万ウォン以下、世帯所得中位180%以下の条件をすべて満たす必要があります。'], ['5年維持義務', '中途解約時、政府寄与金および非課税特典が消滅します。長期納入計画が必要です。']],
      guides: [['第1ステップ：加入資格セルフチェック', '所得基準（個人・世帯）と年齢条件を事前に確認してください。'], ['第2ステップ：銀行アプリで申請', '取扱銀行アプリで非対面申請が可能です。'], ['第3ステップ：毎月40〜70万ウォン納入', '月最大70万ウォン納入時、政府寄与金最大6%を追加で受けられます。']],
    },
    vi: {
      title: 'Tài khoản Youth Leap', benefit: 'Tối đa 50 triệu KRW', period: 'Đáo hạn 5 năm',
      target: 'Từ 19-34 tuổi, thu nhập cá nhân dưới 60 triệu KRW, thu nhập hộ dưới 180% trung vị',
      content: 'Đóng tối đa 700.000 KRW/tháng có thể nhận đóng góp chính phủ tối đa 6%, đáo hạn 5 năm tối đa 50 triệu KRW',
      method: 'Đăng ký qua ứng dụng ngân hàng hoặc chi nhánh',
      issues: [['Cần kiểm tra lại tiêu chuẩn thu nhập', 'Phải đáp ứng cả điều kiện thu nhập cá nhân và hộ gia đình.'], ['Phải duy trì 5 năm', 'Nếu hủy giữa chừng, đóng góp chính phủ và ưu đãi thuế có thể mất.']],
      guides: [['Bước 1: Tự kiểm tra tư cách', 'Kiểm tra trước điều kiện thu nhập và độ tuổi.'], ['Bước 2: Đăng ký qua ứng dụng ngân hàng', 'Có thể đăng ký không gặp mặt qua ứng dụng ngân hàng tham gia.'], ['Bước 3: Đóng 400.000-700.000 KRW mỗi tháng', 'Đóng tối đa 700.000 KRW/tháng có thể nhận thêm tối đa 6% từ chính phủ.']],
    },
  },
  '청년-마음건강-지원사업': {
    meta: { pct: 74, color: 'blue', icon: '🏥', source: '복지부', contact: '1577-0199', url: 'https://www.bokjiro.go.kr' },
    ko: {
      title: '청년 마음건강 지원사업', benefit: '연 80만원 상당', period: '상시',
      target: '만 19~34세 청년, 소득 기준 없음', content: '전문심리상담 연간 10회 이내 지원, 1회당 최대 8만원', method: '정신건강복지센터 또는 지자체 문의',
      issues: [['지역별 바우처 공급량 제한', '거주 지역에 따라 제공 가능한 상담사 및 기관 수가 다릅니다. 조기 신청을 권장합니다.'], ['연 10회 한도', '회기당 50분 기준이며, 잔여 회기는 다음 연도로 이월되지 않습니다.']],
      guides: [['1단계: 거주지 주민센터 방문 신청', '신분증 지참 후 복지 담당자에게 청년 마음건강 바우처 신청 의사를 밝히세요.'], ['2단계: 상담 기관 선택', '정신건강복지센터 또는 지정 민간 상담 기관 중 선택 가능합니다.'], ['3단계: 상담 예약 및 이용', '바우처 카드 수령 후 지정 기관에서 상담 예약을 진행하세요. 본인부담금은 회당 3,000원입니다.']],
    },
    en: {
      title: 'Youth Mental Health Support Program', benefit: 'About 800K KRW/year', period: 'Ongoing',
      target: 'Young adults aged 19-34, no income requirement', content: 'Up to 10 professional counseling sessions per year, up to 80,000 KRW per session', method: 'Contact a mental health welfare center or local government',
      issues: [['Voucher supply varies by region', 'Available counselors and institutions can differ by residence area. Early application is recommended.'], ['Limited to 10 sessions per year', 'Each session is based on 50 minutes; unused sessions do not carry over.']],
      guides: [['Step 1: Apply at resident center', 'Bring ID and tell the welfare officer you want to apply for the youth mental health voucher.'], ['Step 2: Choose a counseling institution', 'Select from a mental health welfare center or designated private institution.'], ['Step 3: Book and use counseling', 'After receiving the voucher card, book counseling at the designated institution. Self-payment is 3,000 KRW per session.']],
    },
    zh: {
      title: '青年心理健康支援项目', benefit: '年约80万韩元', period: '常时',
      target: '19至34岁青年，无收入标准', content: '每年最多10次专业心理咨询，每次最高8万韩元', method: '咨询精神健康福利中心或地方政府',
      issues: [['地区券供应量有限', '可提供的咨询师和机构数量因居住地区而异，建议尽早申请。'], ['每年10次限制', '每次以50分钟为准，剩余次数不结转至下一年度。']],
      guides: [['第1步：到居民中心申请', '携带身份证，向福利负责人说明申请青年心理健康券意向。'], ['第2步：选择咨询机构', '可在精神健康福利中心或指定民间咨询机构中选择。'], ['第3步：预约并使用咨询', '领取券卡后，在指定机构预约咨询。本人负担每次3,000韩元。']],
    },
    ja: {
      title: '青年メンタルヘルス支援事業', benefit: '年80万ウォン相当', period: '随時',
      target: '満19〜34歳の青年、所得基準なし', content: '専門心理相談を年間10回以内支援、1回あたり最大8万ウォン', method: '精神健康福祉センターまたは自治体へ問い合わせ',
      issues: [['地域別バウチャー供給量の制限', '居住地域により利用可能な相談員や機関数が異なります。早めの申請をおすすめします。'], ['年10回の上限', '1回50分基準で、残り回数は翌年度へ繰り越されません。']],
      guides: [['第1ステップ：居住地住民センターで申請', '身分証を持参し、福祉担当者に青年メンタルヘルスバウチャー申請意思を伝えてください。'], ['第2ステップ：相談機関を選択', '精神健康福祉センターまたは指定民間相談機関から選択できます。'], ['第3ステップ：相談予約と利用', 'バウチャーカード受領後、指定機関で相談予約を行ってください。本人負担金は1回3,000ウォンです。']],
    },
    vi: {
      title: 'Chương trình hỗ trợ sức khỏe tinh thần thanh niên', benefit: 'Khoảng 800.000 KRW/năm', period: 'Thường xuyên',
      target: 'Thanh niên 19-34 tuổi, không yêu cầu thu nhập', content: 'Hỗ trợ tối đa 10 buổi tư vấn tâm lý chuyên nghiệp/năm, tối đa 80.000 KRW/buổi', method: 'Liên hệ trung tâm sức khỏe tinh thần hoặc chính quyền địa phương',
      issues: [['Số lượng voucher khác nhau theo khu vực', 'Số tư vấn viên và cơ sở có thể khác nhau tùy nơi cư trú. Nên đăng ký sớm.'], ['Giới hạn 10 buổi/năm', 'Mỗi buổi 50 phút; số buổi còn lại không chuyển sang năm sau.']],
      guides: [['Bước 1: Đăng ký tại trung tâm cư trú', 'Mang giấy tờ tùy thân và thông báo muốn đăng ký voucher sức khỏe tinh thần.'], ['Bước 2: Chọn cơ sở tư vấn', 'Có thể chọn trung tâm sức khỏe tinh thần hoặc cơ sở tư vấn tư nhân được chỉ định.'], ['Bước 3: Đặt lịch và sử dụng tư vấn', 'Sau khi nhận thẻ voucher, đặt lịch tại cơ sở chỉ định. Người dùng tự trả 3.000 KRW/buổi.']],
    },
  },
  '청년창업사관학교': {
    meta: { pct: 41, color: 'orange', icon: '🚀', source: '중기부', contact: '1357', url: 'https://www.k-startup.go.kr' },
    ko: {
      title: '청년창업사관학교', benefit: '최대 1억원', period: '1년',
      target: '만 39세 이하 예비창업자 또는 창업 3년 이내', content: '창업지원금 최대 1억원, 사무공간·멘토링 제공', method: 'K-Startup 홈페이지 온라인 접수',
      issues: [['사업계획서 준비 미흡', '서류 심사와 발표 심사 2단계로 진행되며, 구체적인 매출 계획과 시장 분석이 필수입니다.'], ['창업 아이템 구체성 부족', '단순 아이디어가 아니라 MVP 또는 프로토타입이 있으면 합격률이 높아집니다.'], ['경쟁률 높음', '연간 선발 인원이 제한되어 평균 경쟁률이 5:1 이상입니다.']],
      guides: [['1단계: 창업 아이템 구체화', '문제 정의, 솔루션, 목표 시장, 수익 모델 순서로 사업계획서의 뼈대를 작성하세요.'], ['2단계: K-스타트업 포털에서 공고 확인', 'k-startup.go.kr에서 모집 일정과 지원 자격을 확인하세요.'], ['3단계: 서류·면접 준비', '사전에 창업진흥원 무료 컨설팅이나 창업 교육 프로그램을 받으면 합격률이 올라갑니다.']],
    },
    en: {
      title: 'Youth Startup Academy', benefit: 'Up to 100M KRW', period: '1 year',
      target: 'Prospective founders aged 39 or younger, or businesses within 3 years of founding', content: 'Startup funding up to 100M KRW plus office space and mentoring', method: 'Apply online through K-Startup',
      issues: [['Business plan not ready', 'Screening has document and presentation stages; concrete revenue plans and market analysis are essential.'], ['Startup item lacks specificity', 'Having an MVP or prototype improves the chance of selection.'], ['High competition', 'Annual seats are limited and average competition can exceed 5:1.']],
      guides: [['Step 1: Specify the startup item', 'Write the plan around problem, solution, target market, and revenue model.'], ['Step 2: Check notices on K-Startup', 'Confirm schedule and eligibility at k-startup.go.kr.'], ['Step 3: Prepare documents and interview', 'Free consulting or startup education can improve readiness.']],
    },
    zh: {
      title: '青年创业士官学校', benefit: '最高1亿韩元', period: '1年',
      target: '39岁以下预备创业者或创业3年以内企业', content: '最高1亿韩元创业资金，并提供办公空间和导师指导', method: '通过 K-Startup 官网在线申请',
      issues: [['商业计划书准备不足', '分为文件审查和发表审查两阶段，具体销售计划和市场分析必不可少。'], ['创业项目不够具体', '如果有MVP或原型，合格率会明显提高。'], ['竞争率高', '年度选拔人数有限，平均竞争率通常超过5:1。']],
      guides: [['第1步：具体化创业项目', '按问题定义、解决方案、目标市场、收益模型顺序建立商业计划书框架。'], ['第2步：在K-Startup确认公告', '在 k-startup.go.kr 确认招募日程和申请资格。'], ['第3步：准备文件和面试', '提前接受免费咨询或创业教育有助于提高通过率。']],
    },
    ja: {
      title: '青年創業士官学校', benefit: '最大1億ウォン', period: '1年',
      target: '満39歳以下の予備創業者または創業3年以内', content: '創業支援金最大1億ウォン、事務空間・メンタリング提供', method: 'K-Startupホームページでオンライン受付',
      issues: [['事業計画書の準備不足', '書類審査と発表審査の2段階で進行され、具体的な売上計画と市場分析が必須です。'], ['創業アイテムの具体性不足', '単なるアイデアではなく、MVPまたはプロトタイプがあると合格率が高まります。'], ['競争率が高い', '年間選抜人数が限られており、平均競争率は5:1以上です。']],
      guides: [['第1ステップ：創業アイテムの具体化', '問題定義、解決策、目標市場、収益モデルの順に事業計画書の骨子を作成してください。'], ['第2ステップ：K-Startupで公募確認', 'k-startup.go.krで募集日程と応募資格を確認してください。'], ['第3ステップ：書類・面接準備', '事前に無料コンサルティングや創業教育を受けると合格率が上がります。']],
    },
    vi: {
      title: 'Học viện khởi nghiệp thanh niên', benefit: 'Tối đa 100 triệu KRW', period: '1 năm',
      target: 'Người chuẩn bị khởi nghiệp dưới 39 tuổi hoặc doanh nghiệp trong 3 năm đầu', content: 'Hỗ trợ vốn khởi nghiệp tối đa 100 triệu KRW, không gian làm việc và cố vấn', method: 'Đăng ký trực tuyến trên K-Startup',
      issues: [['Kế hoạch kinh doanh chưa đủ', 'Có hai vòng xét hồ sơ và thuyết trình; cần kế hoạch doanh thu và phân tích thị trường cụ thể.'], ['Ý tưởng khởi nghiệp chưa cụ thể', 'Nếu có MVP hoặc nguyên mẫu, cơ hội được chọn sẽ cao hơn.'], ['Cạnh tranh cao', 'Số lượng tuyển chọn hằng năm hạn chế, tỷ lệ cạnh tranh thường trên 5:1.']],
      guides: [['Bước 1: Cụ thể hóa ý tưởng', 'Xây dựng kế hoạch theo thứ tự vấn đề, giải pháp, thị trường mục tiêu và mô hình doanh thu.'], ['Bước 2: Kiểm tra thông báo trên K-Startup', 'Xác nhận lịch tuyển và điều kiện tại k-startup.go.kr.'], ['Bước 3: Chuẩn bị hồ sơ và phỏng vấn', 'Tư vấn miễn phí hoặc khóa đào tạo khởi nghiệp có thể cải thiện khả năng đạt.']],
    },
  },
};

function _normalizeDetailPolicyId(policyId) {
  const raw = String(policyId || '').trim();
  if (!raw) return raw;
  if (DETAIL_POLICY_ALIASES[raw]) return DETAIL_POLICY_ALIASES[raw];
  if (LOCAL_DETAIL_BLUEPRINTS[raw]) return raw;

  const rawSlug = _slugPolicyName(raw);
  for (const key of Object.keys(LOCAL_DETAIL_BLUEPRINTS)) {
    if (_slugPolicyName(key) === rawSlug) return key;
    const langs = LOCAL_DETAIL_BLUEPRINTS[key];
    for (const lang of SUPPORTED_UI_LANGS) {
      const title = langs?.[lang]?.title;
      if (title && (_slugPolicyName(title) === rawSlug || title === raw)) return key;
    }
  }
  return DETAIL_POLICY_ALIASES[rawSlug] || raw;
}

function _detailFromBlueprint(policyId, lang = _currentLangCode()) {
  const key = _normalizeDetailPolicyId(policyId);
  const pack = LOCAL_DETAIL_BLUEPRINTS[key];
  if (!pack) return null;

  const data = pack[lang] || pack.ko;
  const ko = pack.ko;
  const meta = pack.meta || {};
  const issueIcons = ['⚠️', '📋', '🔎'];
  const guideIcons = ['✅', '📎', '🚀'];

  return {
    policy_id: key,
    policy_header: {
      policy_name: data.title,
      eligibility_percent: meta.pct || 60,
      progress_color: meta.color || 'blue',
      icon: meta.icon || '📋',
      subtitle: data.target || '',
    },
    personal_summary: data.content || data.target || '',
    source_excerpt: {
      support_target_text: data.target,
      support_content_text: data.content,
      application_method_text: data.method,
      contact_text: meta.contact || '',
      official_url: meta.url || '',
    },
    issues: (data.issues || ko.issues || []).map((item, index) => ({
      icon: issueIcons[index] || '⚠️',
      html: `<strong>${escHtml(item[0])}:</strong> ${escHtml(item[1])}`,
    })),
    guides: (data.guides || ko.guides || []).map((item, index) => ({
      icon: guideIcons[index] || '✅',
      html: `<strong>${escHtml(item[0])}</strong> — ${escHtml(item[1])}`,
    })),
    summary_stats: {
      benefit_label: data.benefit || _detailT('benefit_unknown'),
      processing_period_label: data.period || _detailT('processing_default'),
      issue_count: (data.issues || ko.issues || []).length,
      source_label: meta.source || 'BenePick',
    },
  };
}

function _makeLoadingDetail(policyId) {
  const fallback = _detailFromBlueprint(policyId);
  return {
    policy_id: policyId,
    policy_header: {
      policy_name: _detailT('loading_policy'),
      eligibility_percent: 0,
      progress_color: fallback?.policy_header?.progress_color || 'blue',
      icon: fallback?.policy_header?.icon || '📋',
      subtitle: fallback?.policy_header?.policy_name || '',
    },
    personal_summary: '',
    source_excerpt: {},
    issues: [],
    guides: [],
    summary_stats: {
      benefit_label: _detailT('benefit_unknown'),
      processing_period_label: _detailT('processing_default'),
      issue_count: 0,
      source_label: 'BenePick',
    },
  };
}

function _localizeDetailData(detailData, policyId) {
  const localized = _detailFromBlueprint(policyId || detailData?.policy_id || detailData?.policy_header?.policy_name);
  if (!localized) return detailData;
  const dynamicHeader = detailData?.policy_header || {};
  return {
    ...localized,
    policy_header: {
      ...localized.policy_header,
      eligibility_percent: dynamicHeader.eligibility_percent ?? localized.policy_header.eligibility_percent,
      progress_color: dynamicHeader.progress_color ?? localized.policy_header.progress_color,
      percent_class: dynamicHeader.percent_class ?? localized.policy_header.percent_class,
      badge_label: dynamicHeader.badge_label ?? localized.policy_header.badge_label,
      badge_class: dynamicHeader.badge_class ?? localized.policy_header.badge_class,
    },
    summary_stats: {
      ...localized.summary_stats,
      issue_count: detailData?.summary_stats?.issue_count ?? localized.summary_stats.issue_count,
      source_label: detailData?.summary_stats?.source_label || localized.summary_stats.source_label,
    },
  };
}

function _isAnalysisPage() {
  return (location.pathname.split('/').pop() || 'index.html') === 'analysis.html';
}

function _rememberCurrentDetail(policyId) {
  const normalized = _normalizeDetailPolicyId(policyId);
  window.BENEFIC_CURRENT_DETAIL_ID = normalized;
  try { localStorage.setItem('benefic_detail_id_last', normalized); } catch(e) {}
  return normalized;
}

function _currentDetailId() {
  return window.BENEFIC_CURRENT_DETAIL_ID || (() => {
    try {
      return localStorage.getItem('benefic_detail_id') || localStorage.getItem('benefic_detail_id_last');
    } catch(e) {
      return null;
    }
  })();
}

window.addEventListener('benefic:language-changed', () => {
  if (!_isAnalysisPage()) return;
  const pid = _currentDetailId();
  if (!pid) return;
  _useBackend = null;
  showDetail(pid);
});

function _extractNumber(value, fallbackValue) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : fallbackValue;
}

function _textHasAny(value, keywords) {
  const text = String(value || '').toLowerCase();
  return keywords.some(keyword => text.includes(String(keyword).toLowerCase()));
}

function _payloadHasIntent(payload, keywords) {
  const tags = Array.isArray(payload.intent_tags) ? payload.intent_tags : [];
  return tags.some(tag => _textHasAny(tag, keywords));
}

function _clampScore(score) {
  return Math.max(20, Math.min(98, Math.round(score)));
}

function _localPolicyScore(policyId, payload = {}) {
  const age = _extractNumber(payload.age || payload.나이, 27);
  const income = _extractNumber(payload.income_percent || payload.income || payload.연소득, 55);
  const household = payload.household_type || payload.가구유형 || payload.family_type || '';
  const employment = payload.employment_status || payload.고용상태 || payload.employment || '';
  const disability = payload.disability || payload.장애여부 || '없음';

  const isYouth = age >= 19 && age <= 34;
  const isNearYouth = age >= 35 && age <= 39;
  const isJobSeeking = _textHasAny(employment, ['미취업', '구직', '실업', '무직', '학생', '비정규', '계약', '자영']);
  const isRegular = _textHasAny(employment, ['정규직']);
  const isSelfEmployed = _textHasAny(employment, ['자영', '사업']);
  const isOnePerson = _textHasAny(household, ['1인', '단독', '한부모']);
  const hasDisability = disability && !String(disability).includes('없음');

  let score = 50;

  if (policyId === '청년-월세-한시-특별지원') {
    score = 45;
    score += isYouth ? 22 : (isNearYouth ? 5 : -18);
    score += income <= 60 ? 18 : (income <= 80 ? 8 : (income <= 100 ? -5 : -18));
    score += isOnePerson ? 7 : 0;
    score += isJobSeeking ? 4 : 0;
    score += _payloadHasIntent(payload, ['주거', '월세', '청년']) ? 12 : 0;
  } else if (policyId === '국민내일배움카드') {
    score = 50;
    score += age >= 15 && age <= 75 ? 8 : -10;
    score += isJobSeeking ? 22 : (isRegular ? 4 : 10);
    score += income <= 100 ? 5 : (income > 180 ? -5 : 0);
    score += hasDisability ? 3 : 0;
    score += _payloadHasIntent(payload, ['고용', '교육', '훈련', '취업', '일자리']) ? 15 : 0;
  } else if (policyId === '청년도약계좌') {
    score = 45;
    score += isYouth ? 24 : -25;
    score += income <= 180 ? 18 : (income <= 220 ? 4 : -20);
    score += isRegular || isSelfEmployed ? 5 : 0;
    score += _payloadHasIntent(payload, ['금융', '저축', '자산', '목돈']) ? 12 : 0;
  } else if (policyId === '청년-마음건강-지원사업') {
    score = 42;
    score += isYouth ? 24 : (isNearYouth ? 8 : -12);
    score += income <= 120 ? 6 : (income <= 180 ? 2 : 0);
    score += hasDisability ? 4 : 0;
    score += isJobSeeking ? 4 : 0;
    score += _payloadHasIntent(payload, ['보건', '건강', '상담', '심리', '마음']) ? 16 : 0;
  } else if (policyId === '청년창업사관학교') {
    score = 30;
    score += age >= 19 && age <= 39 ? 22 : -18;
    score += isSelfEmployed ? 12 : (isJobSeeking ? 8 : (isRegular ? -4 : 0));
    score += income <= 180 ? 4 : 0;
    score += _payloadHasIntent(payload, ['창업', '사업', '스타트업']) ? 25 : 0;
  }

  return _clampScore(score);
}

function _localAnalysisSummary(cards) {
  const top = cards[0]?.서비스명 || cards[0]?.policy_name || '';
  const lang = _currentLangCode();
  if (lang === 'zh') return `根据输入条件重新计算，当前最匹配的政策是 ${top}。`;
  if (lang === 'ja') return `入力条件をもとに再計算し、現在もっとも合う政策は ${top} です。`;
  if (lang === 'vi') return `Kết quả đã được tính lại theo điều kiện đã nhập. Chính sách phù hợp nhất hiện tại là ${top}.`;
  if (lang === 'en') return `Scores were recalculated from the entered conditions. The best current match is ${top}.`;
  return `입력 조건을 기준으로 수급 가능성을 다시 계산했습니다. 현재 가장 적합한 정책은 ${top}입니다.`;
}

function _fallbackAnalysisData(payload = {}) {
  const ids = [
    '청년-월세-한시-특별지원',
    '국민내일배움카드',
    '청년도약계좌',
    '청년-마음건강-지원사업',
    '청년창업사관학교',
  ];
  const cards = ids.map(id => {
    const detail = _detailFromBlueprint(id);
    const pct = _localPolicyScore(id, payload);
    const css = _scoreToCSSForCurrentLang(pct);
    return {
      policy_id: id,
      서비스명: detail.policy_header.policy_name,
      icon: detail.policy_header.icon,
      subtitle: detail.source_excerpt.support_target_text,
      benefit_label: detail.summary_stats.benefit_label,
      source_label: detail.summary_stats.source_label,
      수급확률: pct,
      탈락사유: detail.issues,
      해결방법: detail.guides,
      _css: css,
    };
  })
    .sort((a, b) => (b.수급확률 || 0) - (a.수급확률 || 0))
    .map((card, index) => ({ ...card, 우선순위: index + 1 }));

  const average = Math.round(cards.reduce((sum, card) => sum + card.수급확률, 0) / cards.length);
  return {
    query_id: Date.now().toString(),
    cards,
    dashboard_data: {
      recommendation_cards: cards,
      stats: {
        해당정책수: cards.length,
        평균확률: average,
        예상수혜액: cards[0]?.benefit_label || '-',
        즉시신청가능: cards.filter(card => card.수급확률 >= 80).length,
      },
      summary: _localAnalysisSummary(cards),
    },
  };
}

// ── showDetail: 캐시 → POLICY_DB → 정적 fallback 순서 ────────
async function showDetail(policyId) {
  const normalizedPolicyId = _rememberCurrentDetail(policyId);
  const _onAnalysisPage = _isAnalysisPage();
  if (!_onAnalysisPage) {
    // 다른 페이지에서 호출: policyId 저장 후 analysis.html로 이동
    try { localStorage.setItem('benefic_detail_id', normalizedPolicyId); } catch(e) {}
    showTab('detail');
    return; // analysis.html의 load 핸들러가 showDetail을 재호출함
  }
  // analysis.html에서 직접 호출된 경우: 이동 없이 바로 렌더링
  renderDetail(_makeLoadingDetail(normalizedPolicyId));

  const cachedDetailCard = _currentPortfolio.find(c => {
    const cardId = _normalizeDetailPolicyId(c.policy_id || c.서비스명 || c.policy_name);
    return cardId === normalizedPolicyId;
  });

  // 1) 방금 계산한 분석 캐시가 없을 때만 백엔드 상세 API를 사용한다.
  if (normalizedPolicyId && !cachedDetailCard) {
    try {
      if (await _checkBackend()) {
        renderDetail(await _fetchBackendDetail(normalizedPolicyId));
        return;
      }
    } catch(e) {
      console.warn('백엔드 상세 조회 실패, 로컬 상세로 대체합니다.', e);
    }
  }

  // 2) AI 분석 후 _currentPortfolio 캐시 사용
  const card = cachedDetailCard;
  if (card) {
    const pct   = card.수급확률 || card.eligibility_percent || 60;
    const css   = card._css || {};
    const color = css.progress_color || (pct>=80?'green':pct>=60?'blue':'orange');
    renderDetail(_localizeDetailData({
      policy_header: {
        policy_name:         card.서비스명 || card.policy_name || policyId,
        eligibility_percent: pct,
        progress_color:      color,
        icon:                card.icon || '📋',
        percent_class:       css.percent_class || 'mid',
        badge_label:         css.badge_label || '',
        badge_class:         css.badge_class || 'badge-blue',
        subtitle:            card.subtitle || '',
      },
      개인요약: card.개인요약 || card.personal_summary || '',
      issues: (card.탈락사유 !== undefined ? card.탈락사유 : null) || card.issues || _buildIssuesFromDB(card.서비스명 || card.policy_name),
      guides: card.해결방법 || card.guides || _buildGuidesFromDB(card.서비스명 || card.policy_name),
      summary_stats: {
        benefit_label:           card.benefit_label || '-',
        processing_period_label: '1~2개월',
        issue_count:             (card.탈락사유||[]).length || 1,
        source_label:            card.source_label || 'Gov24',
      },
    }, normalizedPolicyId));
    return;
  }

  // 3) _STATIC_DETAIL에 있으면 사용
  if (_STATIC_DETAIL[normalizedPolicyId] || _detailFromBlueprint(normalizedPolicyId)) {
    renderDetail(_localizeDetailData(_STATIC_DETAIL[normalizedPolicyId] || _makeLoadingDetail(normalizedPolicyId), normalizedPolicyId));
    return;
  }

  // 4) POLICY_DB 기반 동적 생성
  renderDetail(_localizeDetailData(_buildDetailFromDB(normalizedPolicyId), normalizedPolicyId));
}

// POLICY_DB slug 매칭
function _findPolicyBySlug(policyId) {
  const normalized = _normalizeDetailPolicyId(policyId);
  const wantedSlug = _slugPolicyName(normalized);
  return POLICY_DB.find(p => {
    const slug = _slugPolicyName(p.서비스명 || '');
    return slug === wantedSlug || p.서비스명 === normalized;
  });
}

// POLICY_DB → issue-item 생성
function _buildIssuesFromDB(policyName) {
  const p = POLICY_DB.find(r => r.서비스명 === policyName);
  if (!p) return [{ icon:'ℹ️', html:'<strong>분석 전:</strong> 상단 분석 버튼을 눌러 AI 수급 가능성 분석을 실행하세요.' }];
  const issues = [];
  if (p.선정기준) issues.push({ icon:'📋', html:`<strong>선정 기준:</strong> ${p.선정기준.substring(0,100)}${p.선정기준.length>100?'…':''}` });
  if (p.지원대상) issues.push({ icon:'👤', html:`<strong>지원 대상:</strong> ${p.지원대상.substring(0,100)}${p.지원대상.length>100?'…':''}` });
  if (!issues.length) issues.push({ icon:'ℹ️', html:'<strong>분석 전:</strong> 상단 분석 버튼을 눌러 AI 수급 가능성 분석을 실행하세요.' });
  return issues;
}

// POLICY_DB → guide-item 생성
function _buildGuidesFromDB(policyName) {
  const p = POLICY_DB.find(r => r.서비스명 === policyName);
  if (!p) return [
    { icon:'✅', html:'<strong>1단계: AI 분석 실행</strong> — 상단 "수급 가능성 AI 분석 시작하기" 버튼을 누르세요.' },
    { icon:'🔗', html:'<strong>2단계: 복지로 신청</strong> — <a href="https://www.bokjiro.go.kr" target="_blank" style="color:var(--blue)">bokjiro.go.kr</a>에서 신청하세요.' },
  ];
  const guides = [];
  if (p.신청방법) guides.push({ icon:'📋', html:`<strong>1단계: 신청 방법</strong> — ${p.신청방법}` });
  if (p.접수기관) guides.push({ icon:'🏛️', html:`<strong>2단계: 접수 기관</strong> — ${p.접수기관}` });
  if (p.신청기한) guides.push({ icon:'📅', html:`<strong>신청 기한</strong> — ${p.신청기한}` });
  const url = p.상세조회url || 'https://www.bokjiro.go.kr';
  guides.push({ icon:'🚀', html:`<strong>${guides.length+1}단계: 온라인 신청</strong> — <a href="${url}" target="_blank" style="color:var(--blue)">${url.replace('https://','').split('/')[0]}</a>에서 신청 ${p.전화문의?'/ 문의: '+p.전화문의:''}` });
  return guides;
}

// POLICY_DB → 전체 detailData 생성
function _buildDetailFromDB(policyId) {
  const p = _findPolicyBySlug(policyId);
  const policyName = p?.서비스명 || policyId;
  const iconMap = {'현금':'💰','이용권':'🎫','서비스':'🛎️','주거':'🏠','고용':'💼','교육':'🎓','의료':'🏥','노인':'👴','장애인':'♿','가족':'👨‍👩‍👧','기초생활':'🛡️','금융':'🏦','창업':'🚀','보건':'💊'};
  const icon = p ? (iconMap[p.지원유형]||iconMap[p.서비스분야]||'📋') : '📋';
  let benefitLabel = '-';
  if (p?.지원내용) {
    const m = p.지원내용.match(/(최대|월|연)?\s*([\d,]+)\s*만\s*원/);
    if (m) benefitLabel = `${m[1]?m[1]+' ':''}${m[2]}만원`;
  }
  return {
    policy_header: { policy_name: policyName, eligibility_percent: 60, progress_color: 'blue', icon,
      percent_class: 'mid', badge_label: '⚡ 확인 필요', badge_class: 'badge-blue',
      subtitle: p ? `${p.서비스분야||''} · ${p.지원유형||''}`.replace(/^ · | · $/,'') : '' },
    issues:  _buildIssuesFromDB(policyName),
    guides:  _buildGuidesFromDB(policyName),
    summary_stats: { benefit_label: benefitLabel, processing_period_label: '1~2개월', issue_count: 1,
      source_label: p ? (p.소관기관명||'Gov24').substring(0,6) : 'Gov24' },
  };
}

function _makeFallbackDetail(policyId) {
  return _buildDetailFromDB(policyId);
}

// ── 포트폴리오 화면 렌더링 ────────────────────────────────────
async function loadPortfolio() {
  _renderPortfolioStatic();
}

function _renderPortfolioData(data) {
  const hero = data.portfolio_hero;

  // hero 총 수혜액
  const bigNum = document.querySelector('.portfolio-hero .big-num');
  if (bigNum) bigNum.textContent = hero.total_expected_benefit_label;

  // hero 설명 p 태그 (두 번째 p)
  const heroPs = document.querySelectorAll('.portfolio-hero p');
  if (heroPs.length >= 2) heroPs[1].textContent = hero.portfolio_basis_label;
  else if (heroPs.length === 1) heroPs[0].textContent = hero.portfolio_basis_label;

  // hero 배지: 즉시 신청 N건 / 조건 보완 후 M건
  const heroBadges = document.querySelectorAll('.portfolio-hero span');
  if (heroBadges.length >= 2) {
    heroBadges[0].textContent = `✅ 즉시 신청 가능 ${hero.ready_count}건`;
    heroBadges[1].textContent = `⚡ 조건 보완 후 ${hero.conditional_count}건`;
  }

  // port-grid 카드 렌더링
  const portGrid = document.querySelector('.port-grid');
  if (portGrid) {
    const statusBadge = s =>
      s === 'ready'       ? '<span class="badge badge-green">즉시 신청</span>' :
      s === 'conditional' ? '<span class="badge badge-blue">조건 확인 필요</span>' :
                            '<span class="badge badge-orange">조건 부족</span>';

    const cards = data.portfolio_items.map(item => `
      <div class="port-grid-card" onclick="showDetail('${item.policy_id}')" style="cursor:pointer;">
        <div class="icon">${item.icon}</div>
        <h4>${item.policy_name}</h4>
        <div class="amount">${item.expected_benefit_label}</div>
        <div class="period">${item.benefit_period_label}</div>
        <div style="margin-top:10px;">${statusBadge(item.status)}</div>
      </div>`).join('');

    // 마지막에 "정책 더 추가하기" 카드 유지
    portGrid.innerHTML = cards + `
      <div class="port-grid-card" style="background:var(--gray-50);border-style:dashed;cursor:pointer;" onclick="showTab('dashboard')">
        <div class="icon">➕</div>
        <h4 style="color:var(--gray-500);">정책 더 보기</h4>
        <div class="amount" style="color:var(--gray-300);font-size:14px">대시보드로 이동</div>
        <div class="period" style="color:var(--gray-400)">전체 목록 확인</div>
      </div>`;
  }

  // CTA 섹션
  const ctaH3 = document.querySelector('.cta-text h3');
  const ctaP  = document.querySelector('.cta-text p');
  if (ctaH3) ctaH3.textContent = data.portfolio_cta.headline;
  if (ctaP)  ctaP.textContent  = data.portfolio_cta.description;
}

// 백엔드 없을 때 하드코딩 정적 화면 유지 (기존 HTML 그대로)
function _renderPortfolioStatic() {
  // runAnalysis 후 _currentPortfolio 캐시가 있으면 그걸로 렌더링
  if (_currentPortfolio && _currentPortfolio.length > 0) {
    const statusBadge = s =>
      s === 'ready'       ? '<span class="badge badge-green">즉시 신청</span>' :
      s === 'conditional' ? '<span class="badge badge-blue">조건 확인 필요</span>' :
                            '<span class="badge badge-orange">조건 부족</span>';

    const portGrid = document.querySelector('.port-grid');
    if (portGrid) {
      const cards = _currentPortfolio.map(card => {
        const score  = card.수급확률 || card.eligibility_percent || 0;
        const name   = card.서비스명 || card.policy_name || '';
        const status = score >= 80 ? 'ready' : score >= 60 ? 'conditional' : 'blocked';
        return `
          <div class="port-grid-card" onclick="showDetail('${card.policy_id}')" style="cursor:pointer;">
            <div class="icon">${card.icon || '📋'}</div>
            <h4>${escHtml(name)}</h4>
            <div class="amount">${escHtml(card.benefit_label || '-')}</div>
            <div class="period">${escHtml(card.subtitle || '-')}</div>
            <div style="margin-top:10px;">${statusBadge(status)}</div>
          </div>`;
      }).join('');
      portGrid.innerHTML = cards + `
        <div class="port-grid-card" style="background:var(--gray-50);border-style:dashed;cursor:pointer;" onclick="showTab('dashboard')">
          <div class="icon">➕</div>
          <h4 style="color:var(--gray-500);">정책 더 보기</h4>
          <div class="amount" style="color:var(--gray-300);font-size:14px">대시보드로 이동</div>
          <div class="period" style="color:var(--gray-400)">전체 목록 확인</div>
        </div>`;
    }
  }
  // 정적 HTML 카드는 그대로 두고 아무것도 안 함
}

// ── runAnalysis: API 호출로 교체 ─────────────────────────────
async function runAnalysis() {
  const overlay = document.getElementById('aiLoading');
  const startedAt = Date.now();
  overlay.classList.add('show');

  try {
    const payload = collectFormData();
    const data    = await apiFetch('/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    _currentQueryId  = data.query_id;
    // FastAPI: data.cards / 폴백: data.dashboard_data.recommendation_cards
    const rawCards = data.cards || data.dashboard_data?.recommendation_cards || [];

    // policy_id를 서비스명 기반 슬러그로 강제 정규화 (AI가 임의 ID 반환해도 일치 보장)
    _currentPortfolio = rawCards.map(card => {
      const name = card.서비스명 || card.policy_name || '';
      const slug = name.replace(/[^\w가-힣]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      if (!card._css) card._css = _scoreToCSS(card.수급확률 || card.eligibility_percent || 60);
      return { ...card, policy_id: slug || card.policy_id };
    });
    _savePortfolio(_currentPortfolio); // 페이지 이동 후에도 유지

    renderDashboard(data.dashboard_data);

    // 진행바 재애니메이션
    document.querySelectorAll('.progress-fill').forEach(bar => {
      const w = bar.style.width;
      bar.style.width = '0';
      setTimeout(() => { bar.style.width = w; }, 100);
    });

    showToast('분석이 완료되었습니다! ✅', 'success');

  } catch (e) {
    console.error('runAnalysis error:', e);
    const payload = collectFormData();
    const fallback = _fallbackAnalysisData(payload);
    _currentQueryId = fallback.query_id;
    _currentPortfolio = fallback.cards;
    _savePortfolio(_currentPortfolio);
    renderDashboard(fallback.dashboard_data);
    showToast('백엔드 분석 실패로 로컬 분석 결과를 표시합니다.', 'warning');
  } finally {
    const elapsed = Date.now() - startedAt;
    if (elapsed < 450) {
      await new Promise(resolve => setTimeout(resolve, 450 - elapsed));
    }
    overlay.classList.remove('show');
  }
}



function toggleCheck(el) {
  el.classList.toggle('done');
  const box = el.querySelector('.check-box');
  box.textContent = el.classList.contains('done') ? '✓' : '';
}

// ══════════════════════════════════════════════════════════════
// 검색 모듈 — DB 연동 버전
// ══════════════════════════════════════════════════════════════

let _searchLoading     = false;
let _dashSearchLoading = false;
const _perPage         = 20;

function initSearch() {
  document.getElementById('search-results').innerHTML   = '';
  document.getElementById('search-status').textContent = '';
  const pag = document.getElementById('search-pagination');
  if (pag) pag.style.display = 'none';

  const qw = document.getElementById('quick-tags');
  if (qw && !qw.dataset.init) {
    qw.dataset.init = '1';
    ['청년 월세','기초생활','실업급여','국민내일배움카드','노인 일자리','아동수당','장애인 지원','한부모 가족'].forEach(t => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = 'background:var(--gray-100);border:none;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit;transition:all .15s';
      b.onmouseover = () => b.style.background = 'var(--blue-light)';
      b.onmouseout  = () => b.style.background = 'var(--gray-100)';
      b.onclick = () => { document.getElementById('search-input').value = t; doSearch(); };
      qw.appendChild(b);
    });
  }

  // 대시보드에서 검색어를 넘겨받은 경우 자동 실행
  try {
    const pending = sessionStorage.getItem('benefic_search_query');
    if (pending) {
      sessionStorage.removeItem('benefic_search_query');
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = pending;
        doSearch();
        return;
      }
    }
  } catch(e) {}

  loadBrowse(1);
}

function initDashSearch() {}

async function loadBrowse(page = 1) {
  const wrap  = document.getElementById('search-browse-wrap');
  const list  = document.getElementById('browse-list');
  const pag   = document.getElementById('browse-pagination');
  const badge = document.getElementById('browse-total-badge');
  if (!wrap || !list) return;
  wrap.style.display = 'block';
  list.innerHTML = _loadingHTML('정책 목록을 불러오는 중...');
  try {
    const useBackend = await _checkBackend();
    let results = [], total = 0, totalPages = 1;
    if (useBackend) {
      const data = await apiFetch(`/browse?page=${page}&per_page=${_perPage}`);
      results = data.results||[]; total = data.total||0; totalPages = data.total_pages||1;
    } else {
      total = POLICY_DB.length; totalPages = Math.ceil(total/_perPage);
      results = POLICY_DB.slice((page-1)*_perPage, page*_perPage);
    }
    if (badge) badge.textContent = `(총 ${total.toLocaleString()}건)`;
    list.innerHTML = results.length ? results.map(_renderPolicyCard).join('') : _emptyHTML('정책이 없습니다.');
    if (pag) pag.innerHTML = _paginationHTML(page, totalPages, 'loadBrowse');
  } catch(e) {
    list.innerHTML = _errorHTML('목록 로드 실패: ' + e.message);
  }
}

async function doSearch(page = 1) {
  if (_searchLoading && page === 1) return;
  const q = (document.getElementById('search-input')?.value || '').trim();
  if (!q) {
    document.getElementById('search-results').innerHTML   = '';
    document.getElementById('search-status').textContent = '';
    document.getElementById('search-pagination').style.display = 'none';
    document.getElementById('search-browse-wrap').style.display = 'block';
    return;
  }
  _searchLoading = true;
  document.getElementById('search-browse-wrap').style.display = 'none';
  document.getElementById('search-status').textContent = '검색 중…';
  document.getElementById('search-results').innerHTML  = _loadingHTML('DB에서 검색 중...');
  document.getElementById('search-pagination').style.display = 'none';

  const isNatural = (q.length >= 10 && /\s/.test(q)) ||
                    /싶어|하고 싶|받고|알려|찾아|뭐가|어떤|어디서/.test(q);
  try {
    let results = [], statusMsg = '', total = 0, totalPages = 1;
    const useBackend = await _checkBackend();
    if (isNatural) {
      document.getElementById('search-status').textContent = '🤖 AI 분석 중…';
      let all = useBackend
        ? (await apiFetch('/search/natural?' + new URLSearchParams({q, top_k:100}))).results||[]
        : await localNaturalSearch(q, 100);
      total = all.length; totalPages = Math.ceil(total/_perPage)||1;
      results = all.slice((page-1)*_perPage, page*_perPage);
      statusMsg = `🤖 AI 검색 결과 ${total}건`;
    } else {
      if (useBackend) {
        const p = new URLSearchParams({keyword:q, limit:String(_perPage), offset:String((page-1)*_perPage)});
        const data = await apiFetch('/search/keyword?'+p.toString());
        results = data.results||[]; total = data.count||results.length;
        totalPages = Math.ceil(total/_perPage)||1; statusMsg = `DB 검색 결과 ${total}건`;
      } else {
        const all = localKeywordSearch(q,'','',500);
        total = all.length; totalPages = Math.ceil(total/_perPage)||1;
        results = all.slice((page-1)*_perPage, page*_perPage); statusMsg = `검색 결과 ${total}건`;
      }
      if (results.length < 5 && page === 1) {
        document.getElementById('search-status').textContent = '🤖 AI 보완 검색 중…';
        const extras = useBackend
          ? (await apiFetch('/search/natural?'+new URLSearchParams({q,top_k:20}))).results||[]
          : await localNaturalSearch(q, 20);
        const names = new Set(results.map(r=>r['서비스명']||r.서비스명));
        results = [...results, ...extras.filter(r=>!names.has(r['서비스명']||r.서비스명))];
        total = results.length; totalPages = 1;
        statusMsg = `검색 결과 ${total}건 (AI 보완 포함)`;
      }
    }
    document.getElementById('search-status').textContent = statusMsg;
    renderSearchResults(results);
    const pag = document.getElementById('search-pagination');
    if (pag && totalPages > 1) { pag.style.display='block'; pag.innerHTML=_paginationHTML(page,totalPages,'doSearch'); }
  } catch(e) {
    showToast('검색 오류: ' + e.message);
    document.getElementById('search-status').textContent = '';
    document.getElementById('search-results').innerHTML = _errorHTML(e.message);
  } finally { _searchLoading = false; }
}

async function doDashSearch() {
  const q = (document.getElementById('dash-search-input')?.value || '').trim();
  if (!q) { showToast('검색어를 입력하세요.'); return; }

  // 검색어를 sessionStorage에 저장한 뒤 search.html로 이동
  // (페이지 이동 후 main.js가 재실행되면서 아래 initSearch()가 이를 감지해 자동 검색)
  try { sessionStorage.setItem('benefic_search_query', q); } catch(e) {}
  window.location.href = 'search.html';
}

function _renderPolicyCard(p) {
  const name    = escHtml(p['서비스명']    ||p.서비스명    ||'-');
  const field   = escHtml(p['서비스분야']  ||p.서비스분야  ||'');
  const stype   = escHtml(p['지원유형']    ||p.지원유형    ||'');
  const org     = escHtml((p['소관기관명'] ||p.소관기관명  ||'Gov24').substring(0,14));
  const ddline  = escHtml(p['신청기한']    ||p.신청기한    ||'');
  const target  = p['지원대상']    ||p.지원대상    ||'';
  const content = p['지원내용']    ||p.지원내용    ||'';
  const tel     = escHtml(p['전화문의']    ||p.전화문의    ||'');
  const url     = escHtml(p['상세조회url'] ||p.상세조회url  ||'');
  const scorePct = p.score!==undefined ? Math.round(p.score*100) : null;
  const iconMap  = {'현금':'💰','이용권':'🎫','서비스':'🛎️','주거':'🏠','고용':'💼','교육':'🎓','의료':'🏥','노인':'👴','장애인':'♿','가족':'👨‍👩‍👧','기초생활':'🛡️','금융':'🏦','창업':'🚀','보건':'💊'};
  const icon = iconMap[stype]||iconMap[field]||'📋';
  const policyKey = (p['서비스명']||p.서비스명||'').replace(/\s+/g,'-');
  const isScrapped = _isScrapped(policyKey);
  return `<div class="policy-card-wrap" style="position:relative;margin-bottom:12px">
    <div class="policy-card mid">
      <!-- ✅ scrap-btn은 .policy-card 직계 자식으로 배치 (position:absolute 기준 보장) -->
      <button
        class="scrap-btn ${isScrapped ? 'active' : ''}"
        data-policy-id="${policyKey}"
        onclick="event.stopPropagation(); toggleScrap('${policyKey}', this)"
        title="${isScrapped ? '스크랩 해제' : '스크랩 저장'}"
        aria-label="${isScrapped ? '스크랩 해제' : '스크랩 저장'}"
      >${isScrapped ? '★' : '☆'}</button>
      <div class="policy-top-row">
        <div class="policy-left" style="padding-right:40px">
          <div class="policy-icon blue">${icon}</div>
          <div class="policy-meta">
            <h4>${name}</h4>
            <p>${field}${field&&stype?' · ':''}${stype}</p>
            <div class="policy-badges">
              <span class="badge badge-blue">${org}</span>
              ${ddline?`<span class="badge badge-gray">기한: ${ddline}</span>`:''}
              ${scorePct!==null?`<span class="badge badge-green">유사도 ${scorePct}%</span>`:''}
            </div>
          </div>
        </div>
      </div>
      ${target?`<p style="font-size:12px;color:var(--gray-500);margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100);line-height:1.6">${escHtml(target.substring(0,140))}${target.length>140?'…':''}</p>`:''}
      ${content?`<p style="font-size:12px;color:var(--blue);margin-top:6px;font-weight:600">💰 ${escHtml(content.substring(0,100))}${content.length>100?'…':''}</p>`:''}
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        ${tel?`<span style="font-size:11px;color:var(--gray-500)">📞 ${tel}</span>`:''}
        ${url?`<a href="${url}" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none;font-weight:600;margin-left:auto">🔗 상세 보기 →</a>`:''}
      </div>
    </div>
  </div>`;
}

function renderSearchResults(results) {
  const el = document.getElementById('search-results');
  if (!results||!results.length) { el.innerHTML=_emptyHTML('검색 결과가 없습니다'); return; }
  el.innerHTML = results.map(_renderPolicyCard).join('');
}

function _loadingHTML(msg){return`<div style="text-align:center;padding:40px 20px;color:var(--gray-500)"><div style="font-size:28px;margin-bottom:10px">⏳</div><p style="font-size:14px;font-weight:600">${msg}</p></div>`;}
function _emptyHTML(msg){return`<div style="text-align:center;padding:60px 20px;color:var(--gray-500)"><div style="font-size:40px;margin-bottom:12px">🔎</div><p style="font-size:15px;font-weight:600;margin-bottom:6px">${msg}</p><p style="font-size:13px">다른 키워드나 표현을 사용해보세요.</p></div>`;}
function _errorHTML(msg){return`<div style="text-align:center;padding:40px 20px;color:var(--red)"><div style="font-size:28px;margin-bottom:10px">⚠️</div><p style="font-size:13px">${escHtml(msg)}</p></div>`;}
function _paginationHTML(page,totalPages,fnName){
  if(totalPages<=1)return'';
  const s=a=>a?'background:var(--blue);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit':'background:var(--gray-100);color:var(--gray-700);border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit';
  const st=Math.max(1,page-2),en=Math.min(totalPages,page+2);
  let h='<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">';
  if(page>1)h+=`<button onclick="${fnName}(${page-1})" style="${s(false)}">‹ 이전</button>`;
  for(let i=st;i<=en;i++)h+=`<button onclick="${fnName}(${i})" style="${s(i===page)}">${i}</button>`;
  if(page<totalPages)h+=`<button onclick="${fnName}(${page+1})" style="${s(false)}">다음 ›</button>`;
  return h+'</div>';
}



function closeDashSearch() {
  document.getElementById('dash-search-results-wrap').classList.remove('visible');
  document.getElementById('dash-search-input').value = '';
  document.getElementById('dash-search-status').textContent = '';
  document.getElementById('dash-search-results').innerHTML = '';
}

// ── COMMUNITY MODULE ──
const CAT_LABELS = {
  popular: { label: '⭐ 인기글', cls: 'cat-popular' },
  qna:     { label: '❓ 질문',   cls: 'cat-qna' },
  review:  { label: '🎉 후기',   cls: 'cat-review' },
  regional:{ label: '📍 지역',   cls: 'cat-regional' },
  anonymous:{ label:'🤫 익명',   cls: 'cat-anonymous' },
  notice:  { label: '📢 공지',   cls: 'cat-notice' },
};

const SAMPLE_POSTS = [
  { id: 1, category: 'notice', title: '베네픽 커뮤니티 오픈 안내 🎉', content: '안녕하세요, 베네픽 팀입니다.\n드디어 복지 커뮤니티가 오픈되었습니다!\n\n수급 후기, 질문, 지역 정보 등 다양한 이야기를 나눠주세요.\n서로의 경험을 공유하면 더 많은 분들이 도움을 받을 수 있어요. 🙌', author: '베네픽팀', date: '2025-01-10', likes: 34, region: '' },
  { id: 2, category: 'review', title: '청년 월세 지원 드디어 받았어요!! 월 20만원 ㅠㅠ', content: '안녕하세요 서울 은평구에 사는 25살 취준생이에요.\n베네픽으로 수급 확률 92%라고 나와서 반신반이 하면서 신청했는데\n진짜로 승인됐습니다!!!\n\n전입신고 꼭 미리 해두셔야 해요. 저는 그거 때문에 한번 탈락했다가 다시 신청했거든요.\n다들 파이팅!', author: '은평구청년', date: '2025-01-12', likes: 87, region: '서울 은평구' },
  { id: 3, category: 'qna', title: '국민내일배움카드 소득 기준이 어떻게 되나요?', content: '안녕하세요! 취업준비 중인 28살입니다.\n베네픽에서 배움카드 수급 확률이 85%로 나왔는데\n혹시 소득 기준이 정확히 어떻게 되는지 아시는 분 계신가요?\n알바 수입이 있는데 괜찮을지 걱정돼요.', author: '취준생_희망', date: '2025-01-13', likes: 12, region: '' },
  { id: 4, category: 'regional', title: '부산 해운대구 청년지원센터 정보 공유해요', content: '부산 해운대구 거주 청년분들!\n해운대구 청년지원센터에서 별도 복지 상담을 무료로 해줍니다.\n주소: 해운대구청 3층\n운영시간: 평일 09:00-18:00\n\n베네픽이랑 같이 활용하면 진짜 많은 혜택 받을 수 있어요!', author: '해운대청년', date: '2025-01-14', likes: 31, region: '부산 해운대구' },
  { id: 5, category: 'anonymous', title: '복지 신청이 창피한 것 같아서 망설이고 있어요...', content: '주변에서 "너 그런 거 받아도 돼?"라는 시선이 신경 쓰여서\n받을 자격이 있는데도 신청을 못 하고 있어요.\n\n혹시 비슷한 경험 있으신 분 계신가요?\n어떻게 마음을 정리하셨는지 궁금해요.', author: '익명', date: '2025-01-15', likes: 55, region: '' },
  { id: 6, category: 'review', title: '청년도약계좌 개설 성공! 정부기여금 진짜 나오네요 👍', content: '드디어 청년도약계좌 개설했어요.\n베네픽에서 수급 확률 78%로 떠서 반신반의했는데 실제로 됐습니다.\n\n매달 70만원 납입하면 정부에서 최대 6% 기여금 추가로 줘요.\n5년 뒤에 목돈 만들 수 있을 것 같아서 너무 기대돼요!\n\n신청 팁: 은행 앱에서 바로 되니까 영업점 안 가도 됩니다 😊', author: '저축왕도전', date: '2025-02-03', likes: 64, region: '인천 남동구' },
  { id: 7, category: 'qna', title: '기초생활수급자인데 아르바이트 해도 되나요?', content: '현재 기초생활수급자로 생계급여 받고 있는데요.\n편의점 알바를 시작하려고 하는데 급여가 깎이거나 수급이 끊길까봐 걱정돼요.\n\n소득 공제 범위가 있다고 들었는데 정확히 얼마까지 괜찮은지\n아시는 분 계시면 답변 부탁드려요!', author: '알바고민중', date: '2025-02-07', likes: 28, region: '' },
  { id: 8, category: 'regional', title: '대구 수성구 복지관 무료 식사 & 돌봄 서비스 안내', content: '대구 수성구에 계신 어르신, 장애인분들께 알려드려요.\n수성구 복지관에서 매주 화·목 무료 점심 식사 제공하고 있고\n방문 돌봄 서비스도 신청 가능합니다.\n\n문의: 053-000-0000 (평일 9~18시)\n베네픽에서 관련 서비스 수급 확률도 꼭 확인해보세요!', author: '수성복지알리미', date: '2025-02-10', likes: 19, region: '대구 수성구' },
  { id: 9, category: 'review', title: '마음건강 바우처 10회 상담 다 받았어요 — 인생이 달라졌어요', content: '작년에 번아웃으로 너무 힘들었는데 베네픽에서 청년 마음건강 지원사업을 알게 됐어요.\n소득 기준 없이 신청 가능하다는 게 너무 다행이었어요.\n\n10회 상담 다 받고 나니까 정말 많이 회복됐습니다.\n망설이지 말고 신청하세요. 복지는 받을 자격이 있는 사람이 받는 거예요 💙', author: '회복중인나', date: '2025-02-14', likes: 112, region: '서울 마포구' },
  { id: 10, category: 'anonymous', title: '30대인데 청년 지원 다 끊기니까 너무 막막해요', content: '만 34세 지나면서 청년 관련 복지가 하나둘 사라지고 있어요.\n월세 지원도 끊기고 청년도약계좌도 이제 못 넣고...\n\n중장년 복지는 아직 해당 없고, 딱 사각지대에 낀 느낌이에요.\n비슷한 상황이신 분들 어떻게 대처하고 계세요?', author: '익명', date: '2025-02-18', likes: 76, region: '' },
  { id: 11, category: 'qna', title: '한부모 가정인데 아동양육비 외에 더 받을 수 있는 게 있을까요?', content: '혼자 아이 둘 키우고 있는 엄마예요.\n현재 아동양육비는 받고 있는데 베네픽에서 다른 혜택들도 뜨더라고요.\n\n교육급여, 의료급여, 에너지바우처 등 중복 수급 가능한지\n실제로 받아보신 분 계시면 경험 공유해주시면 너무 감사할 것 같아요!', author: '씩씩한엄마', date: '2025-03-01', likes: 43, region: '경기 수원시' },
  { id: 12, category: 'regional', title: '광주 북구 청년 창업 지원금 300만원 — 신청 마감 임박!', content: '광주 북구에 사시는 청년 창업자분들 주목!\n북구청에서 청년 창업 지원금 300만원 지원하는 사업 공고가 났어요.\n신청 마감이 이번 달 말이라 서두르셔야 해요.\n\n조건: 만 39세 이하 / 광주 북구 거주 or 사업장 / 창업 3년 이내\n자세한 건 북구청 경제과 062-000-0000으로 문의하세요!', author: '광주창업알리미', date: '2025-03-05', likes: 38, region: '광주 북구' },
];

let commPosts = [];
let currentFilter = 'all';
let currentDetailId = null;
let commSearchQuery = '';
let commSortMode = 'latest'; // 'latest' | 'popular' | 'comments'
let pendingDeleteId = null;

// 현재 로그인 유저 (관리자 여부 포함)
function getCurrentUser() {
  try {
    const u = JSON.parse(localStorage.getItem('benefic_user') || 'null');
    return u;
  } catch { return null; }
}

function isAdmin() {
  const u = getCurrentUser();
  return u && (u.role === 'admin' || u.email === 'admin@benefic.kr');
}

function canDeletePost(post) {
  // 관리자면 항상 허용
  if (isAdmin()) return true;
  // 로그인된 경우: 작성자명 일치
  const u = getCurrentUser();
  if (u && post.author === (u.name || '')) return true;
  // 비로그인이어도 직접 작성한 글 허용:
  // 1) Date.now() 기반 13자리 id (submitPost로 생성)
  // 2) submitPost의 하드코딩 author '남정현님' 과 일치
  if (String(post.id).length >= 13) return true;
  if (post.author === '남정현님') return true;
  return false;
}

const AI_TIPS = [
  '💡 청년 월세 지원은 전입신고가 필수! 신청 전 반드시 확인하세요.',
  '💡 국민내일배움카드는 취업자·재직자 모두 신청 가능합니다.',
  '💡 복지 혜택은 중복 수령이 가능한 경우가 많아요. 꼭 꼼꼼히 확인하세요!',
  '💡 청년도약계좌는 매월 70만원 납입 시 정부기여금 최대 6%를 받을 수 있어요.',
  '💡 마음건강 바우처는 소득과 무관하게 신청 가능합니다.',
];

const SAMPLE_VERSION = 'v2'; // 샘플 데이터 변경 시 버전 올리면 자동 초기화

function initComm() {
  const storedVersion = localStorage.getItem('benefic_posts_version');
  const stored = localStorage.getItem('benefic_posts');
  if (stored && storedVersion === SAMPLE_VERSION) {
    commPosts = JSON.parse(stored);
  } else {
    commPosts = JSON.parse(JSON.stringify(SAMPLE_POSTS));
    savePosts();
    localStorage.setItem('benefic_posts_version', SAMPLE_VERSION);
  }
  // AI tip rotation
  const tip = AI_TIPS[Math.floor(Math.random() * AI_TIPS.length)];
  const tipEl = document.getElementById('aiTip');
  if (tipEl) tipEl.textContent = tip;
}

function savePosts() {
  localStorage.setItem('benefic_posts', JSON.stringify(commPosts));
}

function getCatInfo(cat) {
  return CAT_LABELS[cat] || { label: cat, cls: 'cat-qna' };
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return diff + '일 전';
  return dateStr;
}

function filterComm(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.comm-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCommPosts();
}

// ── 검색 핸들러 ──────────────────────────────────────────────
function onCommSearch() {
  const input = document.getElementById('commSearchInput');
  commSearchQuery = (input?.value || '').trim();
  const clearBtn = document.getElementById('commSearchClear');
  if (clearBtn) clearBtn.style.display = commSearchQuery ? 'flex' : 'none';
  renderCommPosts();
}

function clearCommSearch() {
  const input = document.getElementById('commSearchInput');
  if (input) input.value = '';
  commSearchQuery = '';
  const clearBtn = document.getElementById('commSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderCommPosts();
}

// ── 정렬 드롭다운 토글 ────────────────────────────────────────
function toggleSortDropdown() {
  const btn = document.getElementById('sortBtn');
  const dd  = document.getElementById('sortDropdown');
  if (!btn || !dd) return;
  const isOpen = dd.classList.contains('open');
  dd.classList.toggle('open', !isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
}

function closeSortDropdown() {
  const btn = document.getElementById('sortBtn');
  const dd  = document.getElementById('sortDropdown');
  if (dd)  dd.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function selectSortOption(el) {
  const mode = el.dataset.sort;
  commSortMode = mode;

  // 체크 표시 업데이트
  document.querySelectorAll('#sortDropdown .sort-option').forEach(opt => {
    opt.classList.remove('active');
    const chk = opt.querySelector('.sort-check');
    if (chk) chk.remove();
  });
  el.classList.add('active');
  el.insertAdjacentHTML('beforeend',
    `<svg class="sort-check" viewBox="0 0 13 13" fill="none">
      <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );

  // 버튼 라벨 업데이트
  const labelEl = document.getElementById('currentSortText');
  if (labelEl) labelEl.textContent = el.textContent.trim();

  closeSortDropdown();
  renderCommPosts();
}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
  const container = document.getElementById('sortContainer');
  if (container && !container.contains(e.target)) closeSortDropdown();
});

// ── 정렬 핸들러 (하위 호환) ────────────────────────────────────
function setCommSort(mode, btn) {
  commSortMode = mode;
  renderCommPosts();
}

function renderCommPosts() {
  const listEl = document.getElementById('commPostList');
  const emptyEl = document.getElementById('commEmpty');
  if (!listEl) return;

  // 1️⃣ 카테고리 필터
  let filtered = currentFilter === 'all' ? [...commPosts]
    : currentFilter === 'popular' ? commPosts.filter(p => p.likes >= 20)
    : commPosts.filter(p => p.category === currentFilter);

  // 2️⃣ 실시간 키워드 검색 (제목 + 내용 + 지역, 대소문자 무시)
  if (commSearchQuery) {
    const kw = commSearchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(kw) ||
      (p.content || '').toLowerCase().includes(kw) ||
      (p.region || '').toLowerCase().includes(kw)
    );
  }

  // 3️⃣ 정렬
  if (commSortMode === 'latest') {
    filtered.sort((a, b) => (b.timestamp || b.date || '') > (a.timestamp || a.date || '') ? 1 : -1);
  } else if (commSortMode === 'popular') {
    filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (commSortMode === 'comments') {
    filtered.sort((a, b) => (b.comments || 0) - (a.comments || 0));
  } else if (commSortMode === 'regional') {
    filtered.sort((a, b) => (b.region ? 1 : 0) - (a.region ? 1 : 0));
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    // 검색어가 있는 경우 no-result 메시지 업데이트
    const titleEl = emptyEl.querySelector('[data-i18n="comm_empty_title"]');
    const descEl  = emptyEl.querySelector('[data-i18n="comm_empty_desc"]');
    if (commSearchQuery) {
      if (titleEl) { titleEl.removeAttribute('data-i18n'); titleEl.textContent = _t('search_no_result') || '검색 결과가 없습니다'; }
      if (descEl)  { descEl.removeAttribute('data-i18n');  descEl.textContent  = `"${commSearchQuery}" 에 해당하는 글이 없어요.`; }
    } else {
      if (titleEl) { titleEl.setAttribute('data-i18n','comm_empty_title'); titleEl.textContent = _t('comm_empty_title') || '아직 게시글이 없어요'; }
      if (descEl)  { descEl.setAttribute('data-i18n','comm_empty_desc');   descEl.textContent  = _t('comm_empty_desc')  || '첫 번째 글을 작성해 보세요!'; }
    }
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = filtered.map(post => {
      const cat = getCatInfo(post.category);
      return `
        <div class="comm-post-card" onclick="showCommDetail(${post.id})">
          <span class="comm-post-cat-badge ${cat.cls}">${cat.label}</span>
          <div class="comm-post-body">
            <h4>${highlightKeyword(escHtml(post.title), commSearchQuery)}</h4>
            <p>${highlightKeyword(escHtml(post.content.substring(0, 80)), commSearchQuery)}${post.content.length > 80 ? '...' : ''}</p>
            <div class="comm-post-meta">
              <span class="comm-meta-item author">👤 ${escHtml(post.author)}</span>
              ${post.region ? `<span class="comm-meta-item">📍 ${highlightKeyword(escHtml(post.region), commSearchQuery)}</span>` : ''}
              <span class="comm-meta-item">🕐 ${timeAgo(post.date)}</span>
            </div>
          </div>
          <div class="comm-post-right">
            <div class="comm-stats">
              <span class="comm-stat">❤️ ${post.likes}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  renderHotList('hotPostList');
  updateStats();
}

// 검색어 하이라이트 헬퍼
function highlightKeyword(html, kw) {
  if (!kw) return html;
  const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(${safe})`, 'gi'), '<mark class="comm-highlight">$1</mark>');
}

// i18n 단순 조회 헬퍼 (i18n.js 로드 이후 사용)
function _t(key) {
  try {
    const lang = typeof loadLang === 'function' ? loadLang() : 'ko';
    return (TRANSLATIONS[lang] || TRANSLATIONS['ko'] || {})[key] || '';
  } catch { return ''; }
}

function renderHotList(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const hot = [...commPosts].sort((a,b) => b.likes - a.likes).slice(0, 5);
  el.innerHTML = hot.map((p, i) => `
    <div class="hot-item" onclick="showCommDetail(${p.id})">
      <span class="hot-num">${i+1}</span>
      <span class="hot-title">${escHtml(p.title)}</span>
      <span class="hot-likes">❤️${p.likes}</span>
    </div>`).join('');
}

function updateStats() {
  if (!document.getElementById("statTotal")) return;
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('statTotal').textContent = commPosts.length;
  document.getElementById('statToday').textContent = commPosts.filter(p => p.date === today).length;
  document.getElementById('statLikes').textContent = commPosts.reduce((s,p) => s + p.likes, 0);
}

function showCommDetail(id) {
  currentDetailId = id;
  const post = commPosts.find(p => p.id === id);
  if (!post) return;
  const cat = getCatInfo(post.category);
  const likedKey = 'liked_' + id;
  const isLiked = localStorage.getItem(likedKey);
  const canDel = canDeletePost(post);

  document.getElementById('commDetailCard').innerHTML = `
    <div class="comm-detail-meta">
      <span class="comm-post-cat-badge ${cat.cls}">${cat.label}</span>
      ${post.region ? `<span class="comm-meta-item">📍 ${escHtml(post.region)}</span>` : ''}
      <span class="comm-meta-item author">👤 ${escHtml(post.author)}</span>
      <span class="comm-meta-item">🕐 ${timeAgo(post.date)}</span>
      ${canDel ? `<button class="comm-delete-btn detail-delete-btn" onclick="openDeleteModal(${id})">🗑️ 삭제</button>` : ''}
    </div>
    <h2>${escHtml(post.title)}</h2>
    <div class="comm-detail-content">${escHtml(post.content)}</div>
    <button class="comm-like-btn ${isLiked ? 'liked' : ''}" id="likeBtn" onclick="toggleLike(${id})">
      ${isLiked ? '❤️' : '🤍'} 좋아요 <span id="likeCount">${post.likes}</span>
    </button>
  `;

  renderHotList('hotPostList2');
  document.getElementById('comm-list-view').style.display = 'none';
  document.getElementById('comm-detail-view').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 삭제 모달 ────────────────────────────────────────────────
function openDeleteModal(id) {
  pendingDeleteId = id;
  document.getElementById('deleteModalBg').classList.add('open');
}

function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById('deleteModalBg')) return;
  closeDeleteModalDirect();
}

function closeDeleteModalDirect() {
  document.getElementById('deleteModalBg').classList.remove('open');
  pendingDeleteId = null;
}

function confirmDelete() {
  if (pendingDeleteId === null) return;
  const idx = commPosts.findIndex(p => p.id === pendingDeleteId);
  if (idx !== -1) commPosts.splice(idx, 1);
  savePosts();
  closeDeleteModalDirect();

  // 목록 or 상세에서 삭제 후 처리
  const detailView = document.getElementById('comm-detail-view');
  if (detailView && detailView.style.display !== 'none') {
    showCommList();
  } else {
    renderCommPosts();
  }

  // 성공 토스트
  showToast(_t('delete_success') || '삭제되었습니다.', 'success');
}

function showCommList() {
  document.getElementById('comm-list-view').style.display = 'block';
  document.getElementById('comm-detail-view').style.display = 'none';
  renderCommPosts();
}

function toggleLike(id) {
  const post = commPosts.find(p => p.id === id);
  if (!post) return;
  const likedKey = 'liked_' + id;
  const isLiked = localStorage.getItem(likedKey);
  if (isLiked) {
    post.likes = Math.max(0, post.likes - 1);
    localStorage.removeItem(likedKey);
  } else {
    post.likes += 1;
    localStorage.setItem(likedKey, '1');
  }
  savePosts();
  showCommDetail(id);
}

function openWriteModal() {
  document.getElementById('writeModalBg').classList.add('open');
  document.getElementById('modalTitle').focus();
}

function closeWriteModal(e) {
  if (e.target === document.getElementById('writeModalBg')) closeWriteModalDirect();
}

function closeWriteModalDirect() {
  document.getElementById('writeModalBg').classList.remove('open');
  document.getElementById('modalTitle').value = '';
  document.getElementById('modalContent').value = '';
  document.getElementById('modalRegion').value = '';
}

function submitPost() {
  const title = document.getElementById('modalTitle').value.trim();
  const content = document.getElementById('modalContent').value.trim();
  const cat = document.getElementById('modalCat').value;
  const region = document.getElementById('modalRegion').value.trim();

  if (!title) { alert('제목을 입력해주세요.'); return; }
  if (!content) { alert('내용을 입력해주세요.'); return; }

  const u = getCurrentUser();
  const authorName = u ? (u.name + '님') : '남정현님';

  const newPost = {
    id: Date.now(),
    category: cat,
    title,
    content,
    author: authorName,
    date: new Date().toISOString().slice(0,10),
    timestamp: new Date().toISOString(),
    likes: 0,
    region,
  };
  commPosts.push(newPost);
  savePosts();
  closeWriteModalDirect();

  // show list view if in detail
  if (document.getElementById('comm-detail-view').style.display !== 'none') {
    showCommList();
  } else {
    currentFilter = 'all';
    document.querySelectorAll('.comm-filter-btn').forEach((b,i) => {
      b.classList.toggle('active', i === 0);
    });
    renderCommPosts();
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Init community on page load
initComm();

// community.html 직접 접근 시 자동 렌더링
(function() {
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  if (currentPage === 'community.html') {
    renderCommPosts();
    // insight widget 초기화
    const p = document.getElementById('iStatPosts');
    const l = document.getElementById('iStatLikes');
    if (p) p.textContent = commPosts.length;
    if (l) l.textContent = commPosts.reduce((s, post) => s + post.likes, 0);
    insightAnimateBars();
    // FAB 표시
    const fab = document.getElementById('fabWrite');
    if (fab) fab.classList.add('visible');
  }
})();

// ── INSIGHT WIDGET ──
const INSIGHT_REVIEWS = [
  { text: '신청이 생각보다 정말 간편해요!', tag: '#청년월세지원 · 은평구청년' },
  { text: '서류 준비 팁: 주민등록등본이 핵심!', tag: '#내일배움카드 · 취준생_희망' },
  { text: '베네픽 덕분에 몰랐던 혜택 발견했어요.', tag: '#소득세감면 · 익명' },
  { text: '월 20만원 지원 실제로 받았습니다 ㅠㅠ', tag: '#청년월세지원 · 서울청년' },
  { text: '복지 신청, 당연한 권리예요. 망설이지 마세요!', tag: '#익명고민 · 익명' },
];
let insightIdx = 0;

function insightRenderReviews() {
  const list = document.getElementById('iReviewList');
  const dots = document.getElementById('iNavDots');
  if (!list || !dots) return;
  const r1 = INSIGHT_REVIEWS[insightIdx];
  const r2 = INSIGHT_REVIEWS[(insightIdx + 1) % INSIGHT_REVIEWS.length];
  list.innerHTML = [r1, r2].map(r => `
    <div class="insight-review-item">
      <div class="insight-review-text">${r.text}</div>
      <span class="insight-review-tag">${r.tag}</span>
    </div>`).join('');
  dots.innerHTML = INSIGHT_REVIEWS.map((_, i) =>
    `<div class="insight-dot${i === insightIdx ? ' active' : ''}" onclick="insightIdx=${i};insightRenderReviews()"></div>`
  ).join('');
}

function insightAnimateBars() {
  setTimeout(() => { const b = document.getElementById('iBar1'); if(b) b.style.width='85%'; }, 100);
  setTimeout(() => { const b = document.getElementById('iBar2'); if(b) b.style.width='62%'; }, 250);
  setTimeout(() => { const b = document.getElementById('iBar3'); if(b) b.style.width='45%'; }, 400);
}

function insightRefresh() {
  ['iBar1','iBar2','iBar3'].forEach(id => { const b = document.getElementById(id); if(b) b.style.width='0%'; });
  setTimeout(insightAnimateBars, 150);
  insightIdx = (insightIdx + 1) % INSIGHT_REVIEWS.length;
  insightRenderReviews();
  const p = document.getElementById('iStatPosts');
  const l = document.getElementById('iStatLikes');
  if(p) p.textContent = commPosts.length;
  if(l) l.textContent = commPosts.reduce((s,p) => s + p.likes, 0);
}

function insightInit() {
  insightRenderReviews();
  insightAnimateBars();
  setInterval(() => { insightIdx = (insightIdx + 1) % INSIGHT_REVIEWS.length; insightRenderReviews(); }, 4000);
}
insightInit();

// ── Language Selector ──
function toggleLangDropdown() {
  const btn = document.getElementById('langBtn');
  const dd = document.getElementById('langDropdown');
  if (!btn || !dd) return;
  const isOpen = dd.classList.contains('visible');
  if (isOpen) {
    dd.classList.remove('visible');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  } else {
    dd.classList.add('visible');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

// NOTE: selectLanguage is fully overridden by i18n.js (loaded after this file).
// This stub handles the UI-only part in case i18n.js hasn't loaded yet.
function selectLanguage(el, langDisplay) {
  document.querySelectorAll('#langDropdown .lang-option').forEach(opt => {
    opt.classList.remove('active');
    const chk = opt.querySelector('.lang-check');
    if (chk) chk.remove();
  });
  el.classList.add('active');
  el.insertAdjacentHTML('beforeend',
    `<svg class="lang-check" viewBox="0 0 13 13" fill="none">
      <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );
  const label = document.getElementById('currentLangLabel');
  if (label) label.textContent = langDisplay;
  setTimeout(() => {
    const dd = document.getElementById('langDropdown');
    const btn = document.getElementById('langBtn');
    if (dd) dd.classList.remove('visible');
    if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  }, 150);
}

document.addEventListener('click', (e) => {
  const sel = document.getElementById('langSelector');
  if (!sel) return;
  if (!sel.contains(e.target)) {
    const dd = document.getElementById('langDropdown');
    const btn = document.getElementById('langBtn');
    if (dd) dd.classList.remove('visible');
    if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  }
});

// ── ONBOARDING GUIDE ──────────────────────────────────────────
function initOnboarding() {
  const guideEl = document.getElementById('onboardingGuide');
  if (!guideEl) return;
  let seen;
  try { seen = localStorage.getItem('benefic_seen_guide'); } catch(e) {}
  if (!seen) {
    // slight delay so page renders first
    setTimeout(() => guideEl.classList.add('visible'), 400);
  }
}

function closeOnboarding() {
  const guideEl = document.getElementById('onboardingGuide');
  if (guideEl) guideEl.classList.remove('visible');
}

function closeOnboardingForever() {
  try { localStorage.setItem('benefic_seen_guide', 'true'); } catch(e) {}
  closeOnboarding();
}

// ── 서류 카드 토글 (체크/해제) ─────────────────────────────────
// 주의: window.load 콜백 내부에 선언하면 화살표함수 스코프에 갇혀
//       HTML onclick에서 ReferenceError가 발생함 → 전역 스코프로 이동
function toggleDocCard(el, originalText) {
  const p = el.querySelector('.doc-info p');
  const status = el.querySelector('.doc-status');
  if (el.classList.contains('ready')) {
    el.classList.remove('ready');
    status.textContent = '⬜';
    p.removeAttribute('data-i18n');
    p.textContent = originalText;
  } else {
    el.classList.add('ready');
    status.textContent = '✅';
    p.removeAttribute('data-i18n');
    p.textContent = '✅ 준비 완료';
  }
}

// Animate bars on load
window.addEventListener('load', () => {
  document.querySelectorAll('.progress-fill').forEach((bar, i) => {
    const finalW = bar.style.width;
    bar.style.width = '0';
    setTimeout(() => {
      bar.style.width = finalW;
    }, 300 + i * 120);
  });
  initDashSearch();
  initOnboarding();

  // 현재 페이지에 맞는 초기화 실행
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  if (currentPage === 'search.html') {
    initSearch();
  }
  if (currentPage === 'analysis.html') {
    const pid = (() => { try { return localStorage.getItem('benefic_detail_id'); } catch(e) { return null; } })();
    if (pid) {
      // 복원 즉시 삭제 — showDetail 내 showTab('detail')이 다시 analysis.html로
      // 이동 → 재복원 → 무한 루프가 생기는 것을 차단
      try { localStorage.removeItem('benefic_detail_id'); } catch(e) {}
      showDetail(pid);
    }
  }
});

// ══════════════════════════════════════════════════════════════
// 베네픽 v2.0 — 인증 & 아바타 드롭다운 시스템
// ══════════════════════════════════════════════════════════════

// 현재 로그인 유저 정보 가져오기 (localStorage 기반)
function getAuthUser() {
  try {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('benefic_user');
    if (token && user) return JSON.parse(user);
    if (token) return { name: '사용자', initial: '나' };
  } catch(e) {}
  return null;
}

// 아바타 드롭다운 열기/닫기
function toggleAvatarDropdown() {
  const dd = document.getElementById('avatarDropdown');
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  // 다른 드롭다운 닫기 (언어 등)
  document.querySelectorAll('.lang-dropdown').forEach(el => el.classList.remove('open'));
  dd.classList.toggle('open', !isOpen);
}

// 외부 클릭 시 닫기
document.addEventListener('click', function(e) {
  const avatarWrap = document.querySelector('.nav-avatar-wrap');
  if (avatarWrap && !avatarWrap.contains(e.target)) {
    const dd = document.getElementById('avatarDropdown');
    if (dd) dd.classList.remove('open');
  }
});

// 로그아웃
function doLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
  window.location.href = 'login.html';
}

// 페이지 로드 시 아바타 영역 초기화
function initAuthNav() {
  const wrap = document.querySelector('.nav-avatar');
  if (!wrap) return;

  const user = getAuthUser();

  if (user) {
    // 프로필 카드 이름·아바타 업데이트 (localStorage 원본 그대로)
    const profileName   = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileName)   profileName.textContent   = user.name || '사용자';
    if (profileAvatar) profileAvatar.textContent = user.initial || user.name?.[0] || '나';

    // 로그인 상태: 아바타 + 드롭다운
    wrap.outerHTML = `
      <div class="nav-avatar-wrap" onclick="toggleAvatarDropdown()">
        <div class="nav-avatar" style="cursor:pointer;">
          <div class="avatar-circle">${user.initial || user.name?.[0] || '나'}</div>
          <span class="avatar-name">${user.name || '사용자'}님</span>
          <span>▾</span>
        </div>
        <div class="avatar-dropdown" id="avatarDropdown">
          <div class="avatar-dropdown-inner">
            <div class="avatar-dd-header">
              <div class="avatar-dd-circle">${user.initial || user.name?.[0] || '나'}</div>
              <div>
                <div class="avatar-dd-name">${user.name || '사용자'}님</div>
                <div class="avatar-dd-email">${user.email || ''}</div>
              </div>
            </div>
            <div class="avatar-dd-divider"></div>
            <a href="scrap.html" class="avatar-dd-item" data-i18n="nav_scrap">스크랩</a>
            <a href="portfolio.html" class="avatar-dd-item" data-i18n="nav_user_portfolio">내 포트폴리오</a>
            <a href="profile.html" class="avatar-dd-item" data-i18n="nav_user_profile">👤 개인정보 수정</a>
            <a href="recently-viewed.html" class="avatar-dd-item" data-i18n="nav_user_recently">🕒 최근 본 공고</a>
            <div class="avatar-dd-divider"></div>
            <div class="avatar-dd-item logout" onclick="doLogout()" data-i18n="nav_user_logout">🚪 로그아웃</div>
          </div>
        </div>
      </div>`;
    // Re-apply i18n to newly injected dropdown
    if (typeof applyTranslations === 'function' && typeof loadLang === 'function') {
      try { applyTranslations(loadLang()); } catch(e) {}
    }
  } else {
    // 비로그인: 로그인 버튼
    wrap.outerHTML = `
      <div class="nav-avatar-wrap">
        <a href="login.html" class="btn-login-nav">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          로그인
        </a>
      </div>`;
  }

  // ── 하단 탭바 프로필 탭 링크 분기 ──
  // 로그인 → mypage.html, 비로그인 → login.html
  _updateTabBarProfileLink(user);
}

// 하단 탭바의 마지막(프로필) 탭을 로그인 상태에 따라 분기
function _updateTabBarProfileLink(user) {
  const tabBar = document.querySelector('.tab-bar');
  if (!tabBar) return;

  const profileTab = tabBar.querySelector('[data-tab="profile"]');
  if (!profileTab) return;

  if (user) {
    // 로그인 → mypage.html + 아바타 이니셜 표시
    profileTab.href = 'mypage.html';
    const svgEl = profileTab.querySelector('svg');
    if (svgEl) {
      svgEl.outerHTML = `<div class="tab-avatar-badge">${user.initial || user.name?.[0] || '나'}</div>`;
    }
  } else {
    // 비로그인 → login.html + '로그인' 텍스트
    profileTab.href = 'login.html';
    const spanEl = profileTab.querySelector('span');
    if (spanEl) spanEl.textContent = '로그인';
  }
}

// login.html 에서 로그인 성공 후 유저 정보 저장 (login.html에서 호출)
function saveAuthUser(token, userData) {
  localStorage.setItem('token', token);
  localStorage.setItem('benefic_user', JSON.stringify(userData));
}

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', initAuthNav);


// ══════════════════════════════════════════════════════════════
// 비로그인 잠금 오버레이 — checkLoginStatus & applyLockOverlay
// ══════════════════════════════════════════════════════════════

/**
 * 현재 로그인 상태 확인
 * @returns {boolean} 로그인 여부
 */
function checkLoginStatus() {
  try {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('benefic_user');
    return !!(token && user);
  } catch (e) {
    return false;
  }
}

/**
 * 비로그인 시 대상 요소에 잠금 오버레이를 주입한다.
 * - .is-locked 클래스로 pointer-events 차단
 * - .locked-overlay 로 blur + 안내 문구 표시
 * - data-i18n="login_required" 속성으로 다국어 처리
 *
 * @param {string} targetSelector  잠글 요소의 CSS 셀렉터
 * @param {object} [options]       옵션 (loginUrl: 로그인 페이지 경로)
 */
function applyLockOverlay(targetSelector, options = {}) {
  const loginUrl = options.loginUrl || 'login.html';

  document.querySelectorAll(targetSelector).forEach(target => {
    // 이미 처리된 요소 건너뜀
    if (target.classList.contains('is-locked')) return;

    target.classList.add('is-locked');

    // i18n 키로 현재 언어 텍스트 가져오기 (i18n.js 전역 함수 활용)
    let msgText  = '로그인이 필요한 서비스입니다';
    let btnText  = '🔑 로그인하기';
    try {
      const lang = (typeof loadLang === 'function') ? loadLang() : 'ko';
      if (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[lang]) {
        msgText = TRANSLATIONS[lang].login_required || msgText;
        btnText = TRANSLATIONS[lang].login_btn      || btnText;
      }
    } catch (e) { /* fallback to ko default */ }

    const overlay = document.createElement('div');
    overlay.className = 'locked-overlay';
    overlay.innerHTML = `
      <div class="locked-content">
        <div class="locked-icon">🔒</div>
        <p class="locked-msg" data-i18n="login_required">${msgText}</p>
        <a href="${loginUrl}" class="btn-lock-login" data-i18n="login_btn">${btnText}</a>
      </div>`;

    target.appendChild(overlay);
  });
}

/**
 * 비로그인 상태일 때 주요 대시보드 카드들을 잠근다.
 * 잠글 대상: 나의 수급 현황 / 추천 포트폴리오 / 맞춤 추천 서비스
 * (신청 체크리스트는 잠그지 않음 — 비민감 UI)
 */
function initLockOverlays() {
  if (checkLoginStatus()) return;   // 로그인 상태면 아무것도 하지 않음

  // 비로그인 시 상단 프로필 카드(.profile-card)만 잠금
  applyLockOverlay('.profile-card', { loginUrl: 'login.html' });
}

// DOMContentLoaded 시 자동 실행 (initAuthNav 이후 동작 보장)
document.addEventListener('DOMContentLoaded', () => {
  // initAuthNav가 먼저 실행된 뒤 잠금 처리
  requestAnimationFrame(initLockOverlays);
});
