const TAB_PAGE_MAP = {
  'dashboard':       '/',
  'search':          '/search',
  'detail':          '/analysis',
  'portfolio':       '/portfolio',
  'apply':           '/apply',
  'community':       '/community',
  'profile':         '/profile',
  'recently-viewed': '/recently-viewed',
  'scrap':           '/scrap',
};

function showTab(tab) {
  const page = TAB_PAGE_MAP[tab];
  if (page) {
    window.location.href = page;
    return;
  }
}

// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
// 甕곗쥓苑??API ?????곷섧??v2.1
// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름

// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
// 甕곗쥓苑??v2.3 ??Claude AI 筌욊낯???怨뺣짗 (獄쏄퉮肉???븍뜇釉??
// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름

// ?袁⑹삺 ?브쑴苑??紐꾨?
let _currentQueryId = null;

function _getCurrentLang() {
  try {
    const lang = localStorage.getItem('benefic_lang') || 'ko';
    return ['ko', 'en', 'zh', 'ja', 'vi'].includes(lang) ? lang : 'ko';
  } catch (e) {
    return 'ko';
  }
}

// _currentPortfolio: localStorage ?怨몃꺗??(??륁뵠筌왖 ??猷??袁⑸퓠???醫?)
function _savePortfolio(data) {
  try { localStorage.setItem('benefic_portfolio', JSON.stringify(data)); } catch(e) {}
}

const DETAIL_CARD_KEY = 'benefic_detail_card';

function _findPortfolioCard(policyId) {
  const id = String(policyId || '');
  if (!id) return null;
  return (_currentPortfolio || []).find(card => {
    const cardId = String(card?.policy_id || '');
    const cardName = String(card?.??뺥돩??살구 || card?.policy_name || '');
    return cardId === id || cardName === id;
  }) || null;
}

function _cacheDetailCard(policyId, card) {
  if (!card) return;
  try {
    localStorage.setItem(DETAIL_CARD_KEY, JSON.stringify({ policy_id: policyId, card }));
  } catch(e) {}
}

function _loadDetailCard(policyId) {
  try {
    const saved = JSON.parse(localStorage.getItem(DETAIL_CARD_KEY) || 'null');
    const card = saved?.card;
    if (!card) return null;
    const id = String(policyId || '');
    const savedId = String(saved.policy_id || card.policy_id || '');
    const cardName = String(card.??뺥돩??살구 || card.policy_name || '');
    if (!id || savedId === id || cardName === id) return card;
  } catch(e) {}
  return null;
}

// ?닌됱쒔??slug 疫꿸퀡而?policy_id) 嚥≪뮇類??쎈꽅?귐? ?類ｂ봺 1??筌띾뜆?졿뉩紐껋쟿??곷?function _migrateLegacyDetailStorage() {
  const MIGRATION_KEY = 'benefic_detail_migration_v2';
  try {
    if (localStorage.getItem(MIGRATION_KEY) === '1') return;

    // ?⑥눊援?癒?뮉 ??ъ쁽揶쎛 ??용뮉 policy_id????????筌? ?袁⑹삺 獄쏄퉮肉??policy_id??    // ?얜챷???곸뵬 ????됱몵沃샕嚥?癰귣똻???뺣뼄. ?????롢늺 ?怨멸쉭 ?브쑴苑???륁뵠筌왖揶쎛 疫꿸퀡????묐탣嚥???λ선筌욊쑬??
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch (e) {
    // ignore
  }
}

function _scoreToCSS(score) {
  if (score >= 80) return { card_class:'top', percent_class:'high', progress_color:'green', badge_class:'badge-green', badge_label:'??鈺곌퀗援??겸뫗?? };
  if (score >= 60) return { card_class:'mid', percent_class:'mid', progress_color:'blue', badge_class:'badge-blue', badge_label:'???類ㅼ뵥 ?袁⑹뒄' };
  return { card_class:'low', percent_class:'low', progress_color:'orange', badge_class:'badge-orange', badge_label:'?醫묓닔 鈺곌퀗援??봔鈺? };
}

function _buildDashboardSummary(cards = [], fallback = '?곕뗄荑??類ㅼ퐠???類ㅼ뵥??뤾쉭??') {
  const names = cards
    .map(card => card?.??뺥돩??살구 || card?.policy_name || '')
    .map(name => String(name || '').trim())
    .filter(Boolean)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .slice(0, 3);

  if (!names.length) return fallback;
  return `?온???類ㅼ퐠 ?袁⑤궖??${names.join(', ')} ?源놁뿯??덈뼄. ?怨멸쉭 ?遺용튋 ??밴쉐??筌왖?怨뺣┷???怨쀪퐨 ?곕뗄荑?野껉퀗?든몴??믪눘? 癰귣똻肉??뺚뵲??덈뼄.`;
}

function _extractBenefitAmount(label = '') {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(/(?:????筌ㅼ뮆?)?\s*\d[\d,]*(?:\.\d+)?\s*(?:??筌띾슣??筌??????뜚|筌ｌ뮇??/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function _formatDashboardBenefitLabel(rawValue, cards = []) {
  const direct = _extractBenefitAmount(rawValue);
  if (direct) return direct;

  const candidates = Array.isArray(cards) ? cards : [];
  for (const card of candidates) {
    const amount = _extractBenefitAmount(
      card?.benefit_amount_label ||
      card?.benefit_label ||
      card?.benefit_summary ||
      card?.筌왖?癒?땀??||
      ''
    );
    if (amount) return amount;
  }

  return '?類ㅼ퐠癰??怨몄뵠';
}

function _loadPortfolio() {
  try {
    const s = localStorage.getItem('benefic_portfolio');
    if (!s) return [];
    const arr = JSON.parse(s);
    // _css ?袁⑥뵭 ???????
    return arr.map(card => {
      if (!card._css) card._css = _scoreToCSS(card.??랁닋?類ｌぇ || card.eligibility_percent || 60);
      return card;
    });
  } catch(e) { return []; }
}
_migrateLegacyDetailStorage();
let _currentPortfolio = _loadPortfolio();  // ?브쑴苑?野껉퀗??筌?Ŋ??(??륁뵠筌왖 揶??⑤벊?)

// ???? ??볥럢 ?⑤벀?ц퉪?? ?類ㅼ퐠 ?怨쀬뵠?怨뺤퓢??곷뮞 (??곸삢) ????????????????????????????????????
const POLICY_DB = [
  { ??뺥돩??살구:'筌????遺욧쉭 ??뽯뻻 ?諛명롳쭪???, ??뺥돩??삵뀋??'雅뚯눊援?, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'???쀦뤃癒곕꽰?봔', 筌왖?癒???'筌?19~34???얜똻竊??筌??? ?봔筌뤴뫁? 癰귢쑬猷?椰꾧퀣竊? ?遺욧쉭 60筌띾슣????꾨릭', ?醫롮젟疫꿸퀣?:'餓λ쵐????굣 60% ??꾨릭, ?癒???餓λ쵐????굣 100% ??꾨릭', ?醫롪퍕獄쎻뫖苡?'癰귣벊?嚥??癒?뮉 雅뚯눖???녠숲', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'1600-0777', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'??筌ㅼ뮆? 20筌띾슣?? 筌ㅼ뮆? 12揶쏆뮇??筌왖?? },
  { ??뺥돩??살구:'?????곸뵬獄쏄퀣?燁삳?諭?, ??뺥돩??삵뀋??'?⑥쥙??, 筌왖?癒????'??곸뒠亦?, ???疫꿸퀗?筌?'?⑥쥙??紐껊짗?봔', 筌왖?癒???'??쇰씜?? ??곸춦 ??됱젟?? ??쑴?숁뉩?뽰춦, ??ｋ┛域뱀눖以?? ?癒?겫??놁쁽', ?醫롮젟疫꿸퀣?:'??彛??餓???? ??뽰뇚, ?⑥쥙?????彛????뽰뇚', ?醫롪퍕獄쎻뫖苡?'?⑥쥙??4(work24.go.kr) ??ㅼ뵬???醫롪퍕', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'1350', ?怨멸쉭鈺곌퀬?턷rl:'https://www.work24.go.kr', 筌왖?癒?땀??'??덉졃??筌ㅼ뮆? 500筌띾슣?? ?癒???15~55%' },
  { ??뺥돩??살구:'筌???袁⑸튋?④쑴伊?, ??뺥돩??삵뀋??'疫뀀뜆??, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'疫뀀뜆??袁⑹뜚??, 筌왖?癒???'筌?19~34?? 揶쏆뮇????굣 6,000筌띾슣????꾨릭, 揶쎛?닌딅꺖??餓λ쵐??180% ??꾨릭', ?醫롮젟疫꿸퀣?:'癰귣쵐肉???꾨뻬疫꿸퀗而?筌ㅼ뮆? 6????뽰뇚, 筌욊낯??3??疫뀀뜆????굣?ル굟鍮?⑥눘苑???뽰뇚', ?醫롪퍕獄쎻뫖苡?'???????癒?뮉 ?怨몃씜??, ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?醫롪퍕 揶쎛???遺얩?筌뤴뫁彛?', ?袁れ넅?얜챷??'1332', ?怨멸쉭鈺곌퀬?턷rl:'https://www.fsc.go.kr', 筌왖?癒?땀??'??筌ㅼ뮆? 70筌띾슣????뱀뿯 ???類?疫꿸퀣肉ф묾?筌ㅼ뮆? 6%, 5??筌띾슡由?筌ㅼ뮆? 5,000筌띾슣?? },
  { ??뺥돩??살구:'筌???筌띾뜆?у쳞?우뺏 筌왖?癒?텢??, ??뺥돩??삵뀋??'癰귣떯援?, 筌왖?癒????'??곸뒠亦?, ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'筌?19~34??筌??? ???굣 疫꿸퀣? ??곸벉', ?醫롮젟疫꿸퀣?:'????怨룸뼖 ?袁⑹뒄 筌??? ?類ㅻ뻿椰꾨떯而?癰귣벊???녠숲 ???怨몄쁽 ?怨쀪퐨', ?醫롪퍕獄쎻뫖苡?'?類ㅻ뻿椰꾨떯而?퉪????녠숲 ?癒?뮉 筌왖?癒?퍥 ?얜챷??, ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻(??됯텦 ???춭 ??筌띾뜃而?', ?袁れ넅?얜챷??'1577-0199', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'?袁ⓓ????怨룸뼖 ?怨뚯퍢 10????沅?筌왖?? 1???뼣 筌ㅼ뮆? 8筌띾슣?? },
  { ??뺥돩??살구:'筌??덌㎕?뚮씜?????놃꺍', ??뺥돩??삵뀋??'筌≪럩毓?, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'餓λ쵐?쇠린?쇱퓗疫꿸퀣毓썽겫?', 筌왖?癒???'筌?39????꾨릭 ??덊돩筌≪럩毓???癒?뮉 筌≪럩毓?3????沅?, ?醫롮젟疫꿸퀣?:'筌≪럩毓??袁⑹뵠??癰귣똻?, ??毓썸④쑵?????뽱뀱, ??뺤첒夷뚳쭖?곸젔 ??沅????궢', ?醫롪퍕獄쎻뫖苡?'K-Startup ??딅읂??? ??ㅼ뵬???臾믩땾', ?醫롪퍕疫꿸퀬釉?'??1???⑤벀??癰귣똾??1~2??', ?袁れ넅?얜챷??'1357', ?怨멸쉭鈺곌퀬?턷rl:'https://www.k-startup.go.kr', 筌왖?癒?땀??'筌≪럩毓쏙쭪??癒?닊 筌ㅼ뮆? 1???뜚, ??龜?⑤벀而숈쮯筌롮꼹?쀯쭕???볥궗' },
  { ??뺥돩??살구:'疫꿸퀣???븐넞癰귣똻????룻롦묾?깅연', ??뺥돩??삵뀋??'疫꿸퀣???븐넞', 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'???굣?紐꾩젟??れ뵠 疫꿸퀣? 餓λ쵐????굣 30% ??꾨릭 揶쎛??, ?醫롮젟疫꿸퀣?:'?봔?臾믪벥?얜똻??疫꿸퀣? ?袁れ넅 ?怨몄뒠, ??沅쏆쮯???굣 ?ル굟鍮 ??沅?, ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲 獄쎻뫖揆 ?醫롪퍕, 癰귣벊?嚥???ㅼ뵬???醫롪퍕', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'129', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'1??揶쎛????筌ㅼ뮆? 713,102??2024??疫꿸퀣?)' },
  { ??뺥돩??살구:'疫꿸퀣???븐넞癰귣똻??雅뚯눊援끾묾?깅연', ??뺥돩??삵뀋??'雅뚯눊援?, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'???쀦뤃癒곕꽰?봔', 筌왖?癒???'???굣?紐꾩젟??疫꿸퀣? 餓λ쵐????굣 48% ??꾨릭 揶쎛??, ?醫롮젟疫꿸퀣?:'?袁⑷컧揶쎛?? 疫꿸퀣??袁???????쇱젫 ?袁⑷컧??筌왖疫? ?癒?揶쎛?? ??뤾퐨??筌왖??, ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲 獄쎻뫖揆 ?癒?뮉 癰귣벊?嚥??醫롪퍕', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'1600-0777', ?怨멸쉭鈺곌퀬?턷rl:'https://www.myhome.go.kr', 筌왖?癒?땀??'??뽰뒻 1??揶쎛????筌ㅼ뮆? 341,000?? },
  { ??뺥돩??살구:'??쇰씜疫뀀맩肉??닌딆춦疫뀀맩肉?', ??뺥돩??삵뀋??'?⑥쥙??, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'?⑥쥙??紐껊짗?봔', 筌왖?癒???'??곸춦 ??18揶쏆뮇??餓???곕궖????μ맄疫꿸퀗而?180????곴맒, ??쑴?꾥쳸?뽰읅 ??곸춦??, ?醫롮젟疫꿸퀣?:'?怨대젅???닌딆춦??뺣짗 ??롊? ???????뺣짗 ?紐꾩젟 疫꿸퀣? ?겸뫗??, ?醫롪퍕獄쎻뫖苡?'?⑥쥙??4 ??ㅼ뵬???醫롪퍕 ???⑥쥙???녠숲 獄쎻뫖揆', ?醫롪퍕疫꿸퀬釉?'??곸춦????쇱벉 ?醫???12揶쏆뮇????沅?, ?袁れ넅?얜챷??'1350', ?怨멸쉭鈺곌퀬?턷rl:'https://www.work24.go.kr', 筌왖?癒?땀??'??곸춦 ?????뇧?袁㏉닊 60%, 筌ㅼ뮇??1??63,104??筌ㅼ뮆? 66,000?? },
  { ??뺥돩??살구:'?袁⑤짗??롫뼣', ??뺥돩??삵뀋??'揶쎛鈺?, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'筌?8??沃섎챶彛?0~95揶쏆뮇?? ?袁⑤짗', ?醫롮젟疫꿸퀣?:'???굣夷??沅?疫꿸퀣? ??곸뵠 ?怨뺤죯 鈺곌퀗援뷂쭕??겸뫗???롢늺 筌왖疫?, ?醫롪퍕獄쎻뫖苡?'癰귣벊?嚥? ?類?24, 雅뚯눖???녠숲', ?醫롪퍕疫꿸퀬釉?'?곗뮇源??곗쨮?봔??60????沅??醫롪퍕 ?????닋 筌왖疫?, ?袁れ넅?얜챷??'129', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'??10筌띾슣??筌왖疫? },
  { ??뺥돩??살구:'???筌뤴몿?鈺??袁⑤짗?臾믪몓??, ??뺥돩??삵뀋??'揶쎛鈺?, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'??苑?첎?鈺곌퉭?', 筌왖?癒???'???굣 疫꿸퀣? 餓λ쵐????굣 63% ??꾨릭 ???筌뤴몿?鈺? 筌?18??沃섎챶彛??癒?', ?醫롮젟疫꿸퀣?:'???筌?揶쎛???紐꾩젟, ???굣夷??沅???沅?, ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲 獄쎻뫖揆 ?醫롪퍕', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'1577-2514', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'?袁⑤짗 1?紐껊뼣 ??21筌띾슣??2024??疫꿸퀣?)' },
  { ??뺥돩??살구:'?紐꾩뵥 疫꿸퀣??怨뚰닊', ??뺥돩??삵뀋??'?紐꾩뵥', 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'筌?65????곴맒, ???굣??륁맄 70% ??꾨릭 ?????, ?醫롮젟疫꿸퀣?:'??ㅻ즴揶쎛???????굣?紐꾩젟??202筌띾슣????꾨릭(2024??', ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲, ????怨뚰닊?⑤벉?? 癰귣벊?嚥?, ?醫롪퍕疫꿸퀬釉?'筌?65????뱀뵬 1揶쏆뮇???袁????醫롪퍕 揶쎛??, ?袁れ넅?얜챷??'1355', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'??ㅻ즴揶쎛??筌ㅼ뮆? ??334,810??2024??' },
  { ??뺥돩??살구:'?關釉????뺣짗筌왖?癒?퐣??쑴??, ??뺥돩??삵뀋??'?關釉??, 筌왖?癒????'??뺥돩??, ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'筌?6??筌?65??沃섎챶彛??關釉?? ?關釉?源껎닋 1~3疫?, ?醫롮젟疫꿸퀣?:'??뺣짗筌왖???紐꾩젟鈺곌퀣沅??癒?땾 42????곴맒', ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲 獄쎻뫖揆 ?醫롪퍕', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'129', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'??뺣짗筌왖?癒?닋????筌ㅼ뮆? 1,869筌ｌ뮇???닌덉퍢癰?筌△뫀踰?' },
  { ??뺥돩??살구:'筌????곸뵬???곕벚?롩넫?, ??뺥돩??삵뀋??'疫뀀뜆??, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'筌?19~34????랁닋?癒껊９媛?怨몄맄 筌??? ???굣 疫꿸퀣? 餓λ쵐????굣 100% ??꾨릭 域뱀눖以덉쮯??毓???굣??, ?醫롮젟疫꿸퀣?:'疫꿸퀣? 餓λ쵐????굣 50% ??꾨릭 揶쎛???怨쀪퐨, 域뱀눖以덉쮯??毓???굣 ??10筌띾슣????곴맒', ?醫롪퍕獄쎻뫖苡?'癰귣벊?嚥???ㅼ뵬???癒?뮉 雅뚯눖???녠숲', ?醫롪퍕疫꿸퀬釉?'??1???⑤벀??癰귣똾??5~6??', ?袁れ넅?얜챷??'129', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'癰귣챷???怨룐뵲 ??10筌띾슣?????類? 筌왖?癒?닊 ??10~30筌띾슣??筌띲끉臾? 3??筌띾슡由? },
  { ??뺥돩??살구:'????館釉경묾???볥럢?館釉????', ??뺥돩??삵뀋??'?대Ŋ??, 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'?대Ŋ?곲겫?', 筌왖?癒???'??沅???????釉?? ???굣 疫꿸퀣? ?겸뫗???, ?醫롮젟疫꿸퀣?:'???굣?브쑴??1~8?닌덉퍢, ?源놁읅 疫꿸퀣?(C??덉젎 ??곴맒), ??沅???????釉?, ?醫롪퍕獄쎻뫖苡?'??볥럢?館釉??????딅읂???(www.kosaf.go.kr)', ?醫롪퍕疫꿸퀬釉?'??녿┛癰??醫롪퍕(2??8??', ?袁れ넅?얜챷??'1599-2000', ?怨멸쉭鈺곌퀬?턷rl:'https://www.kosaf.go.kr', 筌왖?癒?땀??'???굣 1~3?닌덉퍢 ?袁⑸만, 4?닌덉퍢 390筌띾슣?? 8?닌덉퍢 67.5筌띾슣????녿┛??' },
  { ??뺥돩??살구:'?癒곗넞域뱀눖以??毓?, ??뺥돩??삵뀋??'?⑥쥙??, 筌왖?癒????'??뺥돩??, ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'疫꿸퀣???븐넞??랁닋??獄?筌△뫁湲?袁㏉롳㎘?餓?域뱀눖以?貫???, ?醫롮젟疫꿸퀣?:'?癒곗넞??녠숲 ?怨룸뼖 ???癒곗넞 筌〓챷肉???뤾텢 ??덈뮉 ??, ?醫롪퍕獄쎻뫖苡?'筌왖?????뽮쉽???癒?뮉 雅뚯눖???녠숲', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'129', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'域뱀눖以??醫륁굨癰?疫뀀맩肉???뽰삢?? 筌ㅼ뮇??袁㏉닊 100%, 域뱀눖以?醫??? 筌ㅼ뮇??袁㏉닊 80%)' },
  { ??뺥돩??살구:'疫뀀떯?믦퉪??筌왖??, ??뺥돩??삵뀋??'疫꿸퀣???븐넞', 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'?袁㏓┛?怨뱀넺 獄쏆뮇源??곗쨮 ??룻?醫? ?ⓦ끇???揶쎛??, ?醫롮젟疫꿸퀣?:'揶쏅쵐???살쑎????쇱춦夷뚳쭪?덊앹쮯???????袁㏓┛???, ???굣夷??沅?疫꿸퀣?', ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲 ?癒?뮉 癰귣벊??봔 ?怨룸뼖 ?袁れ넅', ?醫롪퍕疫꿸퀬釉?'?袁㏓┛??? 獄쏆뮇源?筌앸맩??, ?袁れ넅?얜챷??'129', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'??룻롳쭪???1??揶쎛????683,400?? ??롮┷夷뚥틠?④탢夷뚧뤃癒?몓筌왖?????怨뚰? },
  { ??뺥돩??살구:'??뿅?遺?鈺?獄쎻뫖揆?대Ŋ???뺥돩??, ??뺥돩??삵뀋??'揶쎛鈺?, 筌왖?癒????'??뺥돩??, ???疫꿸퀗?筌?'??苑?첎?鈺곌퉭?', 筌왖?癒???'野껉퀬??????獄?域뮤?遺우쁽嚥??닌딄쉐????뿅?遺?鈺?, ?醫롮젟疫꿸퀣?:'??껊럢 5????꾨릭 ?怨쀪퐨 筌왖?? ??볥럢???대Ŋ??沃섎챷???륁쁽', ?醫롪퍕獄쎻뫖苡?'??뿅?遺?鈺곌퉮??癒?쉽???醫롪퍕', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'1577-1366', ?怨멸쉭鈺곌퀬?턷rl:'https://www.mogef.go.kr', 筌왖?癒?땀??'??볥럢??욱꺍??ㅻ８?筌뤴몿???ㅻ９?????븐넞筌왖????揶쎛?類ｊ컩???대Ŋ????뺥돩????볥궗' },
  { ??뺥돩??살구:'?紐꾩뵥 ??깆쁽??獄??????뺣짗 筌왖?癒?텢??, ??뺥돩??삵뀋??'?紐꾩뵥', 筌왖?癒????'?袁㏉닊', ???疫꿸퀗?筌?'癰귣떯援붻퉪???봔', 筌왖?癒???'筌?65????곴맒(??? ??毓?60????곴맒), 疫꿸퀣??怨뚰닊 ??랁닋???怨쀪퐨', ?醫롮젟疫꿸퀣?:'?⑤벊??鍮㏓９沅???퐣??쑴??鍮㏓９??館?????醫륁굨癰?癰귢쑬猷?疫꿸퀣?', ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲, ?紐꾩뵥癰귣벊??온, ??뺣빍??꾧깻??, ?醫롪퍕疫꿸퀬釉?'?怨쀭겧 ?⑤벀??1~2??雅뚯눖以??臾믩땾)', ?袁れ넅?얜챷??'1577-1389', ?怨멸쉭鈺곌퀬?턷rl:'https://www.bokjiro.go.kr', 筌왖?癒?땀??'?⑤벊?????27筌띾슣?? ?????뺥돩??쎌굨 ??78.2筌띾슣??2024??疫꿸퀣?)' },
  { ??뺥돩??살구:'筌????띯뫁毓?源껊궗???텕筌왖', ??뺥돩??삵뀋??'?⑥쥙??, 筌왖?癒????'??뺥돩??, ???疫꿸퀗?筌?'?⑥쥙??紐껊짗?봔', 筌왖?癒???'筌?18~34??沃섎챷???筌????醫롮??? 餓λ쵐????굣 60% ??꾨릭, ??れ??? ???굣 ?얜떯?)', ?醫롮젟疫꿸퀣?:'?⑥쥙???녠숲 ?怨룸뼖 ??筌〓챷肉?野껉퀣?? ?띯뫁毓???? ?類ㅼ뵥', ?醫롪퍕獄쎻뫖苡?'?⑥쥙??4(work24.go.kr) ?癒?뮉 ?⑥쥙???녠숲 獄쎻뫖揆', ?醫롪퍕疫꿸퀬釉?'?怨쀬㉦ ?怨몃뻻', ?袁れ넅?얜챷??'1350', ?怨멸쉭鈺곌퀬?턷rl:'https://www.work24.go.kr', 筌왖?癒?땀??'筌욊쑬?믪쮯野껋럥???블???롫뼣 25筌띾슣?? ??덉졃??롫뼣 ??筌ㅼ뮆? 28.4筌띾슣?? ?띯뫁毓??貫??묾?筌ㅼ뮆? 150筌띾슣?? },
  { ??뺥돩??살구:'?癒?섐筌왖獄쏅뗄??㎗?, ??뺥돩??삵뀋??'疫꿸퀣???븐넞', 筌왖?癒????'??곸뒠亦?, ???疫꿸퀗?筌?'?怨쀫씜???맒?癒?뜚?봔', 筌왖?癒???'疫꿸퀣???븐넞??랁닋??餓??紐꾩뵥夷?怨몄??苑룸９??醫롮뵥夷?袁⑷텦?봔夷뚥빳臾믪쵄筌욌뜇?????釉?揶쎛??, ?醫롮젟疫꿸퀣?:'?癒?섐筌왖 ?띯뫁鍮잍④쑴留??遺쎄탷 ?겸뫗?? ???굣 疫꿸퀣? ?겸뫗??, ?醫롪퍕獄쎻뫖苡?'雅뚯눖???녠숲 獄쎻뫖揆 ?醫롪퍕', ?醫롪퍕疫꿸퀬釉?'筌띲끇??5~6???醫롪퍕', ?袁れ넅?얜챷??'1600-3190', ?怨멸쉭鈺곌퀬?턷rl:'https://www.energyv.or.kr', 筌왖?癒?땀??'1??揶쎛???怨뚯퍢 筌ㅼ뮆? 95,000?? 揶쎛?닌딆뜚??獄??④쑴????怨뺤뵬 筌△뫀踰? },
];

// ???? 野꺜???怨밴묶 ????????????????????????????????????????????????????????????????????????????????????????????????
const _searchCache = {};

// ???? ?紐? LLM ?됰슢??怨? 筌욊낯???紐꾪뀱 筌△뫀????????????????????????????????????????????????????????
async function callClaudeSearch() {
  throw new Error('?됰슢??怨??癒?퐣 ?紐? LLM 筌욊낯???紐꾪뀱?? CORS/癰귣똻釉??類ㅼ퐠??곗쨮 ??쑵??源딆넅??뤿선 ??됰뮸??덈뼄.');
}

// ???? ??곸삢 DB 野꺜??(??쇱뜖??疫꿸퀡而? ????????????????????????????????????????????????????????????
function localKeywordSearch(keyword, category, supportType, limit = 20) {
  const kw = (keyword || '').toLowerCase();
  return POLICY_DB.filter(p => {
    const matchKw = !kw ||
      (p.??뺥돩??살구||'').toLowerCase().includes(kw) ||
      (p.筌왖?癒?땀??|'').toLowerCase().includes(kw) ||
      (p.筌왖?癒???|'').toLowerCase().includes(kw) ||
      (p.??뺥돩??삵뀋??|'').toLowerCase().includes(kw) ||
      (p.???疫꿸퀗?筌?|'').toLowerCase().includes(kw);
    const matchCat  = !category    || (p.??뺥돩??삵뀋??|'').includes(category);
    const matchType = !supportType || (p.筌왖?癒????|'').includes(supportType);
    return matchKw && matchCat && matchType;
  }).slice(0, limit);
}

// ???? AI ?癒?염??野꺜??(Claude ??뽰뒠) ????????????????????????????????????????????????????????
async function localNaturalSearch(query, topK = 15) {
  const cacheKey = query + topK;
  if (_searchCache[cacheKey]) return _searchCache[cacheKey];

  const dbSummary = POLICY_DB.map((p,i) =>
    `[${i}] ${p.??뺥돩??살구} / ${p.??뺥돩??삵뀋?? / ${p.筌왖?癒???? / ???? ${(p.筌왖?癒???|'').substring(0,60)}`
  ).join('\n');

  const prompt = `?諭??? ??볥럢 癰귣벊? ?類ㅼ퐠 野꺜???袁ⓓ?첎???낅빍??
??쇱벉?? 癰귣벊? ?類ㅼ퐠 ?怨쀬뵠?怨뺤퓢??곷뮞??낅빍??
${dbSummary}

?????野꺜??깅선: "${query}"

???類ㅼ퐠 餓??????野꺜??깅선?? 揶쎛???온????덈뮉 ?類ㅼ퐠???紐껊쑔??甕곕뜇?뉒몴?筌ㅼ뮆? ${topK}揶??ⓥ뫀???
?온??ㅻ즲 ?誘? ??뽰몵嚥?JSON 獄쏄퀣肉닸에?뺤춸 ?臾먮뼗??뤾쉭?? ?? [2, 7, 0, 14]
??삘뀲 ??살구 ??곸뵠 JSON 獄쏄퀣肉댐쭕??곗뮆???뤾쉭??`;

  try {
    const result = await callClaudeSearch(prompt);
    let indices = Array.isArray(result) ? result : (result.raw ? JSON.parse(result.raw) : []);
    const results = indices
      .filter(i => i >= 0 && i < POLICY_DB.length)
      .map(i => ({ ...POLICY_DB[i], score: 1 - (indices.indexOf(i) * 0.05) }));
    _searchCache[cacheKey] = results;
    return results;
  } catch(e) {
    // AI ??쎈솭 ????쇱뜖??野꺜??깆몵嚥???媛?
    return localKeywordSearch(query, '', '', topK);
  }
}

// ???? /analyze ??筌? 嚥≪뮇類??브쑴苑?獄쏄퉮肉??沃섎㈇????? ??????????????????????????????
async function localAnalyze(payload) {
  const age        = payload.age || payload.??륁뵠 || '';
  const region     = payload.region || payload.椰꾧퀣竊쒙쭪???|| '';
  const income     = payload.income_percent ? `餓λ쵐????굣 ${payload.income_percent}%` : (payload.income || payload.?怨쀫꺖??|| '');
  const family_type= payload.household_type || payload.揶쎛?닌딆???|| payload.family_type || '';
  const employment = payload.employment_status || payload.?⑥쥙??怨밴묶 || payload.employment || '';
  const disability = payload.disability || payload.?關釉??? || '??곸벉';
  const intent_tags = payload.intent_tags || [];

  const cacheKey = JSON.stringify(payload);
  if (_searchCache[cacheKey]) return _searchCache[cacheKey];

  const query = [region, age ? `筌?${age}?? : '', income, family_type, employment, disability, intent_tags.join(' '), '癰귣벊? 筌왖???類ㅼ퐠 ?곕뗄荑?]
    .filter(Boolean)
    .join(' ');
  const candidates = await localNaturalSearch(query, 5);
  const cards = candidates.map((p, index) => {
    const score = Math.max(55, 92 - index * 7);
    return {
      policy_id: (p.??뺥돩??살구 || '').replace(/[^\w揶쎛-??/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || `policy-${index + 1}`,
      ??뺥돩??살구: p.??뺥돩??살구 || `?곕뗄荑??類ㅼ퐠 ${index + 1}`,
      icon: p.??뺥돩??삵뀋??.includes('雅뚯눊援?) ? '?猷? : p.??뺥돩??삵뀋??.includes('?⑥쥙??) ? '?裕? : p.??뺥돩??삵뀋??.includes('?대Ŋ??) ? '??? : p.??뺥돩??삵뀋??.includes('疫뀀뜆??) ? '?猷? : p.??뺥돩??삵뀋??.includes('??롮┷') ? '?猷? : '?諭?,
      subtitle: `${p.??뺥돩??삵뀋??|| '癰귣벊?'} 夷?${p.筌왖?癒????|| '筌왖??}`,
      benefit_label: (p.筌왖?癒?땀??|| '').substring(0, 40) || '鈺곌퀗援??類ㅼ뵥 ?袁⑹뒄',
      source_label: (p.???疫꿸퀗?筌?|| 'BenePick').substring(0, 8),
      ??랁닋?類ｌぇ: score,
      ??덉뵭???: [],
      ??욧퍙獄쎻뫖苡? [],
      ?怨쀪퐨??뽰맄: index + 1,
      _css: _scoreToCSS(score),
    };
  });
  const avg = cards.length ? Math.round(cards.reduce((s, c) => s + (c.??랁닋?類ｌぇ || 0), 0) / cards.length) : 0;
  const result = {
    recommendation_cards: cards,
    stats: {
      ????類ㅼ퐠?? cards.length,
      ???뇧?類ｌぇ: avg,
      ??됯맒??묒굺?? _formatDashboardBenefitLabel('', cards),
      筌앸맩??醫롪퍕揶쎛?? cards.filter(c => (c.??랁닋?類ｌぇ || 0) >= 80).length,
    },
    summary: _buildDashboardSummary(
      cards,
      '獄쏄퉮肉???怨뚭퍙???븍뜆釉?類λ릭????곸삢 ?類ㅼ퐠 DB 疫꿸퀣???곗쨮 ?곕뗄荑??됰뮸??덈뼄. ??쎈뱜??곌쾿 ??됱젟 ??野껉퀗?든몴???쇰뻻 ?類ㅼ뵥??뤾쉭??'
    ),
  };
  _searchCache[cacheKey] = { dashboard_data: result, cards, query_id: Date.now().toString() };
  return _searchCache[cacheKey];
}

// ???? 燁삳똾?믤⑥쥓??筌뤴뫖以?獄쏆꼹??????????????????????????????????????????????????????????????????????????????????
function getLocalCategories() {
  const cats = [...new Set(POLICY_DB.map(p => p.??뺥돩??삵뀋??.filter(Boolean))].sort();
  return { categories: cats };
}

// ???? API 甕곗쥙?????쇱젟 ??????????????????????????????????????????????????????????????????????????????????????
const API_BASE = (() => {
  const qp = new URLSearchParams(window.location.search);
  const fromQuery = qp.get('api_base');
  const fromGlobal = window.BENEPICK_API_BASE || window.__BENEPICK_API_BASE;
  const fromStorage = localStorage.getItem('BENEPICK_API_BASE');
  const raw = fromQuery || fromGlobal || fromStorage;
  if (raw) return raw.replace(/\/+$/, '');
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
  return '';
})();
let _useBackend = null;
let _backendCheckedAt = 0;
const BACKEND_RECHECK_MS = 8000;
const STRICT_CORE_BACKEND = true;

async function _checkBackend(force = false) {
  const now = Date.now();
  if (!force && _useBackend === true) return true;
  if (!force && _useBackend === false && (now - _backendCheckedAt) < BACKEND_RECHECK_MS) {
    return false;
  }
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4500) });
    _useBackend = r.ok;
  } catch {
    _useBackend = false;
  }
  _backendCheckedAt = Date.now();
  return _useBackend;
}

function _toIncomeBand(percent) {
  const p = Number(percent || 55);
  if (p <= 60) return 'MID_50_60';
  if (p <= 80) return 'MID_60_80';
  return 'MID_80_100';
}

function _toHouseholdType(value) {
  const v = String(value || '');
  if (v.includes('1??) || v.includes('??ㅻ즴')) return 'SINGLE';
  if (v.includes('2??)) return 'TWO_PERSON';
  return 'MULTI_PERSON';
}

function _toEmploymentStatus(value) {
  const v = String(value || '');
  if (v.includes('?癒?겫')) return 'SELF_EMPLOYED';
  if (v.includes('?類?뇣筌?) || v.includes('??쑴?숁뉩?뽰춦') || v.includes('?띯뫁毓??)) return 'EMPLOYED';
  return 'UNEMPLOYED';
}

function _toRegionCode(regionName) {
  const map = {
    '??뽰뒻': 'KR-11', '?봔??: 'KR-26', '????: 'KR-27', '?紐꾩퓝': 'KR-28', '?용쵐竊?: 'KR-29', '????: 'KR-30', '?紐꾧텦': 'KR-31', '?紐꾩쪒': 'KR-36',
    '野껋럡由?: 'KR-41', '揶쏅벡??: 'KR-42', '?겸뫖??: 'KR-43', '?겸뫖沅?: 'KR-44', '?袁⑦꽴': 'KR-45', '?袁④텚': 'KR-46', '野껋럥??: 'KR-47', '野껋럥沅?: 'KR-48', '??뽳폒': 'KR-50',
  };
  const name = String(regionName || '');
  for (const [k, v] of Object.entries(map)) {
    if (name.includes(k)) return v;
  }
  return 'KR-11';
}

function _toAnalyzeRequest(payload = {}) {
  const regionName = payload.region || payload.region_name || payload.椰꾧퀣竊쒙쭪???|| '??뽰뒻?諛명??;
  return {
    age: Number(payload.age || 27),
    region_code: _toRegionCode(regionName),
    region_name: regionName,
    income_band: _toIncomeBand(payload.income_percent),
    household_type: _toHouseholdType(payload.household_type || payload.family_type),
    employment_status: _toEmploymentStatus(payload.employment_status || payload.employment),
    housing_status: 'MONTHLY_RENT',
    interest_tags: Array.isArray(payload.intent_tags) ? payload.intent_tags : [],
    lang_code: _getCurrentLang(),
  };
}

function _legacyCardFromPolicy(policy = {}, index = 0) {
  const score = Number(policy.match_score || 60);
  const serviceName = policy.policy_name || policy.title || `?곕뗄荑??類ㅼ퐠 ${index + 1}`;
  const benefitAmount = Number(policy.benefit_amount || 0);
  return {
    policy_id: policy.policy_id || serviceName.replace(/[^\w揶쎛-??/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase(),
    policy_name: serviceName,
    ??뺥돩??살구: serviceName,
    ??뺥돩??삵뀋?? (policy.badge_items && policy.badge_items[0]) || '',
    筌왖?癒???? policy.apply_status || '',
    ???疫꿸퀗?筌? 'BenePick',
    筌왖?癒??? policy.description || '',
    筌왖?癒?땀?? policy.benefit_summary || policy.benefit_amount_label || '',
    ?怨멸쉭鈺곌퀬?턷rl: '#',
    subtitle: policy.description || policy.benefit_summary || '',
    benefit_label: policy.benefit_amount_label || policy.benefit_summary || '-',
    benefit_amount: Number.isFinite(benefitAmount) && benefitAmount > 0 ? benefitAmount : null,
    source_label: 'BenePick',
    ??랁닋?類ｌぇ: score,
    score: Math.max(0, Math.min(1, score / 100)),
    _css: _scoreToCSS(score),
    ??덉뵭???: [],
    ??욧퍙獄쎻뫖苡? [],
    ?怨쀪퐨??뽰맄: Number(policy.sort_order || index + 1),
  };
}

function _toLegacyAnalyzeResponse(payload = {}) {
  const data = payload.data || {};
  const cards = (data.policies || []).map((p, i) => _legacyCardFromPolicy(p, i));
  const avg = cards.length ? Math.round(cards.reduce((s, c) => s + (c.??랁닋?類ｌぇ || 0), 0) / cards.length) : 0;
  const amountSum = cards.reduce((sum, card) => sum + (Number(card.benefit_amount) || 0), 0);
  const estimatedBenefitLabel = amountSum > 0
    ? `${amountSum.toLocaleString()}??
    : (_formatDashboardBenefitLabel('', cards));
  return {
    query_id: payload.meta?.request_id || String(Date.now()),
    cards,
    dashboard_data: {
      recommendation_cards: cards,
      stats: {
        ????類ㅼ퐠?? cards.length,
        ???뇧?類ｌぇ: avg,
        ??됯맒??묒굺?? estimatedBenefitLabel,
        筌앸맩??醫롪퍕揶쎛?? cards.filter(c => (c.??랁닋?類ｌぇ || 0) >= 80).length,
      },
      summary: data.rag_answer || _buildDashboardSummary(cards),
    },
  };
}

function _toLegacySearchResponse(payload = {}) {
  const items = (payload.data?.items || []).map((p, i) => _legacyCardFromPolicy(p, i));
  return { results: items, count: items.length };
}

function _extractBenefitLabelFromText(text) {
  const source = String(text || '');
  const wonInMan = source.match(/(筌ㅼ뮆?|?????\s*([\d,]+)\s*筌?s*??);
  if (wonInMan) return `${wonInMan[1] ? `${wonInMan[1]} ` : ''}${wonInMan[2]}筌띾슣??;
  const won = source.match(/(筌ㅼ뮆?|?????\s*([\d,]+)\s*??);
  if (won) return `${won[1] ? `${won[1]} ` : ''}${won[2]}??;
  return '-';
}

let _policyExcerptFallbackPromise = null;

async function _loadPolicyExcerptFallback() {
  if (!_policyExcerptFallbackPromise) {
    _policyExcerptFallbackPromise = fetch('/policy-excerpts-min.json', { cache: 'force-cache' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);
  }
  return _policyExcerptFallbackPromise;
}

function _humanizeApplicationMethod(method, org, contact, url) {
  const parts = [];
  const normalized = String(method || '')
    .replace(/\|\|/g, '\n')
    .replace(/疫꿸퀬? ??ㅼ뵬?紐꾨뻿筌?g, '??ㅼ뵬???醫롪퍕')
    .replace(/??ㅼ뵬?紐꾨뻿筌?g, '??ㅼ뵬???醫롪퍕')
    .replace(/獄쎻뫖揆?醫롪퍕/g, '獄쎻뫖揆 ?醫롪퍕')
    .replace(/\s*\n+\s*/g, ' / ')
    .trim();
  if (normalized) parts.push(normalized);
  if (org && !parts.join(' ').includes(org)) parts.push(`?臾믩땾夷뚩눧紐꾩벥 疫꿸퀗?: ${org}`);
  if (contact && !parts.join(' ').includes(contact)) parts.push(`?얜챷?? ${contact}`);
  if (url) parts.push('?類μ넇???臾믩땾 揶쎛????????⑤벊????륁뵠筌왖?癒?퐣 ?類ㅼ뵥');
  return parts.join(' / ');
}

function _looksBrokenPolicyExcerptText(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return true;
  if (text.length < 16) return true;
  if (/^[\)\]\},.;:夷???-]/.test(text)) return true;
  return (
    text.startsWith('\ub839\uc740') ||
    text.startsWith('\ub144\ub3c4\uc758') ||
    text.startsWith('\uc774\ud558*') ||
    text.startsWith('*') ||
    text.includes('\uc6d0\ubb38 \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4')
  );
}

function _preferPolicyExcerptFallback(current, fallback) {
  if (_looksBrokenPolicyExcerptText(current)) {
    return fallback || current || '';
  }
  return current || '';
}

async function _applyPolicyExcerptFallback(data, requestedPolicyId) {
  if (!data) return data;
  const raw = data.source_excerpt || {};
  const fallbackIndex = await _loadPolicyExcerptFallback();
  const fallback = fallbackIndex?.by_id?.[requestedPolicyId]
    || fallbackIndex?.by_id?.[data.policy_id]
    || fallbackIndex?.by_title?.[data.title]
    || null;
  if (!fallback) return data;

  const officialUrl = raw.official_url || data.application_url || '';
  data.source_excerpt = {
    ...raw,
    support_target_text: _preferPolicyExcerptFallback(raw.support_target_text, fallback.target),
    selection_criteria_text: _preferPolicyExcerptFallback(raw.selection_criteria_text, fallback.criteria),
    support_content_text: _preferPolicyExcerptFallback(raw.support_content_text, fallback.content),
    application_period_text: raw.application_period_text || fallback.period || '',
    application_method_text: _humanizeApplicationMethod(
      raw.application_method_text || fallback.method,
      fallback.org,
      fallback.contact || raw.contact_text,
      officialUrl,
    ) || raw.application_method_text || fallback.method || '',
    contact_text: raw.contact_text || fallback.contact || '',
    official_url: officialUrl,
  };
  return data;
}

async function _detailFromExcerptFallback(policyId) {
  const fallbackIndex = await _loadPolicyExcerptFallback();
  const fallback = fallbackIndex?.by_id?.[policyId] || fallbackIndex?.by_title?.[policyId] || null;
  if (!fallback) return null;
  const method = _humanizeApplicationMethod(fallback.method, fallback.org, fallback.contact, fallback.url);
  return {
    policy_header: {
      policy_name: fallback.title || policyId || '?類ㅼ퐠 ?怨멸쉭',
      eligibility_percent: 60,
      progress_color: 'blue',
      icon: '?諭?,
      percent_class: 'mid',
      badge_label: '???類ㅼ뵥 ?袁⑹뒄',
      badge_class: 'badge-blue',
      subtitle: fallback.org || '',
    },
    description: '',
    personal_summary: '?怨멸쉭 ?癒???????疫꿸퀣???곗쨮 ?醫롪퍕 ?類ｋ궖??癰귣벊???됰뮸??덈뼄. ?癒?봄 鈺곌퀗援?? ?⑤벊????륁뵠筌왖?癒?퐣 筌ㅼ뮇伊??類ㅼ뵥??뤾쉭??',
    raw_excerpt: {
      target: fallback.target || '',
      criteria: fallback.criteria || '',
      content: fallback.content || '',
      period: fallback.period || '',
      method: method || fallback.method || '',
      phone: fallback.contact || '',
      url: fallback.url || '',
    },
    issues: _buildIssuesFromDB(),
    guides: [
      { icon:'??, html:'<strong>1??ｍ? ?醫롪퍕 疫꿸퀗而??類ㅼ뵥</strong> ???癒??獄쏆뮇????醫롪퍕 疫꿸퀗而???믪눘? ?類ㅼ뵥??뤾쉭??' },
      { icon:'?諭?, html:'<strong>2??ｍ? ?醫롪퍕 獄쎻뫖苡??類ㅼ뵥</strong> ???臾믩땾 疫꿸퀗????얜챷?쏙㎗?? ?類ㅼ뵥?????醫롪퍕 揶쎛????????癒???뤾쉭??' },
      { icon:'?逾?, html:'<strong>3??ｍ? ?⑤벊????륁뵠筌왖 ?類ㅼ뵥</strong> ???類ㅼ퐠 ?怨멸쉭 URL?癒?퐣 筌ㅼ뮇???⑤벀??? ?臾믩땾 ?怨밴묶???類ㅼ뵥??뤾쉭??' },
    ],
    summary_stats: {
      benefit_label: '-',
      processing_period_label: '?類ㅼ뵥 ?袁⑹뒄',
      issue_count: 1,
      source_label: fallback.org || 'BenePick',
    },
  };
}

function _toLegacyDetailResponse(payload = {}) {
  const data = payload.data || {};
  const score = Number(data.match_score || 60);
  const css = _scoreToCSS(score);
  const reasons = Array.isArray(data.blocking_reasons) ? data.blocking_reasons.filter(Boolean) : [];
  const actions = Array.isArray(data.recommended_actions) ? data.recommended_actions.filter(Boolean) : [];
  const raw = data.source_excerpt || {};

  const issues = reasons.length
    ? reasons.map(reason => ({ icon: '??, html: `<strong>${escHtml(reason)}</strong>` }))
    : [{ icon: '??, html: '<strong>??덉뵭 ??? ??곸벉</strong> ??鈺곌퀗援??겸뫗?? }];

  const guides = actions.length
    ? actions.map((action, idx) => ({ icon: idx === 0 ? '?? : '?諭?, html: `<strong>${idx + 1}??ｍ?</strong> ${escHtml(action)}` }))
    : [
        { icon: '??, html: '<strong>1??ｍ? AI ?브쑴苑???쎈뻬</strong> ???怨룸뼊 "??랁닋 揶쎛?關苑?AI ?브쑴苑???뽰삂??띾┛" 甕곌쑵????袁ⓥ뀮?紐꾩뒄.' },
        { icon: '?逾?, html: '<strong>2??ｍ? ?⑤벊???醫롪퍕 ??륁뵠筌왖 ?類ㅼ뵥</strong> ???類ㅼ퐠 ?怨멸쉭 URL?癒?퐣 ?醫롪퍕 鈺곌퀗援???類ㅼ뵥??뤾쉭??' },
      ];

  const rawContent = raw.support_content_text || data.description || '';
  const benefitLabel = _extractBenefitLabelFromText(rawContent);

  return {
    policy_header: {
      policy_name: data.title || data.policy_id || '?類ㅼ퐠 ?怨멸쉭',
      eligibility_percent: score,
      progress_color: css.progress_color,
      icon: '?諭?,
      percent_class: css.percent_class,
      badge_label: css.badge_label,
      badge_class: css.badge_class,
      subtitle: data.managing_agency || '',
    },
    description: data.description || '',
    personal_summary: data.eligibility_summary || '',
    raw_excerpt: {
      target: raw.support_target_text || '',
      criteria: raw.selection_criteria_text || '',
      restriction: raw.restricted_target_text || '',
      content: raw.support_content_text || '',
      period: raw.application_period_text || '',
      method: raw.application_method_text || '',
      documents: raw.required_documents_text || '',
      screening: raw.screening_method_text || '',
      phone: raw.contact_text || '',
      url: raw.official_url || data.application_url || '',
    },
    issues,
    guides,
    summary_stats: {
      benefit_label: benefitLabel,
      processing_period_label: '1~2揶쏆뮇??,
      issue_count: reasons.length || 1,
      source_label: (data.managing_agency || 'BenePick').slice(0, 10),
    },
  };
}

function _detailFromCachedCard(card, policyId) {
  const pct = card.??랁닋?類ｌぇ || card.eligibility_percent || card.match_score || 60;
  const css = card._css || _scoreToCSS(pct);
  const color = css.progress_color || (pct >= 80 ? 'green' : pct >= 60 ? 'blue' : 'orange');
  const name = card.??뺥돩??살구 || card.policy_name || card.title || policyId || '?類ㅼ퐠 ?怨멸쉭';
  const benefit = card.筌왖?癒?땀??|| card.benefit_summary || card.benefit_label || card.benefit_amount_label || '';
  const target = card.筌왖?癒???|| card.description || card.subtitle || '';
  const method = card.?醫롪퍕獄쎻뫖苡?|| card.application_method || '';
  const url = card.?怨멸쉭鈺곌퀬?턷rl || card.application_url || card.source_url || '';

  return {
    policy_header: {
      policy_name: name,
      eligibility_percent: pct,
      progress_color: color,
      icon: card.icon || '?諭?,
      percent_class: css.percent_class || 'mid',
      badge_label: css.badge_label || '',
      badge_class: css.badge_class || 'badge-blue',
      subtitle: card.subtitle || card.???疫꿸퀗?筌?|| card.managing_agency || '',
    },
    description: target,
    揶쏆뮇??遺용튋: card.揶쏆뮇??遺용튋 || card.personal_summary || '',
    ?癒??쳸?뽱넾: {
      筌왖?癒??? target,
      ?醫롮젟疫꿸퀣?: card.?醫롮젟疫꿸퀣? || card.criteria || '',
      ??쀫립???? card.??쀫립????|| card.restriction || '',
      筌왖?癒?땀?? benefit,
      ?醫롪퍕疫꿸퀗而? card.?醫롪퍕疫꿸퀬釉?|| card.application_period || '',
      ?醫롪퍕獄쎻뫖苡? method,
      ?袁⑹뒄??뺤첒: card.?袁⑹뒄??뺤첒 || card.required_documents || '',
      ??沅쀨쳸?몄씩: card.??沅쀨쳸?몄씩 || card.screening || '',
      ?袁れ넅?얜챷?? card.?袁れ넅?얜챷??|| card.phone || '',
      ?怨멸쉭鈺곌퀬?턷rl: url,
    },
    issues: (card.??덉뵭??? !== undefined ? card.??덉뵭??? : null) || card.issues || _buildIssuesFromDB(),
    guides: card.??욧퍙獄쎻뫖苡?|| card.guides || _buildGuidesFromDB(),
    summary_stats: {
      benefit_label: card.benefit_label || card.benefit_amount_label || _extractBenefitLabelFromText(benefit),
      processing_period_label: '1~2揶쏆뮇??,
      issue_count: (card.??덉뵭??? || card.issues || []).length || 1,
      source_label: card.source_label || card.???疫꿸퀗?筌?|| card.managing_agency || 'BenePick',
    },
  };
}

async function _fetchDetailFromBackend(policyId) {
  if (!policyId) return null;
  const useBackend = await _checkBackend();
  if (!useBackend) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/policies/${encodeURIComponent(policyId)}/detail?lang=${_getCurrentLang()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => ({}));
    if (!payload?.data) return null;
    await _applyPolicyExcerptFallback(payload.data, policyId);
    return _toLegacyDetailResponse(payload);
  } catch (e) {
    console.warn('[detail] backend detail fetch failed:', e?.message || e);
    return null;
  }
}

function _mapLegacyPath(path, body) {
  if (path === '/analyze') {
    return {
      url: '/api/v1/eligibility/analyze',
      method: 'POST',
      body: _toAnalyzeRequest(body || {}),
      transform: _toLegacyAnalyzeResponse,
    };
  }
  if (path.startsWith('/search/natural')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const q = params.get('q') || '';
    const size = String(Math.min(Math.max(parseInt(params.get('top_k') || '20', 10) || 20, 1), 50));
    return {
      url: `/api/v1/policies/search?${new URLSearchParams({ q, size, lang: _getCurrentLang() }).toString()}`,
      method: 'GET',
      transform: _toLegacySearchResponse,
    };
  }
  if (path.startsWith('/search/keyword')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const q = params.get('keyword') || '';
    const size = String(Math.min(Math.max(parseInt(params.get('limit') || '20', 10) || 20, 1), 50));
    return {
      url: `/api/v1/policies/search?${new URLSearchParams({ q, size, lang: _getCurrentLang() }).toString()}`,
      method: 'GET',
      transform: _toLegacySearchResponse,
    };
  }
  if (path.startsWith('/portfolio')) {
    return { url: '/api/v1/portfolio', method: 'GET' };
  }
  return null;
}

// ???? apiFetch: FastAPI ?怨쀪퐨 ????媛???곸삢 嚥≪뮇彛? ??????????????????????????????????
async function apiFetch(path, options = {}) {
  const body = options.body ? JSON.parse(options.body) : null;
  let useBackend = await _checkBackend();
  const needsBackend =
    path === '/analyze' ||
    path.startsWith('/search/natural') ||
    path.startsWith('/search/keyword');
  if (!useBackend && needsBackend) {
    // cold start 筌욊낱?묊몴??袁る퉸 ??甕?揶쏅벡???????
    useBackend = await _checkBackend(true);
  }

  const mapped = _mapLegacyPath(path, body);
  if (mapped && (useBackend || needsBackend)) {
    try {
      const reqBody = mapped.body ? JSON.stringify(mapped.body) : options.body;
      const res = await fetch(API_BASE + mapped.url, {
        method: mapped.method || options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...(reqBody ? { body: reqBody } : {}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error?.message || payload?.detail?.message || `??뺤쒔 ??살첒 ${res.status}`);
      }
      return mapped.transform ? mapped.transform(payload) : payload;
    } catch (err) {
      if (needsBackend && STRICT_CORE_BACKEND) {
        const msg = err?.message || '獄쏄퉮肉???遺욧퍕 ??쎈솭';
        throw new Error(`獄쏄퉮肉???怨뚭퍙 ??쎈솭: ${msg}`);
      }
    }
  }

  if (needsBackend && STRICT_CORE_BACKEND) {
    throw new Error('獄쏄퉮肉???怨뚭퍙???袁⑹춦 餓Β??쑬由븝쭪? ??녿릭??щ빍?? ?醫롫뻻 ????쇰뻻 ??뺣즲??雅뚯눘苑??');
  }

  // ???? ??媛? ??곸삢 嚥≪뮇彛?????
  if (needsBackend) {
    console.warn(`[apiFetch] backend unavailable, fallback path used: ${path}`);
  }
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
  if (path === '/analyze') {
    return localAnalyze(body);
  }
  if (path.startsWith('/portfolio')) {
    return { items: _currentPortfolio };
  }
  if (path.startsWith('/browse')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const perPage = Math.max(1, parseInt(params.get('per_page') || '20', 10));
    const total = POLICY_DB.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    return { results: POLICY_DB.slice(start, start + perPage), total, total_pages: totalPages };
  }
  throw new Error(`筌왖?癒곕릭筌왖 ??낅뮉 野껋럥以? ${path}`);
}

// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
// ??쎄쾿??疫꿸퀡??(localStorage 疫꿸퀡而?
// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름

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
  // 疫꿸퀣???醫롫뮞?硫? ??됱몵筌???볤탢
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
  // 嚥≪뮄???筌ｋ똾寃?
  const token = localStorage.getItem('token');
  if (!token) {
    _showScrapToast('?逾?嚥≪뮄???????쎄쾿??븍막 ????됰선??);
    setTimeout(() => { window.location.href = '/login'; }, 1200);
    return;
  }

  const scraps = _getScraps();
  const idx = scraps.indexOf(policyId);
  const willScrap = idx === -1;

  if (willScrap) {
    scraps.push(policyId);
    btnEl.classList.add('active');
    btnEl.textContent = '??;
    btnEl.title = '??쎄쾿????곸젫';
    btnEl.setAttribute('aria-label', '??쎄쾿????곸젫');
    _showScrapToast('????쎄쾿??밸퓠 ???貫由??곸뒄');
  } else {
    scraps.splice(idx, 1);
    btnEl.classList.remove('active');
    btnEl.textContent = '??;
    btnEl.title = '??쎄쾿??????;
    btnEl.setAttribute('aria-label', '??쎄쾿??????);
    _showScrapToast('??쎄쾿??뱀뵠 ??곸젫?癒?선??);
  }

  // ???醫딅빍筌롫뗄???
  btnEl.classList.remove('pop');
  void btnEl.offsetWidth; // reflow 揶쏅벡??
  btnEl.classList.add('pop');
  btnEl.addEventListener('animationend', () => btnEl.classList.remove('pop'), { once: true });

  try {
    localStorage.setItem(SCRAP_KEY, JSON.stringify(scraps));
  } catch(e) {
    console.warn('??쎄쾿????????쎈솭:', e);
  }
}

// ???? handleScrapToggle: ?袁⑨세?袁る뱜 筌뤿굞苑??紐낆넎 alias ????????????????????????????????
// event.stopPropagation ??釉? ??쑬以덃뉩紐꾩뵥 筌ｋ똾寃? UI 筌앸맩??獄쏆꼷?? localStorage ??녿┛??
function handleScrapToggle(event, policyId) {
  event.stopPropagation();
  toggleScrap(policyId, event.currentTarget);
}

// ???? ?癒?쑎 ?醫롫뮞????????????????????????????????????????????????????????????????????????????????????????????????
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

// ???? Intent ??볥젃 ?醫? (筌ㅼ뮆? 2揶? ????????????????????????????????????????????????????????????
function toggleIntent(el) {
  const tags = document.querySelectorAll('.intent-tag');
  const activeTags = document.querySelectorAll('.intent-tag.active');

  if (el.classList.contains('active')) {
    el.classList.remove('active');
    // 2揶???쀫립 ??곸젫 ??disabled ??곸젫
    tags.forEach(t => t.classList.remove('disabled'));
  } else {
    if (activeTags.length >= 2) return; // ??? 2揶??醫뤾문??
    el.classList.add('active');
    // 2揶???筌≪눘?앾쭖???롢돢筌왖 ??쑵??源딆넅 (??볦퍟????곕굡獄?
    if (activeTags.length + 1 >= 2) {
      tags.forEach(t => { if (!t.classList.contains('active')) t.classList.add('disabled'); });
    }
  }
}

// ???? ?醫뤾문??Intent ??볥젃 ??륁춿 ????????????????????????????????????????????????????????????????
function getSelectedIntents() {
  return Array.from(document.querySelectorAll('.intent-tag.active'))
    .map(el => el.dataset.intent)
    .filter(Boolean);
}

// ???? ??낆젾 ??깅퓠????????怨쀬뵠????륁춿 ????????????????????????????????????????????????????
function collectFormData() {
  const ageVal        = document.getElementById('sel-age')?.value        || '筌?27??;
  const regionVal     = document.getElementById('sel-region')?.value     || '??뽰뒻?諛명??;
  const incomeVal     = document.getElementById('sel-income')?.value     || '餓λ쵐????굣 50~60%';
  const familyVal     = document.getElementById('sel-family')?.value     || '1??揶쎛??;
  const empVal        = document.getElementById('sel-employment')?.value || '沃섎챷???;
  const disabilityVal = document.getElementById('sel-disability')?.value || '??곸벉';

  // ???? ??륁뵠 ???뼓: "筌?27?? / "筌?65????곴맒" ????ъ쁽
  const ageMatch = ageVal.match(/\d+/);
  const age = ageMatch ? parseInt(ageMatch[0]) : 27;

  // ???? ???굣 ???뼓 ??income_percent
  let income_percent = 55;
  const rangeMatch  = incomeVal.match(/(\d+)[~\-](\d+)/);
  const singleMatch = incomeVal.match(/(\d+)%\s*(??꾨릭|?λ뜃??/);
  if (rangeMatch) {
    income_percent = Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
  } else if (singleMatch) {
    income_percent = singleMatch[2] === '??꾨릭'
      ? Math.round(parseInt(singleMatch[1]) * 0.7)
      : parseInt(singleMatch[1]) + 10;
  }

  // ???? 揶쎛?닌딆뜚???곕뗄??
  const sizeMap = {
    '1??揶쎛??:1, '2??揶쎛??:2, '3??揶쎛??:3, '4????곴맒 揶쎛??:4,
    '???筌?揶쎛??:2, '??쇱쁽?? 揶쎛??:4, '??뿅??揶쎛??:3,
    '鈺곌퀣? 揶쎛??:2, '?紐꾩뵥 ??ㅻ즴 揶쎛??:1,
  };
  const household_size = sizeMap[familyVal] || 1;

  // ???? ?띯뫁毓?怨밴묶 ??scoring.py ?紐낆넎
  const empMap = {
    '沃섎챷???:                     '?닌딆춦??(??쇰씜)',
    '?띯뫁毓??(?類?뇣筌?':             '?띯뫁毓??(?類?뇣筌?',
    '?띯뫁毓??(??쑴?숁뉩?뽰춦/?④쑴鍮잞쭪?':    '?띯뫁毓??(??쑴?숁뉩?뽰춦/?④쑴鍮잞쭪?',
    '?癒?겫??놁쁽':                    '?癒?겫??놁쁽',
    '?닌딆춦??(??쇰씜)':               '?닌딆춦??(??쇰씜)',
    '??덇문':                        '??덇문',
    '??る툡??곸춦 餓?:                 '??る툡??곸춦 餓?,
    '?얜똻彛?:                        '?얜똻彛?,
  };

  // ???? ??뿅?遺?????? (揶쎛?닌딆??類ㅻ퓠???癒?짗 ?癒?뼊)
  const multicultural = familyVal === '??뿅??揶쎛??;

  // ???? scoring.py 6揶????됪??袁⑹읈 ??깊뒄??롫뮉 payload
  return {
    user_name:         document.querySelector('.avatar-name')?.textContent?.replace('??,'') || '?????,
    age,                                          // ????륁뵠
    region:            regionVal,                 // ??椰꾧퀣竊쒙쭪???
    income_percent,                               // ???怨쀫꺖??(餓λ쵐????굣 % ??뤾텦)
    household_type:    familyVal,                 // ??揶쎛?닌딆???
    household_size,                               // ??揶쎛?닌딆뜚??
    employment_status: empMap[empVal] || empVal,  // ???⑥쥙??怨밴묶
    disability:        disabilityVal,             // ???關釉??? ????덉쨮 ?곕떽?
    veteran:           false,
    multicultural,
    education_level:   '??鈺?,
    language:          'ko',
    intent_tags:       getSelectedIntents(),  // ???온???브쑴鍮???볥젃
  };
}

// ???? ????뺣궖?????쐭筌???????????????????????????????????????????????????????????????????????????????????????
function renderDashboard(data) {
  // Claude API ?臾먮뼗 ?닌듼?? 疫꿸퀣???닌듼?筌뤴뫀紐??紐낆넎
  const recommendation_cards = data.recommendation_cards || data.????????|| [];
  const stats = data.stats || data.????뺣궖??쀫꽰??|| {};
  const summary = data.summary || data.?ル굟鍮?遺용튋 || '';

  // ??????袁⑥쨮????낅쑓??꾨뱜 (??揶?疫꿸퀡而?
  const ageVal    = document.getElementById('sel-age')?.value    || '';
  const regionVal = document.getElementById('sel-region')?.value || '';
  const familyVal = document.getElementById('sel-family')?.value || '';
  const empVal    = document.getElementById('sel-employment')?.value || '';
  const incomeVal = document.getElementById('sel-income')?.value || '';

  const profileH2 = document.querySelector('.profile-info h2');
  if (profileH2) {
    const userName = getAuthUser()?.name || '?????;
    profileH2.textContent = `${userName}??癰귣벊? ?브쑴苑?野껉퀗??;
  }

  const profileP = document.querySelector('.profile-info p');
  const now = new Date(); const hm = `${now.getHours()}??${now.getMinutes()}??;
  if (profileP) profileP.textContent = `筌띾뜆?筌???낅쑓??꾨뱜: ??삳뮎 ${hm} 夷?${regionVal}`;

  const tagsEl = document.querySelector('.profile-tags');
  if (tagsEl && ageVal) {
    tagsEl.innerHTML = [
      ageVal ? `?諭?${ageVal}` : '',
      regionVal ? `?諭?${regionVal}` : '',
      incomeVal ? `?裕?${incomeVal}` : '',
      familyVal ? `?猷?${familyVal}` : '',
      empVal ? `?紐?${empVal}` : '',
    ].filter(Boolean).map(t => `<span class="profile-tag">${t}</span>`).join('');
  }

  // ??????낅쑓??꾨뱜
  const valEls = document.querySelectorAll('.stat-item .val');
  if (valEls.length >= 4) {
    if (valEls[0]) valEls[0].textContent = String(stats.????類ㅼ퐠???? recommendation_cards.length ?? 0);
    if (valEls[1]) valEls[1].textContent = `${String(stats.???뇧?類ｌぇ ?? 0)}%`;
    if (valEls[2]) valEls[2].textContent = _formatDashboardBenefitLabel(Object.values(stats || {})[2] ?? '-', recommendation_cards);
    if (valEls[3]) valEls[3].textContent = String(stats.筌앸맩??醫롪퍕揶쎛???? 0);
    const scoreNum = document.querySelector('.score-num');
    if (scoreNum) scoreNum.textContent = String(stats.???뇧?類ｌぇ ?? 0);
  }

  // ?類ㅼ퐠 燁삳?諭?筌뤴뫖以?
  const policyList = document.querySelector('.policy-list');
  if (policyList && recommendation_cards.length) {
    policyList.innerHTML = recommendation_cards.map(card => {
      const css      = card._css || {};
      const pct      = card.??랁닋?類ｌぇ || card.eligibility_percent || 0;
      const name     = card.??뺥돩??살구 || card.policy_name || '';
      const subtitle = card.subtitle || '';
      const benefit  = card.benefit_label || '';
      const source   = card.source_label || 'Gov24';
      const icon     = card.icon || '?諭?;
      const pid      = card.policy_id || '';
      const barColor = css.progress_color || 'blue';
      const isScrapped = _isScrapped(pid);
      return `
        <div class="policy-card ${css.card_class || 'mid'}" onclick="showDetail('${escHtml(pid)}')">
          <button
            class="scrap-btn ${isScrapped ? 'active' : ''}"
            data-policy-id="${escHtml(pid)}"
            onclick="handleScrapToggle(event, '${escHtml(pid)}')"
            title="${isScrapped ? '??쎄쾿????곸젫' : '??쎄쾿??????}"
            aria-label="${isScrapped ? '??쎄쾿????곸젫' : '??쎄쾿??????}"
          >${isScrapped ? '?? : '??}</button>
          <div class="policy-top-row">
            <div class="policy-left" style="padding-right:44px">
              <div class="policy-icon ${css.icon_color || css.progress_color || 'blue'}">${icon}</div>
              <div class="policy-meta">
                <h4>${escHtml(name)}</h4>
                <p>${escHtml(subtitle)}</p>
                <div class="policy-badges">
                  <span class="badge ${css.badge_class || 'badge-blue'}">${css.badge_label || '?類ㅼ뵥 ?袁⑹뒄'}</span>
                  <span class="badge badge-blue">${escHtml(source)}</span>
                  <span class="badge badge-gray">${escHtml(benefit)}</span>
                </div>
              </div>
            </div>
            <div class="policy-percent">
              <div class="percent-num ${css.percent_class || 'mid'}">${pct}<span style="font-size:18px">%</span></div>
              <div class="percent-label">??랁닋 ?類ｌぇ</div>
            </div>
          </div>
          <div class="progress-row policy-progress-row">
            <div class="progress-track">
              <div class="progress-fill ${barColor}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="policy-footer-row">
            <div class="benefit-chip">${escHtml(benefit)}</div>
            <div class="policy-action">?? ?? ?? ?</div>
          </div>
        </div>`;
    }).join('');
    Array.from(policyList.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
  }

  // ?????????袁ⓥ봺???????뺤뺍 ??낅쑓??꾨뱜 (??됱뱽 野껋럩??
  const portTotal = document.querySelector('.portfolio-total .amount');
  if (portTotal) portTotal.textContent = _formatDashboardBenefitLabel(Object.values(stats || {})[2] ?? '-', recommendation_cards);

  // ?ル굟鍮?遺용튋?? ????뺣궖???袁⑹뒠 獄쏅벡??癒?춸 ??뽯뻻 (??????紐꾧텢??꾨뱜/CTA ??쇰옘 獄쎻뫗?)
  const dashSummaryWrap = document.getElementById('dashboard-rag-summary');
  const dashSummaryText = document.getElementById('dashboard-rag-summary-text');
  if (dashSummaryWrap && dashSummaryText) {
    if (summary) {
      dashSummaryText.textContent = summary;
      dashSummaryWrap.hidden = false;
    } else {
      dashSummaryText.textContent = '';
      dashSummaryWrap.hidden = true;
    }
  }
}

// ???? ?怨멸쉭 ?브쑴苑??遺얇늺 ???쐭筌???????????????????????????????????????????????????????????????????????????
function renderDetail(detailData) {
  const { policy_header, issues, guides, summary_stats } = detailData;
  const pct   = policy_header.eligibility_percent;
  const color = policy_header.progress_color || (pct >= 80 ? 'green' : pct >= 60 ? 'blue' : 'orange');

  // ?類ㅼ퐠筌?
  document.getElementById('detail-policy-name').textContent = policy_header.policy_name;

  // ?袁⑹뵠??
  const iconEl = document.querySelector('#screen-detail .detail-icon');
  if (iconEl && policy_header.icon) iconEl.textContent = policy_header.icon;

  // ??랁닋 ?類ｌぇ ??ъ쁽 + % ??깃맒
  const pctEl = document.getElementById('detail-pct');
  if (pctEl) pctEl.textContent = pct;
  const pctSign = document.querySelector('#screen-detail .detail-prob span[style]');
  const pctColor = color === 'green' ? 'var(--green)' : color === 'blue' ? 'var(--blue)' : 'var(--orange)';
  if (pctSign) pctSign.style.color = pctColor;

  // 筌욊쑵六얕쳸?
  const bar = document.getElementById('detail-bar');
  if (bar) {
    bar.className   = `progress-fill ${color}`;
    bar.style.width = pct + '%';
    // ?醫딅빍筌롫뗄???
    bar.style.width = '0';
    requestAnimationFrame(() => { setTimeout(() => { bar.style.width = pct + '%'; }, 60); });
  }

  // issue-item ???쐭筌?
  const issueSection = document.getElementById('detail-issue-section');
  if (issueSection) {
    const noIssue = !issues || issues.length === 0 ||
      (issues.length === 1 && (issues[0].icon === '?? ||
        (issues[0].html || '').includes('??덉뵭 ?遺우뵥 ??곸벉') ||
        (issues[0].html || '').includes('?브쑴苑???)));
    issueSection.innerHTML = `
      <div class="analysis-label">????덉뵭 ??됯맒 ??곸?</div>
      ${noIssue
        ? `<div class="issue-item"><span class="icon">??/span><p><strong>??덉뵭 ??? ??곸벉</strong> ??鈺곌퀗援??겸뫗??/p></div>`
        : issues.map(iss => {
            const icon = iss.icon || '?醫묓닔';
            const text = typeof iss.html === 'string' ? iss.html : (iss.html?.html || JSON.stringify(iss.html));
            return `<div class="issue-item"><span class="icon">${icon}</span><p>${text}</p></div>`;
          }).join('')
      }
    `;
  }

  // guide-item ???쐭筌?
  const guideSection = document.getElementById('detail-guide-section');
  if (guideSection) {
    guideSection.innerHTML = `
      <div class="analysis-label">?裕???욧퍙 獄쎻뫖苡?&amp; ??곕짗 揶쎛??諭?/div>
      ${guides.map(g => {
        const icon = g.icon || '??;
        const text = typeof g.html === 'string' ? g.html : (g.html?.html || JSON.stringify(g.html));
        return `<div class="guide-item"><span class="icon">${icon}</span><p>${text}</p></div>`;
      }).join('')}
    `;
  }

  // ?????뺤뺍 ????(detail ?遺얇늺)
  const detailStats = document.querySelectorAll('#screen-detail .stat-item .val');
  if (detailStats.length >= 4) {
    detailStats[0].textContent  = pct + '%';
    detailStats[0].className    = `val ${color}`;
    detailStats[1].textContent  = summary_stats.benefit_label;
    detailStats[2].textContent  = summary_stats.processing_period_label;
    detailStats[3].textContent  = summary_stats.issue_count + '椰?;
  }

  // AI ???뼎?遺용튋 獄쏅벡??嚥≪뮆諭?
  renderAiSummary(detailData);
}

// ???? ?癒??獄쏆뮇??獄쏅벡?????쐭筌?????????????????????????????????????????????????????????????????????????
async function renderAiSummary(detailData) {
  const box = document.getElementById('ai-summary-content');
  if (!box) return;

  let personalSummary = detailData.揶쏆뮇??遺용튋 || detailData.personal_summary || '';
  const rawFromDetail = detailData.?癒??쳸?뽱넾 || detailData.raw_excerpt || {};
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const isWeakPersonalSummary = (s) => {
    const t = norm(s);
    if (!t) return false;
    return [
      '雅뚯눘?????怨? 筌왖?癒??怨몄뿯??덈뼄',
      '雅뚯눘??筌왖????곸뒠?? 筌왖?癒??怨몄뿯??덈뼄',
      '雅뚯눘?????怨? 筌왖?癒?땀??뱀뿯??덈뼄',
      '雅뚯눘??筌왖????곸뒠?? 筌왖?癒?땀??뱀뿯??덈뼄',
      '雅뚯눘?????怨? 筌왖?????怨몄뿯??덈뼄',
      '雅뚯눘??筌왖????곸뒠?? 筌왖????곸뒠??낅빍??,
    ].some((phrase) => t.includes(phrase));
  };
  const truncate = (s, max) => {
    const t = norm(s);
    if (!t) return '';
    return t.length > max ? `${t.substring(0, max)}?? : t;
  };

  let rawTarget = rawFromDetail.筌왖?癒???|| rawFromDetail.target || detailData.description || '';
  const rawCriteria = rawFromDetail.?醫롮젟疫꿸퀣? || rawFromDetail.criteria || '';
  const rawRestriction = rawFromDetail.??쀫립????|| rawFromDetail.restriction || '';
  let rawContent = rawFromDetail.筌왖?癒?땀??|| rawFromDetail.content || '';
  const rawPeriod = rawFromDetail.?醫롪퍕疫꿸퀗而?|| rawFromDetail.period || '?癒????醫롪퍕 疫꿸퀗而??筌뤿굞???뤿선 ??? ??녿뮸??덈뼄. ?⑤벊????륁뵠筌왖?癒?퐣 ?臾믩땾 揶쎛????????類ㅼ뵥??뤾쉭??';
  const rawMethod = rawFromDetail.?醫롪퍕獄쎻뫖苡?|| rawFromDetail.method || '';
  const rawDocuments = rawFromDetail.?袁⑹뒄??뺤첒 || rawFromDetail.documents || '';
  const rawScreening = rawFromDetail.??沅쀨쳸?몄씩 || rawFromDetail.screening || '';
  const rawPhone = rawFromDetail.?袁れ넅?얜챷??|| rawFromDetail.phone || '';
  const rawUrl = rawFromDetail.?怨멸쉭鈺곌퀬?턷rl || rawFromDetail.url || '';

  const normTarget = norm(rawTarget);
  const normContent = norm(rawContent);
  if (normTarget && normContent && normTarget === normContent) {
    // ??덉뵬 癰귣챶揆??餓λ쵎???곗뮆???롫뮉 ?얜챷??獄쎻뫗?
    rawContent = '';
  }
  if (!norm(rawContent) && detailData.summary_stats?.benefit_label && detailData.summary_stats?.benefit_label !== '-') {
    rawContent = detailData.summary_stats.benefit_label;
  }
  if (isWeakPersonalSummary(personalSummary)) {
    personalSummary = '';
  }

  if (!personalSummary && !rawTarget && !rawContent && !rawMethod) {
    box.innerHTML = `<div class="ai-summary-row"><span class="ai-summary-icon">?諭?/span><span style="font-size:12px;color:var(--gray-500)">?癒???怨쀬뵠?怨? ??곷뮸??덈뼄. ?⑤벊????륁뵠筌왖?癒?퐣 ?類ㅼ뵥??뤾쉭??</span></div>`;
    return;
  }

  const md2html = s => (s||'').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const rows = [
    rawTarget      ? { label:'?諭?筌왖??????, value: truncate(rawTarget, 720) } : null,
    rawCriteria    ? { label:'???醫롮젟/???굣 疫꿸퀣?', value: truncate(rawCriteria, 520) } : null,
    rawRestriction ? { label:'?????쀫립 ????, value: truncate(rawRestriction, 420) } : null,
    rawContent     ? { label:'?裕?筌왖????곸뒠', value: truncate(rawContent, 720) } : null,
    rawPeriod      ? { label:'?肉롦닼??醫롪퍕 疫꿸퀗而?, value: truncate(rawPeriod, 360) } : null,
    rawMethod      ? { label:'?諭??醫롪퍕 獄쎻뫖苡?, value: truncate(rawMethod, 420) } : null,
    rawDocuments   ? { label:'?諭??袁⑹뒄 ??뺤첒', value: truncate(rawDocuments, 420) } : null,
    rawScreening   ? { label:'?逾???沅?獄쎻뫖苡?, value: truncate(rawScreening, 320) } : null,
  ].filter(Boolean);

  const personalHtml = personalSummary && rows.length === 0
    ? `<div class="ai-summary-row" style="border-bottom:1px solid rgba(245,195,60,.15);margin-bottom:8px;padding-bottom:8px;">
        <span class="ai-summary-icon">?諭?/span>
        <div style="flex:1;font-size:13.5px;font-weight:500;line-height:1.65;color:#2D2200">${md2html(personalSummary)}</div>
      </div>`
    : '';

  box.innerHTML = personalHtml + rows.map(r =>
    `<div class="ai-summary-row">
      <span class="ai-summary-icon" style="font-size:13px;min-width:16px;">??/span>
      <div style="flex:1;">
        <div class="ai-summary-source-label">${r.label}</div>
        <div class="ai-summary-excerpt">${md2html(r.value)}</div>
      </div>
    </div>`
  ).join('') + (rawPhone || rawUrl ? `
    <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(245,195,60,.2)">
      ${rawPhone ? `<span style="font-size:11px;color:var(--gray-500)">?諭?${rawPhone}</span>` : ''}
      ${rawUrl   ? `<a href="${rawUrl}" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none;font-weight:600">?逾??⑤벊????륁뵠筌왖 ??/a>` : ''}
    </div>` : '');
}

// ???? ?類ㅼ읅 ?類ㅼ퐠 ?怨쀬뵠??(獄쏄퉮肉????곸뵠???怨멸쉭 癰귣떯由???덉삂) ??????????????????
const _STATIC_DETAIL = {
  '筌????遺욧쉭-??뽯뻻-?諛명롳쭪???: {
    policy_header: {
      policy_name: '筌????遺욧쉭 ??뽯뻻 ?諛명롳쭪???,
      eligibility_percent: 92,
      progress_color: 'green',
      icon: '?猷?,
    },
    issues: [
      { icon: '?醫묓닔', html: '<strong>雅뚯눖??源낆쨯 ?袁⑹뿯 沃섎챷?욜뙴?</strong> ?袁⑹삺 椰꾧퀣竊쒙쭪? 雅뚯눖??源낆쨯???醫롪퍕 雅뚯눘??? ??깊뒄??? ??놁뱽 ????됰뮸??덈뼄. ??뺤첒 ??沅?????덉뵭 ?遺우뵥????????됰뮸??덈뼄.' },
      { icon: '?諭?, html: '<strong>?袁?筌??④쑴鍮??沃섎챶??</strong> ?遺욧쉭 ?④쑴鍮?疫꿸퀗而????? ?④쑴鍮???癒?궚 獄??類ㅼ젟??깆쁽揶쎛 ?袁⑹뒄??몃빍??' },
    ],
    guides: [
      { icon: '??, html: '<strong>1??ｍ? ?袁⑹뿯?醫됲??袁⑥┷??띾┛</strong> ??椰꾧퀣竊쒙쭪? 雅뚯눖???녠숲??獄쎻뫖揆??뤿연 ??雅뚯눘?쇗에??袁⑹뿯?醫됲х몴?筌욊쑵六??뤾쉭?? 筌ｌ꼶??疫꿸퀗而? ?諭?? },
      { icon: '?諭?, html: '<strong>2??ｍ? ?袁?筌??④쑴鍮???類ㅼ뵥</strong> ???④쑴鍮??뽯퓠 ?類ㅼ젟??깆쁽 ?袁⑹삢??筌〓엨? ??덈뮉筌왖 ?類ㅼ뵥??랁? ??용뼄筌?雅뚯눖???녠숲 獄쎻뫖揆 ????덈뻻???醫롪퍕??뤾쉭??' },
      { icon: '??', html: '<strong>3??ｍ? 癰귣벊?嚥≪뮇肉????ㅼ뵬???醫롪퍕</strong> ??????뺤첒 餓Β????<a href="https://bokjiro.go.kr" target="_blank" style="color:var(--blue)">bokjiro.go.kr</a>?癒?퐣 ?醫롪퍕??? ??뽱뀱??뤾쉭?? 30????沅?野껉퀗?든몴???щ궖獄쏆룇???덈뼄.' },
    ],
    summary_stats: { benefit_label: '??240筌띾슣??, processing_period_label: '1揶쏆뮇??, issue_count: 2, source_label: '???쀩겫?' },
  },
  '?????곸뵬獄쏄퀣?燁삳?諭?: {
    policy_header: { policy_name: '?????곸뵬獄쏄퀣?燁삳?諭?, eligibility_percent: 85, progress_color: 'green', icon: '?諭? },
    issues: [
      { icon: '?醫묓닔', html: '<strong>??彛?????굣 疫꿸퀣? ?類ㅼ뵥 ?袁⑹뒄:</strong> ?????굣 5,000筌띾슣???λ뜃????疫꿸퀣毓???彛?癒?뮉 筌왖?????怨몃퓠????뽰뇚??몃빍??' },
      { icon: '?諭?, html: '<strong>??덉졃 疫꿸퀗? ?醫뤾문 ?袁⑹뒄:</strong> 筌왖?類ｋ쭆 筌욊낯毓??덉졃疫꿸퀗??癒?퐣筌?燁삳?諭??????揶쎛?館鍮??덈뼄. ?????類ㅼ뵥 ???醫롪퍕??뤾쉭??' },
    ],
    guides: [
      { icon: '??, html: '<strong>1??ｍ? ?⑥쥙??4 ???뜚揶쎛??/strong> ??<a href="https://www.work24.go.kr" target="_blank" style="color:var(--blue)">work24.go.kr</a>?癒?퐣 ???뜚揶쎛?????醫롪퍕 ??륁뵠筌왖嚥???猷??뤾쉭??' },
      { icon: '?諭?, html: '<strong>2??ｍ? ??띿뺏 ??彛??⑥눘???醫뤾문</strong> ??筌욊낯毓??덉졃??苑?癒?퐣 ??띿뺏 ??彛???덉졃?⑥눘???沃섎챶??野꺜??뀀퉸?癒?쉭??' },
      { icon: '??', html: '<strong>3??ｍ? 燁삳?諭??醫롪퍕 獄?獄쏆뮄??/strong> ???醫롪퍕 ?諭????燁삳?諭???롮죯繹먮슣? ??2雅????뒄??몃빍?? ????????癒?뮉 ?怨뺚봺????깆몵嚥?獄쏆뮄???몃빍??' },
    ],
    summary_stats: { benefit_label: '筌ㅼ뮆? 500筌띾슣??, processing_period_label: '2雅?, issue_count: 2, source_label: '?⑥쥙?쒒겫?' },
  },
  '筌????띯뫁毓?源껊궗???텕筌왖': {
    policy_header: { policy_name: '筌???袁⑸튋?④쑴伊?, eligibility_percent: 78, progress_color: 'blue', icon: '?裕? },
    issues: [
      { icon: '?醫묓닔', html: '<strong>???굣 疫꿸퀣? ??????袁⑹뒄:</strong> 揶쏆뮇????굣 6,000筌띾슣????꾨릭, 揶쎛?닌딅꺖??餓λ쵐??180% ??꾨릭 鈺곌퀗援??筌뤴뫀紐??겸뫗???곷튊 ??몃빍??' },
      { icon: '?逾?, html: '<strong>5???醫? ??롊?</strong> 餓λ쵎猷???? ???類?疫꿸퀣肉ф묾?獄???쑨?????쀪문?????늾??몃빍?? ?觀由???뱀뿯 ?④쑵????롡뵲???袁⑹뒄??몃빍??' },
    ],
    guides: [
      { icon: '??, html: '<strong>1??ｍ? 揶쎛???癒?봄 ????筌ｋ똾寃?/strong> ?????굣 疫꿸퀣?(揶쏆뮇?ㅼ쮯揶쎛??筌뤴뫀紐?????륁뵠(筌?19~34?? 鈺곌퀗援????????類ㅼ뵥??뤾쉭??' },
      { icon: '?諭?, html: '<strong>2??ｍ? ?????源녿퓠???醫롪퍕</strong> ???띯몿?????????夷?醫뤿립夷??롪돌夷?怨뺚봺 ?? ?源녿퓠????쑬?筌롫똻?앮에??醫롪퍕 揶쎛?館鍮??덈뼄.' },
      { icon: '??', html: '<strong>3??ｍ? 筌띲끉??40~70筌띾슣????뱀뿯</strong> ????筌ㅼ뮆? 70筌띾슣????뱀뿯 ???類?疫꿸퀣肉ф묾?筌ㅼ뮆? 6%???곕떽?嚥?獄쏆룇??????됰뮸??덈뼄.' },
    ],
    summary_stats: { benefit_label: '筌ㅼ뮆? 5,000筌띾슣??, processing_period_label: '5??筌띾슡由?, issue_count: 2, source_label: '疫뀀뜆??? },
  },
  '筌???筌띾뜆?у쳞?우뺏-筌왖?癒?텢??: {
    policy_header: { policy_name: '筌???筌띾뜆?у쳞?우뺏 筌왖?癒?텢??, eligibility_percent: 74, progress_color: 'blue', icon: '?猷? },
    issues: [
      { icon: '?醫묓닔', html: '<strong>筌왖????獄쏅뗄??㎗??⑤벀?????쀫립:</strong> 椰꾧퀣竊?筌왖??肉??怨뺤뵬 ??볥궗 揶쎛?館釉??怨룸뼖??獄?疫꿸퀗? ??? ??살キ??덈뼄. 鈺곌퀗由??醫롪퍕??亦낅슣???몃빍??' },
      { icon: '?諭?, html: '<strong>??10????뺣즲:</strong> ???┛??50??疫꿸퀣???흭, ?遺용연 ???┛????쇱벉 ?怨뺣즲嚥???곸뜞??? ??녿뮸??덈뼄.' },
    ],
    guides: [
      { icon: '??, html: '<strong>1??ｍ? 椰꾧퀣竊쒙쭪? 雅뚯눖???녠숲 獄쎻뫖揆 ?醫롪퍕</strong> ???醫딇뀋筌?筌왖筌???癰귣벊? ????癒?퓠野?筌???筌띾뜆?у쳞?우뺏 獄쏅뗄??㎗??醫롪퍕 ??뤾텢??獄쏆빜??紐꾩뒄.' },
      { icon: '?諭?, html: '<strong>2??ｍ? ?怨룸뼖 疫꿸퀗? ?醫뤾문</strong> ???類ㅻ뻿椰꾨떯而?퉪????녠숲 ?癒?뮉 筌왖??沃섏눊而??怨룸뼖 疫꿸퀗? 餓??醫뤾문 揶쎛?館鍮??덈뼄.' },
      { icon: '??', html: '<strong>3??ｍ? ?怨룸뼖 ??됰튋 獄???곸뒠</strong> ??獄쏅뗄??㎗?燁삳?諭???롮죯 ??筌왖??疫꿸퀗??癒?퐣 ?怨룸뼖 ??됰튋??筌욊쑵六??뤾쉭?? 癰귣챷?ㅹ겫???욱닊?? ???뼣 3,000?癒?뿯??덈뼄.' },
    ],
    summary_stats: { benefit_label: '??80筌띾슣???怨룸뼣', processing_period_label: '?怨몃뻻', issue_count: 2, source_label: '癰귣벊??봔' },
  },
  '筌??덌㎕?뚮씜?????놃꺍': {
    policy_header: { policy_name: '筌??덌㎕?뚮씜?????놃꺍', eligibility_percent: 41, progress_color: 'orange', icon: '??' },
    issues: [
      { icon: '??, html: '<strong>??毓썸④쑵???餓Β??沃섎챸??</strong> ??뺤첒 ??沅?+ 獄쏆뮉紐???沅?2??ｍ롦에?筌욊쑵六??렽? ?닌딄퍥?怨몄뵥 筌띲끉???④쑵?룡???뽰삢 ?브쑴苑???袁⑸땾??낅빍??' },
      { icon: '?醫묓닔', html: '<strong>筌≪럩毓??袁⑹뵠???닌딄퍥???봔鈺?</strong> ??λ떄 ?袁⑹뵠?遺용선 ??????袁⑤빒, MVP(筌ㅼ뮇??疫꿸퀡????쀫?) ?癒?뮉 ?袁⑥쨮?醫???놁뵠 ??됱뱽 野껋럩????룰봄?쒖쥙????苡??誘る툡筌욌쵎???' },
      { icon: '?逾?, html: '<strong>野껋럩?녕몴??誘れ벉:</strong> ?怨뚯퍢 ?醫딆뻣 ?紐꾩뜚????쀫립??뤿선 ??됰선 ???뇧 野껋럩?녕몴醫롮뵠 5:1 ??곴맒??낅빍??' },
    ],
    guides: [
      { icon: '??, html: '<strong>1??ｍ? 筌≪럩毓??袁⑹뵠???닌딄퍥??/strong> ???얜챷???類ㅼ벥 ???遺억펷????筌뤴뫚紐???뽰삢 ????륁뵡 筌뤴뫀????뽮퐣嚥???毓썸④쑵???뽰벥 ?됰뜄????臾믨쉐??뤾쉭??' },
      { icon: '?諭?, html: '<strong>2??ｍ? K-????紐꾨씜 ??苑?癒?퐣 ?⑤벀???類ㅼ뵥</strong> ??<a href="https://www.k-startup.go.kr" target="_blank" style="color:var(--blue)">k-startup.go.kr</a>?癒?퐣 筌뤴뫁彛???깆젟??筌왖???癒?봄???類ㅼ뵥??뤾쉭??' },
      { icon: '??', html: '<strong>3??ｍ? ??뺤첒夷뚳쭖?곸젔 餓Β??/strong> ???????筌≪럩毓쏙쭪袁れ뵊???얜?利??뚢뫁苑??筌≪럩毓??대Ŋ???袁⑥쨮域밸챶????獄쏆룇?앾쭖???룰봄?쒖쥙?????ゅ첎臾먮빍??' },
    ],
    summary_stats: { benefit_label: '筌ㅼ뮆? 1???뜚', processing_period_label: '1??, issue_count: 3, source_label: '餓λ쵌由곈겫?' },
  },
};

// ???? showDetail: 獄쏄퉮肉???怨멸쉭 API ??μ뵬 ???뮞 ?怨쀪퐨 ??嚥≪뮇類???媛?????????????????
async function showDetail(policyId) {
  const _onAnalysisPage = location.pathname === '/analysis';
  if (!_onAnalysisPage) {
    // ??삘뀲 ??륁뵠筌왖?癒?퐣 ?紐꾪뀱: policyId ??????/analysis嚥???猷?    _cacheDetailCard(policyId, _findPortfolioCard(policyId));
    try { localStorage.setItem('benefic_detail_id', policyId); } catch(e) {}
    window.location.href = '/analysis';
    return; // analysis ??륁뵠筌왖??load ?紐껊굶??? showDetail?????뉒빊?쀫맙
  }
  // analysis.html?癒?퐣 筌욊낯???紐꾪뀱??野껋럩?? ??猷???곸뵠 獄쏅뗀以????쐭筌?

  // 1) 獄쏄퉮肉???怨멸쉭 API ?怨쀪퐨 (policy_id ??μ뵬 疫꿸퀣?)
  const backendDetail = await _fetchDetailFromBackend(policyId);
  if (backendDetail) {
    renderDetail(backendDetail);
    return;
  }

  // 2) AI ?브쑴苑???_currentPortfolio 筌?Ŋ??(?類μ넇??policy_id ??깊뒄筌???됱뒠)
  const card = _findPortfolioCard(policyId) || _loadDetailCard(policyId);
  if (card) {
    renderDetail(_detailFromCachedCard(card, policyId));
    return;
  }

  // 3) _STATIC_DETAIL????됱몵筌?????
  if (_STATIC_DETAIL[policyId]) {
    renderDetail(_STATIC_DETAIL[policyId]);
    return;
  }

  // 4) ?癒??筌ㅼ뮇???紐껊쑔????媛?  const excerptFallback = await _detailFromExcerptFallback(policyId);
  if (excerptFallback) {
    renderDetail(excerptFallback);
    return;
  }

  // 5) 筌ㅼ뮇???類ㅼ읅 ??媛?  renderDetail(_buildDetailFromDB(policyId));
}

// ?怨멸쉭 API ??쎈솭 ??筌ㅼ뮇????덇땀??issue-item ??밴쉐
function _buildIssuesFromDB() {
  return [{ icon:'?諭꾪닔', html:'<strong>?怨멸쉭 ?怨쀬뵠???類ㅼ뵥 ?袁⑹뒄:</strong> ??쎈뱜??곌쾿 ?癒?뮉 ??뺤쒔 筌왖?怨쀬몵嚥??怨멸쉭 ?癒????븍뜄???? 筌륁궢六??щ빍??' }];
}

// ?怨멸쉭 API ??쎈솭 ??筌ㅼ뮇????덇땀??guide-item ??밴쉐
function _buildGuidesFromDB() {
  return [
    { icon:'??, html:'<strong>1??ｍ? AI ?브쑴苑???쎈뻬</strong> ???怨룸뼊 "??랁닋 揶쎛?關苑?AI ?브쑴苑???뽰삂??띾┛" 甕곌쑵????袁ⓥ뀮?紐꾩뒄.' },
    { icon:'?遊?, html:'<strong>2??ｍ? ?怨멸쉭 ??덉쨮?⑥쥙臾?/strong> ???醫롫뻻 ????덉뵬 ?類ㅼ퐠???怨멸쉭癰귣떯由곁몴???쇰뻻 ??곷선雅뚯눘苑??' },
    { icon:'?逾?, html:'<strong>3??ｍ? ?⑤벊???醫롪퍕 ??륁뵠筌왖 ?類ㅼ뵥</strong> ??<a href="https://www.bokjiro.go.kr" target="_blank" style="color:var(--blue)">bokjiro.go.kr</a>?癒?퐣 筌ㅼ뮇???⑤벀?х몴??類ㅼ뵥??뤾쉭??' },
  ];
}

// ?怨멸쉭 API ??쎈솭 ??筌ㅼ뮇????덉삂 癰귣똻???detailData ??밴쉐
function _buildDetailFromDB(policyId) {
  const policyName = String(policyId || '?類ㅼ퐠 ?怨멸쉭');
  return {
    policy_header: { policy_name: policyName, eligibility_percent: 60, progress_color: 'blue', icon: '?諭?,
      percent_class: 'mid', badge_label: '???類ㅼ뵥 ?袁⑹뒄', badge_class: 'badge-blue',
      subtitle: '?怨멸쉭 ?怨쀬뵠???類ㅼ뵥 ?袁⑹뒄' },
    issues:  _buildIssuesFromDB(),
    guides:  _buildGuidesFromDB(),
    summary_stats: { benefit_label: '-', processing_period_label: '1~2揶쏆뮇??, issue_count: 1, source_label: 'BenePick' },
  };
}

function _makeFallbackDetail(policyId) {
  return _buildDetailFromDB(policyId);
}

// ???? ?????????遺얇늺 ???쐭筌?????????????????????????????????????????????????????????????????????????
async function loadPortfolio() {
  _renderPortfolioStatic();
}

function _renderPortfolioData(data) {
  const hero = data.portfolio_hero;

  // hero ????묒굺??
  const bigNum = document.querySelector('.portfolio-hero .big-num');
  if (bigNum) bigNum.textContent = hero.total_expected_benefit_label;

  // hero ??살구 p ??볥젃 (??甕곕뜆??p)
  const heroPs = document.querySelectorAll('.portfolio-hero p');
  if (heroPs.length >= 2) heroPs[1].textContent = hero.portfolio_basis_label;
  else if (heroPs.length === 1) heroPs[0].textContent = hero.portfolio_basis_label;

  // hero 獄쏄퀣?: 筌앸맩???醫롪퍕 N椰?/ 鈺곌퀗援?癰귣똻????M椰?
  const heroBadges = document.querySelectorAll('.portfolio-hero span');
  if (heroBadges.length >= 2) {
    heroBadges[0].textContent = `??筌앸맩???醫롪퍕 揶쎛??${hero.ready_count}椰?;
    heroBadges[1].textContent = `??鈺곌퀗援?癰귣똻????${hero.conditional_count}椰?;
  }

  // port-grid 燁삳?諭????쐭筌?
  const portGrid = document.querySelector('.port-grid');
  if (portGrid) {
    const statusBadge = s =>
      s === 'ready'       ? '<span class="badge badge-green">筌앸맩???醫롪퍕</span>' :
      s === 'conditional' ? '<span class="badge badge-blue">鈺곌퀗援??類ㅼ뵥 ?袁⑹뒄</span>' :
                            '<span class="badge badge-orange">鈺곌퀗援??봔鈺?/span>';

    const cards = data.portfolio_items.map(item => `
      <div class="port-grid-card" onclick="showDetail('${item.policy_id}')" style="cursor:pointer;">
        <div class="icon">${item.icon}</div>
        <h4>${item.policy_name}</h4>
        <div class="amount">${item.expected_benefit_label}</div>
        <div class="period">${item.benefit_period_label}</div>
        <div style="margin-top:10px;">${statusBadge(item.status)}</div>
      </div>`).join('');

    // 筌띾뜆?筌띾맩肉?"?類ㅼ퐠 ???곕떽???띾┛" 燁삳?諭??醫?
    portGrid.innerHTML = cards + `
      <div class="port-grid-card" style="background:var(--gray-50);border-style:dashed;cursor:pointer;" onclick="showTab('dashboard')">
        <div class="icon">??/div>
        <h4 style="color:var(--gray-500);">?類ㅼ퐠 ??癰귣떯由?/h4>
        <div class="amount" style="color:var(--gray-300);font-size:14px">????뺣궖??뺤쨮 ??猷?/div>
        <div class="period" style="color:var(--gray-400)">?袁⑷퍥 筌뤴뫖以??類ㅼ뵥</div>
      </div>`;
  }

  // CTA ?諭??
  const ctaH3 = document.querySelector('.cta-text h3');
  const ctaP  = document.querySelector('.cta-text p');
  if (ctaH3) ctaH3.textContent = data.portfolio_cta.headline;
  if (ctaP)  ctaP.textContent  = data.portfolio_cta.description;
}

// 獄쏄퉮肉????곸뱽 ????롫굡?꾨뗀逾??類ㅼ읅 ?遺얇늺 ?醫? (疫꿸퀣??HTML 域밸챶?嚥?
function _renderPortfolioStatic() {
  // runAnalysis ??_currentPortfolio 筌?Ŋ?녶첎? ??됱몵筌?域밸㈇援ф에????쐭筌?
  if (_currentPortfolio && _currentPortfolio.length > 0) {
    const statusBadge = s =>
      s === 'ready'       ? '<span class="badge badge-green">筌앸맩???醫롪퍕</span>' :
      s === 'conditional' ? '<span class="badge badge-blue">鈺곌퀗援??類ㅼ뵥 ?袁⑹뒄</span>' :
                            '<span class="badge badge-orange">鈺곌퀗援??봔鈺?/span>';

    const portGrid = document.querySelector('.port-grid');
    if (portGrid) {
      const cards = _currentPortfolio.map(card => {
        const score  = card.??랁닋?類ｌぇ || card.eligibility_percent || 0;
        const name   = card.??뺥돩??살구 || card.policy_name || '';
        const status = score >= 80 ? 'ready' : score >= 60 ? 'conditional' : 'blocked';
        return `
          <div class="port-grid-card" onclick="showDetail('${card.policy_id}')" style="cursor:pointer;">
            <div class="icon">${card.icon || '?諭?}</div>
            <h4>${escHtml(name)}</h4>
            <div class="amount">${escHtml(card.benefit_label || '-')}</div>
            <div class="period">${escHtml(card.subtitle || '-')}</div>
            <div style="margin-top:10px;">${statusBadge(status)}</div>
          </div>`;
      }).join('');
      portGrid.innerHTML = cards + `
        <div class="port-grid-card" style="background:var(--gray-50);border-style:dashed;cursor:pointer;" onclick="showTab('dashboard')">
          <div class="icon">??/div>
          <h4 style="color:var(--gray-500);">?類ㅼ퐠 ??癰귣떯由?/h4>
          <div class="amount" style="color:var(--gray-300);font-size:14px">????뺣궖??뺤쨮 ??猷?/div>
          <div class="period" style="color:var(--gray-400)">?袁⑷퍥 筌뤴뫖以??類ㅼ뵥</div>
        </div>`;
    }
  }
  // ?類ㅼ읅 HTML 燁삳?諭??域밸챶?嚥??癒???袁ⓓ℡칰猿딅즲 ????
}

// ???? runAnalysis: API ?紐꾪뀱嚥??대Ŋ猿???????????????????????????????????????????????????????????
async function runAnalysis() {
  const overlay = document.getElementById('aiLoading');
  overlay.classList.add('show');

  try {
    const payload = collectFormData();
    const data    = await apiFetch('/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    _currentQueryId  = data.query_id;
    // FastAPI: data.cards / ??媛? data.dashboard_data.recommendation_cards
    const rawCards = data.cards || data.dashboard_data?.recommendation_cards || [];

    // policy_id??獄쏄퉮肉???癒?궚???醫???랁??怨멸쉭 API ??,
    // ?袁⑥뵭??野껋럩??癒?춸 ??뺥돩??살구 ????뉩紐? ??筌???살쨮 ?????뺣뼄.
    _currentPortfolio = rawCards.map(card => {
      const name = card.??뺥돩??살구 || card.policy_name || '';
      const slug = name.replace(/[^\w揶쎛-??/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      if (!card._css) card._css = _scoreToCSS(card.??랁닋?類ｌぇ || card.eligibility_percent || 60);
      return { ...card, policy_id: card.policy_id || slug };
    });
    _savePortfolio(_currentPortfolio); // ??륁뵠筌왖 ??猷??袁⑸퓠???醫?

    // ???쐭筌띻낮猷?筌?Ŋ??? ??덉뵬??id ?紐낅뱜????????怨멸쉭 ??????筌띲끉臾??븍뜆?ょ㎉?? 獄쎻뫗???뺣뼄.
    const dashboardData = data.dashboard_data || {};
    dashboardData.recommendation_cards = _currentPortfolio;
    renderDashboard(dashboardData);

    animateProgressBars(document.querySelector('.policy-list') || document, 80);

    showToast('?브쑴苑???袁⑥┷??뤿???щ빍?? ??, 'success');

  } catch (e) {
    showToast('?브쑴苑???쎈솭: ' + e.message);
    console.error('runAnalysis error:', e);
  } finally {
    overlay.classList.remove('show');
  }
}



function toggleCheck(el) {
  el.classList.toggle('done');
  const box = el.querySelector('.check-box');
  box.textContent = el.classList.contains('done') ? '?? : '';
}

// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
// 野꺜??筌뤴뫀諭???DB ?怨뺣짗 甕곌쑴??
// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름

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
    ['筌????遺욧쉭','疫꿸퀣???븐넞','??쇰씜疫뀀맩肉?,'?????곸뵬獄쏄퀣?燁삳?諭?,'?紐꾩뵥 ??깆쁽??,'?袁⑤짗??롫뼣','?關釉??筌왖??,'???筌?揶쎛鈺?].forEach(t => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = 'background:var(--gray-100);border:none;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit;transition:all .15s';
      b.onmouseover = () => b.style.background = 'var(--blue-light)';
      b.onmouseout  = () => b.style.background = 'var(--gray-100)';
      b.onclick = () => { document.getElementById('search-input').value = t; doSearch(); };
      qw.appendChild(b);
    });
  }

  // ????뺣궖??뽯퓠??野꺜??깅선????띻볼獄쏆룇? 野껋럩???癒?짗 ??쎈뻬
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
  list.innerHTML = _loadingHTML('?類ㅼ퐠 筌뤴뫖以???븍뜄???삳뮉 餓?..');
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
    if (badge) badge.textContent = `(??${total.toLocaleString()}椰?`;
    list.innerHTML = results.length ? results.map(_renderPolicyCard).join('') : _emptyHTML('?類ㅼ퐠????곷뮸??덈뼄.');
    if (pag) pag.innerHTML = _paginationHTML(page, totalPages, 'loadBrowse');
  } catch(e) {
    list.innerHTML = _errorHTML('筌뤴뫖以?嚥≪뮆諭???쎈솭: ' + e.message);
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
  document.getElementById('search-status').textContent = '野꺜??餓λ쵃??;
  document.getElementById('search-results').innerHTML  = _loadingHTML('DB?癒?퐣 野꺜??餓?..');
  document.getElementById('search-pagination').style.display = 'none';

  const isNatural = (q.length >= 10 && /\s/.test(q)) ||
                    /??좊선|??랁???獄쏆룄?????젻|筌≪뼚釉??몃Þ?|??堉???逾??.test(q);
  try {
    let results = [], statusMsg = '', total = 0, totalPages = 1;
    const useBackend = await _checkBackend();
    if (isNatural) {
      document.getElementById('search-status').textContent = '?夷?AI ?브쑴苑?餓λ쵃??;
      let all = useBackend
        ? (await apiFetch('/search/natural?' + new URLSearchParams({q, top_k:100}))).results||[]
        : await localNaturalSearch(q, 100);
      total = all.length; totalPages = Math.ceil(total/_perPage)||1;
      results = all.slice((page-1)*_perPage, page*_perPage);
      statusMsg = `?夷?AI 野꺜??野껉퀗??${total}椰?;
    } else {
      if (useBackend) {
        const p = new URLSearchParams({keyword:q, limit:String(_perPage), offset:String((page-1)*_perPage)});
        const data = await apiFetch('/search/keyword?'+p.toString());
        results = data.results||[]; total = data.count||results.length;
        totalPages = Math.ceil(total/_perPage)||1; statusMsg = `DB 野꺜??野껉퀗??${total}椰?;
      } else {
        const all = localKeywordSearch(q,'','',500);
        total = all.length; totalPages = Math.ceil(total/_perPage)||1;
        results = all.slice((page-1)*_perPage, page*_perPage); statusMsg = `野꺜??野껉퀗??${total}椰?;
      }
      if (results.length < 5 && page === 1) {
        document.getElementById('search-status').textContent = '?夷?AI 癰귣똻??野꺜??餓λ쵃??;
        const extras = useBackend
          ? (await apiFetch('/search/natural?'+new URLSearchParams({q,top_k:20}))).results||[]
          : await localNaturalSearch(q, 20);
        const names = new Set(results.map(r=>r['??뺥돩??살구']||r.??뺥돩??살구));
        results = [...results, ...extras.filter(r=>!names.has(r['??뺥돩??살구']||r.??뺥돩??살구))];
        total = results.length; totalPages = 1;
        statusMsg = `野꺜??野껉퀗??${total}椰?(AI 癰귣똻????釉?`;
      }
    }
    document.getElementById('search-status').textContent = statusMsg;
    renderSearchResults(results);
    const pag = document.getElementById('search-pagination');
    if (pag && totalPages > 1) { pag.style.display='block'; pag.innerHTML=_paginationHTML(page,totalPages,'doSearch'); }
  } catch(e) {
    showToast('野꺜????살첒: ' + e.message);
    document.getElementById('search-status').textContent = '';
    document.getElementById('search-results').innerHTML = _errorHTML(e.message);
  } finally { _searchLoading = false; }
}

async function doDashSearch() {
  const q = (document.getElementById('dash-search-input')?.value || '').trim();
  if (!q) { showToast('野꺜??깅선????낆젾??뤾쉭??'); return; }

  // 野꺜??깅선??sessionStorage?????館釉???search.html嚥???猷?
  // (??륁뵠筌왖 ??猷???main.js揶쎛 ?????곕┷筌롫똻苑??袁⑥삋 initSearch()揶쎛 ??? 揶쏅Ŋ????癒?짗 野꺜??
  try { sessionStorage.setItem('benefic_search_query', q); } catch(e) {}
  window.location.href = '/search';
}

function _renderPolicyCard(p) {
  const name    = escHtml(p['??뺥돩??살구']    ||p.??뺥돩??살구    ||'-');
  const field   = escHtml(p['??뺥돩??삵뀋??]  ||p.??뺥돩??삵뀋?? ||'');
  const stype   = escHtml(p['筌왖?癒????]    ||p.筌왖?癒????   ||'');
  const org     = escHtml((p['???疫꿸퀗?筌?] ||p.???疫꿸퀗?筌? ||'Gov24').substring(0,14));
  const ddline  = escHtml(p['?醫롪퍕疫꿸퀬釉?]    ||p.?醫롪퍕疫꿸퀬釉?   ||'');
  const target  = p['筌왖?癒???]    ||p.筌왖?癒???   ||'';
  const content = p['筌왖?癒?땀??]    ||p.筌왖?癒?땀??   ||'';
  const tel     = escHtml(p['?袁れ넅?얜챷??]    ||p.?袁れ넅?얜챷??   ||'');
  const url     = escHtml(p['?怨멸쉭鈺곌퀬?턷rl'] ||p.?怨멸쉭鈺곌퀬?턷rl  ||'');
  const scorePct = p.score!==undefined ? Math.round(p.score*100) : null;
  const iconMap  = {'?袁㏉닊':'?裕?,'??곸뒠亦?:'???,'??뺥돩??:'??쎿닼?,'雅뚯눊援?:'?猷?,'?⑥쥙??:'?裕?,'?대Ŋ??:'???,'??롮┷':'?猷?,'?紐꾩뵥':'?維?,'?關釉??:'??,'揶쎛鈺?:'?維??낆쐣?굿?낆쐣?,'疫꿸퀣???븐넞':'??녔닼?,'疫뀀뜆??:'?猷?,'筌≪럩毓?:'??','癰귣떯援?:'?萸?};
  const icon = iconMap[stype]||iconMap[field]||'?諭?;
  const policyKey = p.policy_id || p['policy_id'] || (p['??뺥돩??살구']||p.??뺥돩??살구||'').replace(/\s+/g,'-');
  const isScrapped = _isScrapped(policyKey);
  return `<div class="policy-card-wrap" style="position:relative;margin-bottom:12px">
    <div class="policy-card mid" onclick="goToPolicyDetailPage('${policyKey}')" style="cursor:pointer">
      <!-- ??scrap-btn?? .policy-card 筌욊낫???癒?뻼??곗쨮 獄쏄퀣??(position:absolute 疫꿸퀣? 癰귣똻?? -->
      <button
        class="scrap-btn ${isScrapped ? 'active' : ''}"
        data-policy-id="${policyKey}"
        onclick="event.stopPropagation(); toggleScrap('${policyKey}', this)"
        title="${isScrapped ? '??쎄쾿????곸젫' : '??쎄쾿??????}"
        aria-label="${isScrapped ? '??쎄쾿????곸젫' : '??쎄쾿??????}"
      >${isScrapped ? '?? : '??}</button>
      <div class="policy-top-row">
        <div class="policy-left" style="padding-right:40px">
          <div class="policy-icon blue">${icon}</div>
          <div class="policy-meta">
            <h4>${name}</h4>
            <p>${field}${field&&stype?' 夷?':''}${stype}</p>
            <div class="policy-badges">
              <span class="badge badge-blue">${org}</span>
              ${ddline?`<span class="badge badge-gray">疫꿸퀬釉? ${ddline}</span>`:''}
              ${scorePct!==null?`<span class="badge badge-green">?醫롪텢??${scorePct}%</span>`:''}
            </div>
          </div>
        </div>
      </div>
      ${target?`<p style="font-size:12px;color:var(--gray-500);margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100);line-height:1.6">${escHtml(target.substring(0,140))}${target.length>140?'??:''}</p>`:''}
      ${content?`<p style="font-size:12px;color:var(--blue);margin-top:6px;font-weight:600">?裕?${escHtml(content.substring(0,100))}${content.length>100?'??:''}</p>`:''}
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        ${tel?`<span style="font-size:11px;color:var(--gray-500)">?諭?${tel}</span>`:''}
        ${url?`<a href="${url}" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none;font-weight:600;margin-left:auto">?逾??怨멸쉭 癰귣떯由???/a>`:''}
      </div>
    </div>
  </div>`;
}

function goToPolicyDetailPage(policyKey) {
  try { localStorage.setItem('benefic_detail_id', policyKey); } catch(e) {}
  window.location.href = '/policy-detail';
}

function renderSearchResults(results) {
  const el = document.getElementById('search-results');
  if (!results||!results.length) { el.innerHTML=_emptyHTML('野꺜??野껉퀗?드첎? ??곷뮸??덈뼄'); return; }
  el.innerHTML = results.map(_renderPolicyCard).join('');
}

function _loadingHTML(msg){return`<div style="text-align:center;padding:40px 20px;color:var(--gray-500)"><div style="font-size:28px;margin-bottom:10px">??/div><p style="font-size:14px;font-weight:600">${msg}</p></div>`;}
function _emptyHTML(msg){return`<div style="text-align:center;padding:60px 20px;color:var(--gray-500)"><div style="font-size:40px;margin-bottom:12px">?逾?/div><p style="font-size:15px;font-weight:600;margin-bottom:6px">${msg}</p><p style="font-size:13px">??삘뀲 ??쇱뜖??뺢돌 ??쀬겱?????????紐꾩뒄.</p></div>`;}
function _errorHTML(msg){return`<div style="text-align:center;padding:40px 20px;color:var(--red)"><div style="font-size:28px;margin-bottom:10px">?醫묓닔</div><p style="font-size:13px">${escHtml(msg)}</p></div>`;}
function _paginationHTML(page,totalPages,fnName){
  if(totalPages<=1)return'';
  const s=a=>a?'background:var(--blue);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit':'background:var(--gray-100);color:var(--gray-700);border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit';
  const st=Math.max(1,page-2),en=Math.min(totalPages,page+2);
  let h='<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">';
  if(page>1)h+=`<button onclick="${fnName}(${page-1})" style="${s(false)}">????곸읈</button>`;
  for(let i=st;i<=en;i++)h+=`<button onclick="${fnName}(${i})" style="${s(i===page)}">${i}</button>`;
  if(page<totalPages)h+=`<button onclick="${fnName}(${page+1})" style="${s(false)}">??쇱벉 ??/button>`;
  return h+'</div>';
}



function closeDashSearch() {
  document.getElementById('dash-search-results-wrap').classList.remove('visible');
  document.getElementById('dash-search-input').value = '';
  document.getElementById('dash-search-status').textContent = '';
  document.getElementById('dash-search-results').innerHTML = '';
}

// ???? COMMUNITY MODULE ????
const CAT_LABELS = {
  popular: { label: '???硫몃┛疫꼲', cls: 'cat-popular' },
  qna:     { label: '??筌욌뜄揆',   cls: 'cat-qna' },
  review:  { label: '????袁㏓┛',   cls: 'cat-review' },
  regional:{ label: '?諭?筌왖??,   cls: 'cat-regional' },
  anonymous:{ label:'?????ъ구',   cls: 'cat-anonymous' },
  notice:  { label: '?諭??⑤벊?',   cls: 'cat-notice' },
};

const SAMPLE_POSTS = [
  { id: 1, category: 'notice', title: '甕곗쥓苑???뚣끇???딅뼒 ??쎈탞 ??덇땀 ???, content: '??덈??뤾쉭?? 甕곗쥓苑??????낅빍??\n??뺣탵??癰귣벊? ?뚣끇???딅뼒揶쎛 ??쎈탞??뤿???щ빍??\n\n??랁닋 ?袁㏓┛, 筌욌뜄揆, 筌왖???類ｋ궖 ????쇰펶????곷튊疫꿸퀡? ??롫떊雅뚯눘苑??\n??뺤쨮??野껋?肉???⑤벊???롢늺 ??筌띾‘? ?브쑬諭???袁???獄쏆룇??????됰선?? ???, author: '甕곗쥓苑???', date: '2025-01-10', likes: 34, region: '' },
  { id: 2, category: 'review', title: '筌????遺욧쉭 筌왖????뺣탵??獄쏆룇釉??곸뒄!! ??20筌띾슣???議쇰?, content: '??덈??뤾쉭????뽰뒻 ?????럡??????25???띯뫁???뱀뵠?癒?뒄.\n甕곗쥓苑??뚯몵嚥???랁닋 ?類ｌぇ 92%??⑦??????獄쏆꼷?딂쳸?륁벥 ??롢늺???醫롪퍕??덈뮉??n筌욊쑴彛ⓩ에??諭??癒?뮸??덈뼄!!!\n\n?袁⑹뿯?醫됲???沃섎챶????紐?遺용튊 ??곸뒄. ????域밸㈇援????????뺤쓰 ??덉뵭??덈뼄揶쎛 ??쇰뻻 ?醫롪퍕??뉕탢?醫롮뒄.\n??삳굶 ???뵠??', author: '?????럡筌???, date: '2025-01-12', likes: 87, region: '??뽰뒻 ?????럡' },
  { id: 3, category: 'qna', title: '?????곸뵬獄쏄퀣?燁삳?諭????굣 疫꿸퀣?????堉멨칰???롪돌??', content: '??덈??뤾쉭?? ?띯뫁毓썰빳???餓λ쵐??28??곸뿯??덈뼄.\n甕곗쥓苑??뚮퓠??獄쏄퀣?燁삳?諭???랁닋 ?類ｌぇ??85%嚥???륁넅?遺얜쑓\n?諭?????굣 疫꿸퀣????類μ넇????堉멨칰???롫뮉筌왖 ?袁⑸뻻?????④쑴?듿첎???\n???뺍 ??륁뿯????덈뮉???우뮇媛?袁? 椰꾧퉮???깃퐣??', author: '?띯뫁?????彛?, date: '2025-01-13', likes: 12, region: '' },
  { id: 4, category: 'regional', title: '?봔????곸뒲????筌??덌쭪??癒?쉽???類ｋ궖 ?⑤벊???곸뒄', content: '?봔????곸뒲????椰꾧퀣竊?筌??덆겫袁⑤굶!\n??곸뒲????筌??덌쭪??癒?쉽?怨쀫퓠??癰귢쑬猷?癰귣벊? ?怨룸뼖???얜?利뷸에???곸㉢??덈뼄.\n雅뚯눘?? ??곸뒲???닌딄퍕 3筌?n??곸겫??볦퍢: ??깆뵬 09:00-18:00\n\n甕곗쥓苑??뚯뵠??揶쏆늿????뽰뒠??롢늺 筌욊쑴彛?筌띾‘? ??쀪문 獄쏆룇??????됰선??', author: '??곸뒲??筌???, date: '2025-01-14', likes: 31, region: '?봔????곸뒲???? },
  { id: 5, category: 'anonymous', title: '癰귣벊? ?醫롪퍕??筌≪?逾??野?揶쏆늿釉??筌띿빘苑??욱???됰선??..', content: '雅뚯눖??癒?퐣 "??域밸챶??椰?獄쏆룇釉????"??곕뮉 ??뽮퐨???醫됯펾 ?怨쀫연??n獄쏆룇???癒?봄????덈뮉?怨뺣즲 ?醫롪퍕??筌???랁???됰선??\n\n?諭????쑴???野껋?肉???됱몵?????④쑴?듿첎???\n??堉멨칰?筌띾뜆????類ｂ봺??뤿?遺? 亦낃낫???곸뒄.', author: '??ъ구', date: '2025-01-15', likes: 55, region: '' },
];

let commPosts = [];
let currentFilter = 'all';
let currentDetailId = null;

const AI_TIPS = [
  '?裕?筌????遺욧쉭 筌왖?癒? ?袁⑹뿯?醫됲у첎? ?袁⑸땾! ?醫롪퍕 ??獄쏆꼶諭???類ㅼ뵥??뤾쉭??',
  '?裕??????곸뵬獄쏄퀣?燁삳?諭???띯뫁毓?癒껊９?깍쭪怨몄쁽 筌뤴뫀紐??醫롪퍕 揶쎛?館鍮??덈뼄.',
  '?裕?癰귣벊? ??쀪문?? 餓λ쵎????롮죯??揶쎛?館釉?野껋럩??첎? 筌띾‘釉?? ???쀬눊????類ㅼ뵥??뤾쉭??',
  '?裕?筌???袁⑸튋?④쑴伊??筌띲끉??70筌띾슣????뱀뿯 ???類?疫꿸퀣肉ф묾?筌ㅼ뮆? 6%??獄쏆룇??????됰선??',
  '?裕?筌띾뜆?у쳞?우뺏 獄쏅뗄??㎗?롫뮉 ???굣???얜떯???띿쓺 ?醫롪퍕 揶쎛?館鍮??덈뼄.',
];

function initComm() {
  const stored = localStorage.getItem('benefic_posts');
  if (stored) {
    commPosts = JSON.parse(stored);
  } else {
    commPosts = JSON.parse(JSON.stringify(SAMPLE_POSTS));
    savePosts();
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
  if (diff === 0) return '??삳뮎';
  if (diff === 1) return '??곸젫';
  if (diff < 7) return diff + '????;
  return dateStr;
}

function filterComm(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.comm-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCommPosts();
}

function renderCommPosts() {
  const listEl = document.getElementById('commPostList');
  const emptyEl = document.getElementById('commEmpty');
  if (!listEl) return;

  let filtered = currentFilter === 'all' ? commPosts
    : currentFilter === 'popular' ? commPosts.filter(p => p.likes >= 20).sort((a,b) => b.likes - a.likes)
    : commPosts.filter(p => p.category === currentFilter);

  filtered = [...filtered].reverse(); // newest first (for user posts)

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = filtered.map(post => {
      const cat = getCatInfo(post.category);
      return `
        <div class="comm-post-card" onclick="showCommDetail(${post.id})">
          <span class="comm-post-cat-badge ${cat.cls}">${cat.label}</span>
          <div class="comm-post-body">
            <h4>${escHtml(post.title)}</h4>
            <p>${escHtml(post.content.substring(0, 80))}${post.content.length > 80 ? '...' : ''}</p>
            <div class="comm-post-meta">
              <span class="comm-meta-item author">?維 ${escHtml(post.author)}</span>
              ${post.region ? `<span class="comm-meta-item">?諭?${escHtml(post.region)}</span>` : ''}
              <span class="comm-meta-item">?釉?${timeAgo(post.date)}</span>
            </div>
          </div>
          <div class="comm-post-right">
            <div class="comm-stats">
              <span class="comm-stat">??욱닔 ${post.likes}</span>
            </div>
          </div>
        </div>`;
    }).join('');
    Array.from(policyList.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
  }

  renderHotList('hotPostList');
  updateStats();
}

function renderHotList(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const hot = [...commPosts].sort((a,b) => b.likes - a.likes).slice(0, 5);
  el.innerHTML = hot.map((p, i) => `
    <div class="hot-item" onclick="showCommDetail(${p.id})">
      <span class="hot-num">${i+1}</span>
      <span class="hot-title">${escHtml(p.title)}</span>
      <span class="hot-likes">??욱닔${p.likes}</span>
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

  document.getElementById('commDetailCard').innerHTML = `
    <div class="comm-detail-meta">
      <span class="comm-post-cat-badge ${cat.cls}">${cat.label}</span>
      ${post.region ? `<span class="comm-meta-item">?諭?${escHtml(post.region)}</span>` : ''}
      <span class="comm-meta-item author">?維 ${escHtml(post.author)}</span>
      <span class="comm-meta-item">?釉?${timeAgo(post.date)}</span>
    </div>
    <h2>${escHtml(post.title)}</h2>
    <div class="comm-detail-content">${escHtml(post.content)}</div>
    <button class="comm-like-btn ${isLiked ? 'liked' : ''}" id="likeBtn" onclick="toggleLike(${id})">
      ${isLiked ? '??욱닔' : '?夷?} ?ル뿭釉??<span id="likeCount">${post.likes}</span>
    </button>
  `;

  renderHotList('hotPostList2');
  document.getElementById('comm-list-view').style.display = 'none';
  document.getElementById('comm-detail-view').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (!title) { alert('??뺛걠????낆젾??곻폒?紐꾩뒄.'); return; }
  if (!content) { alert('??곸뒠????낆젾??곻폒?紐꾩뒄.'); return; }

  const newPost = {
    id: Date.now(),
    category: cat,
    title,
    content,
    author: '??μ젟?袁⑤뻷',
    date: new Date().toISOString().slice(0,10),
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

// community 筌욊낯???臾롫젏 ???癒?짗 ???쐭筌?
(function() {
  const currentPage = location.pathname;
  if (currentPage === '/community') {
    renderCommPosts();
    // insight widget ?λ뜃由??
    const p = document.getElementById('iStatPosts');
    const l = document.getElementById('iStatLikes');
    if (p) p.textContent = commPosts.length;
    if (l) l.textContent = commPosts.reduce((s, post) => s + post.likes, 0);
    insightAnimateBars();
    // FAB ??뽯뻻
    const fab = document.getElementById('fabWrite');
    if (fab) fab.classList.add('visible');
  }
})();

// ???? INSIGHT WIDGET ????
const INSIGHT_REVIEWS = [
  { text: '?醫롪퍕????룹퍟癰귣????類ｌ춾 揶쏄쑵???곸뒄!', tag: '#筌???遺욧쉭筌왖??夷??????럡筌??? },
  { text: '??뺤첒 餓Β???? 雅뚯눖??源낆쨯?源낅궚?????뼎!', tag: '#??곸뵬獄쏄퀣?燁삳?諭?夷??띯뫁?????彛? },
  { text: '甕곗쥓苑???類ｍ뀋??筌뤾퀡?????쀪문 獄쏆뮄猿??됰선??', tag: '#???굣?硫몄빵筌?夷???ъ구' },
  { text: '??20筌띾슣??筌왖????쇱젫嚥?獄쏆룇釉??щ빍???議쇰?, tag: '#筌???遺욧쉭筌왖??夷???뽰뒻筌??? },
  { text: '癰귣벊? ?醫롪퍕, ?諭肉??亦낅슢???됱뒄. 筌띿빘苑??? 筌띾뜆苑??', tag: '#??ъ구?⑥쥓? 夷???ъ구' },
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

// ???? Language Selector ????
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

// ???? ONBOARDING GUIDE ????????????????????????????????????????????????????????????????????????????????????
const ONBOARDING_STORAGE_KEY = 'benefic_seen_guide_v20260424';

function initOnboarding() {
  const guideEl = document.getElementById('onboardingGuide');
  if (!guideEl) return;
  let seen;
  try { seen = localStorage.getItem(ONBOARDING_STORAGE_KEY); } catch(e) {}
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
  try { localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true'); } catch(e) {}
  closeOnboarding();
}

// ???? ??뺤첒 燁삳?諭??醫? (筌ｋ똾寃???곸젫) ??????????????????????????????????????????????????????????????????
// 雅뚯눘?? window.load ?꾩뮆媛???????醫롫섧??롢늺 ?遺욧땀??쀫맙????쇳맜?袁⑸퓠 揶쏅돉?
//       HTML onclick?癒?퐣 ReferenceError揶쎛 獄쏆뮇源?????袁⑸열 ??쇳맜?袁⑥쨮 ??猷?
function toggleDocCard(el, originalText) {
  const p = el.querySelector('.doc-info p');
  const status = el.querySelector('.doc-status');
  if (el.classList.contains('ready')) {
    el.classList.remove('ready');
    status.textContent = '??;
    p.removeAttribute('data-i18n');
    p.textContent = originalText;
  } else {
    el.classList.add('ready');
    status.textContent = '??;
    p.removeAttribute('data-i18n');
    p.textContent = '??餓Β???袁⑥┷';
  }
}

function animateProgressBars(root = document, baseDelay = 300) {
  const bars = Array.from(root.querySelectorAll('.progress-fill'));
  bars.forEach((bar, i) => {
    const finalW = bar.dataset.finalWidth || bar.style.width;
    if (!finalW || finalW === '0' || finalW === '0%' || finalW === '0px') return;
    bar.dataset.finalWidth = finalW;
    bar.style.width = '0%';
    window.setTimeout(() => {
      bar.style.width = finalW;
    }, baseDelay + i * 80);
  });

  // Safety net: if the browser skips the transition during first paint,
  // restore the intended width so gauges never stay invisible.
  window.setTimeout(() => {
    bars.forEach(bar => {
      const finalW = bar.dataset.finalWidth;
      if (finalW && (!bar.style.width || bar.style.width === '0%' || bar.style.width === '0px')) {
        bar.style.width = finalW;
      }
    });
  }, baseDelay + bars.length * 80 + 900);
}

// Animate bars on load
window.addEventListener('load', () => {
  animateProgressBars(document, 300);
  initDashSearch();
  initOnboarding();

  // ?袁⑹삺 ??륁뵠筌왖??筌띿쉶???λ뜃由????쎈뻬
  const currentPage = location.pathname;
  if (currentPage === '/search') {
    initSearch();
  }
  if (currentPage === '/analysis') {
    const pid = (() => { try { return localStorage.getItem('benefic_detail_id'); } catch(e) { return null; } })();
    if (pid) {
      // 癰귣벊??筌앸맩????????showDetail ??showTab('detail')????쇰뻻 analysis.html嚥?
      // ??猷???????????얜똾釉??룐뫂遊썲첎? ??룸┛??野껉퍔??筌△뫀??
      try { localStorage.removeItem('benefic_detail_id'); } catch(e) {}
      showDetail(pid);
    }
  }
});

// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
// 甕곗쥓苑??v2.0 ???紐꾩쵄 & ?袁⑥뺍?? ??뺚댘??쇱뒲 ??뽯뮞??
// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름

// ?袁⑹삺 嚥≪뮄????醫? ?類ｋ궖 揶쎛?紐꾩궎疫?(localStorage 疫꿸퀡而?
function getAuthUser() {
  try {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('benefic_user');
    if (token && user) return JSON.parse(user);
    if (token) return { name: '?????, initial: '?? };
  } catch(e) {}
  return null;
}

// ?袁⑥뺍?? ??뺚댘??쇱뒲 ??용┛/??る┛
function toggleAvatarDropdown() {
  const dd = document.getElementById('avatarDropdown');
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  // ??삘뀲 ??뺚댘??쇱뒲 ??る┛ (?紐꾨선 ??
  document.querySelectorAll('.lang-dropdown').forEach(el => el.classList.remove('open'));
  dd.classList.toggle('open', !isOpen);
}

// ?紐? ????????る┛
document.addEventListener('click', function(e) {
  const avatarWrap = document.querySelector('.nav-avatar-wrap');
  if (avatarWrap && !avatarWrap.contains(e.target)) {
    const dd = document.getElementById('avatarDropdown');
    if (dd) dd.classList.remove('open');
  }
});

// 嚥≪뮄??袁⑹뜍
function doLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('benefic_user');
  window.location.href = '/login';
}

// ??륁뵠筌왖 嚥≪뮆諭????袁⑥뺍?? ?怨몃열 ?λ뜃由??
function initAuthNav() {
  const wrap = document.querySelector('.nav-avatar');
  if (!wrap) return;

  const user = getAuthUser();

  if (user) {
    // ?袁⑥쨮??燁삳?諭???已レ쮯?袁⑥뺍?? ??낅쑓??꾨뱜 (localStorage ?癒?궚 域밸챶?嚥?
    const profileName   = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileName)   profileName.textContent   = user.name || '?????;
    if (profileAvatar) profileAvatar.textContent = user.initial || user.name?.[0] || '??;

    // 嚥≪뮄????怨밴묶: ?袁⑥뺍?? + ??뺚댘??쇱뒲
    wrap.outerHTML = `
      <div class="nav-avatar-wrap" onclick="toggleAvatarDropdown()">
        <div class="nav-avatar" style="cursor:pointer;">
          <div class="avatar-circle">${user.initial || user.name?.[0] || '??}</div>
          <span class="avatar-name">${user.name || '?????}??/span>
          <span>??/span>
        </div>
        <div class="avatar-dropdown" id="avatarDropdown">
          <div class="avatar-dropdown-inner">
            <div class="avatar-dd-header">
              <div class="avatar-dd-circle">${user.initial || user.name?.[0] || '??}</div>
              <div>
                <div class="avatar-dd-name">${user.name || '?????}??/div>
                <div class="avatar-dd-email">${user.email || ''}</div>
              </div>
            </div>
            <div class="avatar-dd-divider"></div>
            <a href="/scrap" class="avatar-dd-item" data-i18n="nav_scrap">??쎄쾿??/a>
            <a href="/portfolio" class="avatar-dd-item" data-i18n="nav_user_portfolio">??????????/a>
            <a href="/profile" class="avatar-dd-item" data-i18n="nav_user_profile">?維 揶쏆뮇??類ｋ궖 ??륁젟</a>
            <a href="/recently-viewed" class="avatar-dd-item" data-i18n="nav_user_recently">?釉?筌ㅼ뮄??癰??⑤벀??/a>
            <div class="avatar-dd-divider"></div>
            <div class="avatar-dd-item logout" onclick="doLogout()" data-i18n="nav_user_logout">???嚥≪뮄??袁⑹뜍</div>
          </div>
        </div>
      </div>`;
    // Re-apply i18n to newly injected dropdown
    if (typeof applyTranslations === 'function' && typeof loadLang === 'function') {
      try { applyTranslations(loadLang()); } catch(e) {}
    }
  } else {
    // ??쑬以덃뉩紐꾩뵥: 嚥≪뮄???甕곌쑵??
    wrap.outerHTML = `
      <div class="nav-avatar-wrap">
        <a href="/login" class="btn-login-nav">?逾?嚥≪뮄???/a>
      </div>`;
  }
}

// login.html ?癒?퐣 嚥≪뮄????源껊궗 ???醫? ?類ｋ궖 ????(login.html?癒?퐣 ?紐꾪뀱)
function saveAuthUser(token, userData) {
  localStorage.setItem('token', token);
  localStorage.setItem('benefic_user', JSON.stringify(userData));
}

// ??륁뵠筌왖 嚥≪뮆諭????癒?짗 ??쎈뻬
document.addEventListener('DOMContentLoaded', initAuthNav);


// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
// ??쑬以덃뉩紐꾩뵥 ?醫됲닊 ??살쒔??됱뵠 ??checkLoginStatus & applyLockOverlay
// ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름

/**
 * ?袁⑹삺 嚥≪뮄????怨밴묶 ?類ㅼ뵥
 * @returns {boolean} 嚥≪뮄??????
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
 * ??쑬以덃뉩紐꾩뵥 ???????遺용꺖???醫됲닊 ??살쒔??됱뵠??雅뚯눘???뺣뼄.
 * - .is-locked ?????살쨮 pointer-events 筌△뫀??
 * - .locked-overlay 嚥?blur + ??덇땀 ?얜㈇????뽯뻻
 * - data-i18n="login_required" ??욧쉐??곗쨮 ??븍럢??筌ｌ꼶??
 *
 * @param {string} targetSelector  ?醫? ?遺용꺖??CSS ????꿸숲
 * @param {object} [options]       ????(loginUrl: 嚥≪뮄?????륁뵠筌왖 野껋럥以?
 */
function applyLockOverlay(targetSelector, options = {}) {
  const loginUrl = options.loginUrl || '/login';

  document.querySelectorAll(targetSelector).forEach(target => {
    // ??? 筌ｌ꼶????遺용꺖 椰꾨?瑗??
    if (target.classList.contains('is-locked')) return;

    target.classList.add('is-locked');

    // i18n ??살쨮 ?袁⑹삺 ?紐꾨선 ??용뮞??揶쎛?紐꾩궎疫?(i18n.js ?袁⑸열 ??λ땾 ??뽰뒠)
    let msgText  = '嚥≪뮄??紐꾩뵠 ?袁⑹뒄????뺥돩??쇱뿯??덈뼄';
    let btnText  = '?逾?嚥≪뮄??紐낅릭疫?;
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
        <div class="locked-icon">?逾?/div>
        <p class="locked-msg" data-i18n="login_required">${msgText}</p>
        <a href="${loginUrl}" class="btn-lock-login" data-i18n="login_btn">${btnText}</a>
      </div>`;

    target.appendChild(overlay);
  });
}

/**
 * ??쑬以덃뉩紐꾩뵥 ?怨밴묶????雅뚯눘??????뺣궖??燁삳?諭??쇱뱽 ?醫됰젏??
 * ?醫? ???? ??륁벥 ??랁닋 ?袁れ넺 / ?곕뗄荑?????????/ 筌띿쉸???곕뗄荑???뺥돩??
 * (?醫롪퍕 筌ｋ똾寃뺟뵳???紐껊뮉 ?醫됰젃筌왖 ??놁벉 ????쑬?揶?UI)
 */
function initLockOverlays() {
  if (checkLoginStatus()) return;   // 嚥≪뮄????怨밴묶筌??袁ⓓ℡칰猿딅즲 ??? ??놁벉

  // ??쑬以덃뉩紐꾩뵥 ???怨룸뼊 ?袁⑥쨮??燁삳?諭?.profile-card)筌??醫됲닊
  applyLockOverlay('.profile-card', { loginUrl: '/login' });
}

// DOMContentLoaded ???癒?짗 ??쎈뻬 (initAuthNav ??꾩뜎 ??덉삂 癰귣똻??
document.addEventListener('DOMContentLoaded', () => {
  // initAuthNav揶쎛 ?믪눘? ??쎈뻬?????醫됲닊 筌ｌ꼶??
  requestAnimationFrame(initLockOverlays);
});
