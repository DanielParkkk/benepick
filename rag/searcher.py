import pandas as pd
import numpy as np
import chromadb
import os
import re
import shutil
from pathlib import Path
from rank_bm25 import BM25Okapi
from kiwipiepy import Kiwi

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_PATH = PROJECT_ROOT / "processed"
CACHE_ROOT = PROJECT_ROOT / ".cache" / "huggingface"
os.environ.setdefault("HF_HOME", str(CACHE_ROOT))
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(CACHE_ROOT / "sentence-transformers"))

from sentence_transformers import SentenceTransformer


def _is_onedrive_path(path: Path) -> bool:
    normalized = str(path).lower()
    onedrive_root = os.environ.get("OneDrive") or os.environ.get("OneDriveCommercial") or ""
    if onedrive_root and normalized.startswith(str(Path(onedrive_root)).lower()):
        return True
    return "onedrive" in normalized


def _resolve_chroma_path() -> Path:
    configured = os.environ.get("BENEPICK_CHROMA_PATH")
    if configured:
        return Path(configured)

    project_path = PROJECT_ROOT / "chroma_db"
    if project_path.exists() and not _is_onedrive_path(project_path):
        return project_path

    return Path(os.environ.get("LOCALAPPDATA", str(PROJECT_ROOT))) / "BenePick" / "chroma_db"


CHROMA_PATH = _resolve_chroma_path()
COLLECTION_NAME = "benepick_policies"
MODEL_NAME = os.environ.get("BENEPICK_EMBED_MODEL", "BAAI/bge-m3")
CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8001"))


def _embedding_slug(model_name: str) -> str:
    return re.sub(r"[^0-9A-Za-z._-]+", "_", str(model_name or "").strip()).strip("_").lower()


def _resolve_embedding_paths(model_name: str) -> tuple[Path, Path]:
    welfare_override = os.environ.get("BENEPICK_WELFARE_EMBEDDINGS_PATH")
    gov24_override = os.environ.get("BENEPICK_GOV24_EMBEDDINGS_PATH")
    if welfare_override and gov24_override:
        return Path(welfare_override), Path(gov24_override)

    if model_name == "BAAI/bge-m3":
        return PROCESSED_PATH / "embeddings.npy", PROCESSED_PATH / "gov24" / "embeddings.npy"

    slug = _embedding_slug(model_name)
    return (
        PROCESSED_PATH / f"embeddings_{slug}.npy",
        PROCESSED_PATH / "gov24" / f"embeddings_{slug}.npy",
    )


WELFARE_EMBEDDINGS_PATH, GOV24_EMBEDDINGS_PATH = _resolve_embedding_paths(MODEL_NAME)

# KIWI_MODEL_PATH: 한글 경로에서 C 확장이 모델을 못 여는 문제 우회 (Windows 로컬 전용)
# Railway/Linux 등 배포 환경에서는 환경변수 미설정 → kiwipiepy 기본 경로 자동 사용
def _ensure_ascii_kiwi_model_path() -> str | None:
    configured = os.environ.get("KIWI_MODEL_PATH")
    if configured:
        return configured

    # 기본 설치 경로가 비-ASCII(예: 한글 경로)일 경우를 대비해
    # 사용자 홈(ASCII) 아래로 모델 파일을 1회 복사해 사용한다.
    src_dir = Path(__file__).resolve().parents[1] / "venv" / "Lib" / "site-packages" / "kiwipiepy_model"
    if not src_dir.exists():
        return None

    home = Path(os.environ.get("USERPROFILE", "C:/Users/Public"))
    ascii_dir = home / "kiwi_model"
    try:
        if not ascii_dir.exists():
            shutil.copytree(src_dir, ascii_dir)
        return str(ascii_dir)
    except Exception:
        return None


_kiwi_model_path = _ensure_ascii_kiwi_model_path()
_kiwi = Kiwi(model_path=_kiwi_model_path, num_workers=-1)

# BM25 대상 품사: 일반명사(NNG) + 고유명사(NNP) + 어근(XR) + 외국어(SL)
# NNB(의존명사)·NR(수사)·NP(대명사) 제외 이유:
#   NNB → "것", "수", "데", "뿐" 등 문법적 의존명사 — 검색 변별력 없음
#   NR  → "하나", "둘" 등 수사 — 복지 검색 맥락에서 의미 없음
#   NP  → "나", "우리" 등 대명사 — 불필요
_VALID_TAGS = {"NNG", "NNP", "XR", "SL"}

_INTENT_KEYWORDS = {
    "housing": {"주거", "주택", "월세", "전세", "임대", "보증금", "이사", "무주택"},
    "employment": {"취업", "구직", "일자리", "고용", "면접", "직업", "훈련", "재취업"},
    "education": {"교육", "훈련", "장학", "수강", "바우처", "평생교육", "디지털"},
    "medical": {"의료", "의료비", "병원", "건강", "검진", "치료", "암환자", "임산부"},
    "welfare": {"기초생활", "수급자", "차상위", "긴급복지", "생활안정", "한부모", "다문화", "돌봄"},
}

_SUPPORT_POLICY_TERMS = {
    "지원", "수당", "급여", "장려금", "보조", "바우처", "장학금", "임대", "대출", "복지", "정책"
}

_GENERIC_FACILITY_TERMS = {
    "할인", "이용요금", "입장료", "관람", "주차", "주차장", "체육시설", "강습", "프로그램", "센터", "도서관",
    "골프", "체육", "경기장", "운영", "견학"
}

_DEMOGRAPHIC_KEYWORDS = {
    "청년", "중장년", "고령", "노인", "여성", "경력단절", "장애인", "임산부",
    "암환자", "한부모", "다문화", "기초생활수급자", "차상위", "1인 가구", "무주택"
}

_RANK_STOPWORDS = {
    "지원", "정책", "제도", "관련", "대상", "주요", "유사", "같은", "있는", "있나요",
    "궁금합니다", "알려주세요", "받을", "수", "위한", "에게", "성격", "공공", "복지",
}

_RANK_ALIAS_GROUPS = [
    {"월세", "주거비", "임대료"},
    {"전세", "전월세", "보증금", "전세보증금", "임차보증금"},
    {"전세사기", "전세피해", "피해임차인", "주거안정"},
    {"무주택", "주택", "주거", "주거급여"},
    {"구직", "취업", "일자리", "재취업", "취업지원"},
    {"직업훈련", "훈련", "국민내일배움카드", "내일배움카드", "훈련비"},
    {"장학", "장학금", "대학생", "근로장학"},
    {"평생교육", "바우처", "평생교육바우처"},
    {"디지털", "디지털배움터", "역량", "문해"},
    {"의료비", "진료비", "치료비", "의료"},
    {"암환자", "암", "중증질환"},
    {"장애인", "장애", "보조기기", "발달장애"},
    {"임산부", "임신", "산모", "영유아"},
    {"정신건강", "심리", "상담", "치료"},
    {"기초생활", "수급자", "기초생활수급자", "생계"},
    {"차상위", "저소득", "생활안정"},
    {"긴급복지", "긴급", "위기가구", "위기"},
    {"한부모", "조손", "청소년부모"},
    {"다문화", "다문화가족", "외국인"},
    {"고령자", "노인", "어르신", "돌봄", "치매"},
    {"청년", "청소년"},
    {"여성", "경력단절", "새로일하기"},
    {"창업", "소상공인", "자영업", "재도전"},
    {"자산형성", "저축", "희망저축", "내일저축", "청년도약"},
]

_STRICT_TARGET_TERMS = {
    "청년", "무주택", "전세사기", "전세피해", "기초생활", "수급자", "차상위",
    "한부모", "다문화", "장애인", "임산부", "암환자", "고령자", "노인",
    "청소년", "소상공인", "자영업", "경력단절", "여성",
}

_TARGET_MISMATCH_RULES = [
    (
        {"직장인", "재직자"},
        {"구직", "구직자", "실업", "미취업", "취업준비생", "훈련생"},
        -0.18,
        -0.10,
    ),
    (
        {"저소득층", "차상위", "기초생활", "수급자"},
        {"장애인"},
        -0.14,
        -0.08,
    ),
]

_BENEFIT_ALIGNMENT_RULES = [
    (
        {"대출", "보증", "이자", "이차보전", "융자"},
        {"저축", "자산형성", "희망저축", "청년내일저축계좌", "자활"},
        {"대출", "보증", "이자", "이차보전", "융자", "정책자금"},
        -0.18,
        -0.10,
    ),
    (
        {"온라인", "야간", "직업훈련", "직무", "재직자"},
        {"방과후", "유치원", "석식비", "정보화교육", "수강권"},
        {"직업훈련", "직업능력개발", "사이버", "사업주", "재직자", "폴리텍"},
        -0.16,
        -0.10,
    ),
    (
        {"의료", "의료비", "진료비", "본인부담금"},
        {"보조기기", "이동지원", "수리비"},
        {"의료", "의료비", "진료비", "본인부담금", "병원", "치료"},
        -0.14,
        -0.08,
    ),
]

ENABLE_RANK_PRECISION_BONUS = os.getenv("BENEPICK_ENABLE_RANK_PRECISION_BONUS", "1") == "1"

_REGION_ALIASES = {
    "서울": {"서울", "서울시", "서울특별시"},
    "부산": {"부산", "부산시", "부산광역시"},
    "대구": {"대구", "대구시", "대구광역시"},
    "인천": {"인천", "인천시", "인천광역시"},
    "광주": {"광주", "광주시", "광주광역시"},
    "대전": {"대전", "대전시", "대전광역시"},
    "울산": {"울산", "울산시", "울산광역시"},
    "세종": {"세종", "세종시", "세종특별자치시"},
    "경기": {"경기", "경기도"},
    "강원": {"강원", "강원도", "강원특별자치도"},
    "충북": {"충북", "충청북도"},
    "충남": {"충남", "충청남도"},
    "전북": {"전북", "전라북도", "전북특별자치도"},
    "전남": {"전남", "전라남도"},
    "경북": {"경북", "경상북도"},
    "경남": {"경남", "경상남도"},
    "제주": {"제주", "제주도", "제주특별자치도"},
}


def _filter_tokens(token_list) -> list[str]:
    """형태소 분석 결과에서 유효 토큰만 추출 (공통 필터)"""
    return [
        token.form
        for token in token_list
        if token.tag in _VALID_TAGS and len(token.form) >= 2
    ]


def tokenize(text: str) -> list[str]:
    """단일 텍스트 형태소 분석 — 검색 쿼리 처리용"""
    return _filter_tokens(_kiwi.tokenize(text))


def tokenize_batch(texts: list[str]) -> list[list[str]]:
    """다수 텍스트 배치 형태소 분석 — BM25 인덱스 생성용

    Kiwi의 배치 API를 활용해 단건 반복 대비 처리 속도를 대폭 향상시킴.
    BM25 IDF가 고빈도 단어를 자동으로 낮은 가중치로 처리하므로
    별도 불용어 목록 없이 품사 필터만으로 충분함.
    """
    return [_filter_tokens(token_list) for token_list in _kiwi.tokenize(texts)]


def _detect_intents(query: str) -> set[str]:
    intents: set[str] = set()
    normalized = str(query or "").lower()
    for intent, keywords in _INTENT_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            intents.add(intent)
    return intents


def _extract_query_regions(query: str) -> set[str]:
    normalized = str(query or "").lower()
    detected: set[str] = set()
    for canonical, aliases in _REGION_ALIASES.items():
        if any(alias in normalized for alias in aliases):
            detected.add(canonical)
    return detected


def _keyword_overlap_bonus(query: str, policy_name: str, evidence_text: str) -> float:
    bonus = 0.0
    normalized_query = str(query or "").lower()
    normalized_name = str(policy_name or "").lower()
    normalized_text = str(evidence_text or "").lower()
    intents = _detect_intents(normalized_query)

    for intent in intents:
        keywords = _INTENT_KEYWORDS[intent]
        if any(keyword in normalized_name for keyword in keywords):
            bonus += 0.18
        if any(keyword in normalized_text for keyword in keywords):
            bonus += 0.08

    if any(term in normalized_query for term in _SUPPORT_POLICY_TERMS):
        if any(term in normalized_name for term in _SUPPORT_POLICY_TERMS):
            bonus += 0.08
        elif any(term in normalized_text for term in _SUPPORT_POLICY_TERMS):
            bonus += 0.04

    demographic_hits = [term for term in _DEMOGRAPHIC_KEYWORDS if term in normalized_query]
    for term in demographic_hits:
        if term in normalized_name:
            bonus += 0.18
        elif term in normalized_text:
            bonus += 0.08
        else:
            bonus -= 0.06

    if intents and not any(intent == "medical" for intent in intents):
        if any(term in normalized_name for term in _GENERIC_FACILITY_TERMS):
            bonus -= 0.12
        elif any(term in normalized_text for term in _GENERIC_FACILITY_TERMS):
            bonus -= 0.05
    else:
        if any(term in normalized_name for term in _GENERIC_FACILITY_TERMS) and "지원" in normalized_query:
            bonus -= 0.08

    if any(term in normalized_query for term in ("복지", "정책", "지원")):
        if "견학" in normalized_name or "견학" in normalized_text:
            bonus -= 0.15
        if "운영" in normalized_name and not any(term in normalized_name for term in _SUPPORT_POLICY_TERMS):
            bonus -= 0.08
        if "교육" in normalized_query or "디지털" in normalized_query:
            education_terms = ("교육", "훈련", "수강", "학습", "바우처", "장학", "디지털")
            if not any(term in normalized_name for term in education_terms):
                bonus -= 0.12
            if not any(term in normalized_text for term in education_terms):
                bonus -= 0.08
        if "디지털" in normalized_query and "역량" in normalized_query:
            digital_terms = ("디지털", "온라인", "코딩", "AI", "컴퓨터", "스마트", "역량")
            if not any(term.lower() in normalized_name for term in digital_terms):
                bonus -= 0.12
            if not any(term.lower() in normalized_text for term in digital_terms):
                bonus -= 0.08

    return bonus


def _compact_text(text: str) -> str:
    return re.sub(r"[^0-9a-zA-Z가-힣]+", "", str(text or "").lower())


def _rank_terms(query: str) -> set[str]:
    terms = set()
    for token in re.findall(r"[0-9A-Za-z가-힣]+", str(query or "").lower()):
        if len(token) < 2 or token in _RANK_STOPWORDS:
            continue
        terms.add(token)
    return terms


def _matched_alias_groups(query_terms: set[str]) -> list[set[str]]:
    groups = []
    compact_terms = {_compact_text(term) for term in query_terms}
    for group in _RANK_ALIAS_GROUPS:
        compact_group = {_compact_text(term) for term in group}
        if compact_terms & compact_group:
            groups.append(group)
    return groups


def _rank_precision_bonus(
    query: str,
    policy_name: str,
    evidence_text: str,
    region: str = "",
    user_region: str = "",
) -> float:
    """Small deterministic boost for rank precision inside the retrieved Top-K.

    Dense/BM25 already brings candidates in. This function only nudges ordering
    toward documents whose title/body explicitly matches policy-domain signals
    from the query: policy name, region, target group, and support type.
    """
    query_terms = _rank_terms(query)
    if not query_terms:
        return 0.0

    compact_query = _compact_text(query)
    compact_name = _compact_text(policy_name)
    compact_text = _compact_text(evidence_text)
    compact_region = _compact_text(region)

    bonus = 0.0

    # Direct title matching is the most reliable signal for rank ordering.
    title_hits = 0
    body_hits = 0
    for term in query_terms:
        compact_term = _compact_text(term)
        if not compact_term:
            continue
        if compact_term in compact_name:
            title_hits += 1
        elif compact_term in compact_text:
            body_hits += 1

    bonus += min(title_hits * 0.08, 0.40)
    bonus += min(body_hits * 0.025, 0.15)

    for group in _matched_alias_groups(query_terms):
        compact_group = [_compact_text(term) for term in group]
        if any(term and term in compact_name for term in compact_group):
            bonus += 0.12
        elif any(term and term in compact_text for term in compact_group):
            bonus += 0.04

    # If the query has a strict target group, missing that target should hurt.
    for term in _STRICT_TARGET_TERMS & query_terms:
        compact_term = _compact_text(term)
        if compact_term in compact_name:
            bonus += 0.10
        elif compact_term in compact_text:
            bonus += 0.04
        else:
            bonus -= 0.08

    for required_terms, mismatch_terms, title_penalty, body_penalty in _TARGET_MISMATCH_RULES:
        if not (required_terms & query_terms):
            continue
        if mismatch_terms & query_terms:
            continue
        if any(_compact_text(term) in compact_name for term in mismatch_terms):
            bonus += title_penalty
        elif any(_compact_text(term) in compact_text for term in mismatch_terms):
            bonus += body_penalty

    for required_terms, mismatch_terms, alignment_terms, title_penalty, body_penalty in _BENEFIT_ALIGNMENT_RULES:
        if not (required_terms & query_terms):
            continue
        if any(_compact_text(term) in compact_name for term in alignment_terms):
            continue
        if any(_compact_text(term) in compact_text for term in alignment_terms):
            continue
        if any(_compact_text(term) in compact_name for term in mismatch_terms):
            bonus += title_penalty
        elif any(_compact_text(term) in compact_text for term in mismatch_terms):
            bonus += body_penalty

    # Region should affect rank, but nationwide policies remain valid.
    target_regions = set()
    if user_region:
        target_regions.add(str(user_region)[:2])
    target_regions.update(_extract_query_regions(query))
    for target in target_regions:
        compact_target = _compact_text(target)
        if not compact_target:
            continue
        if compact_target in compact_region:
            bonus += 0.18
        elif "전국" in str(region):
            bonus += 0.06
        else:
            bonus -= 0.08

    # Very broad facility/operation docs should not outrank benefit policies.
    if any(term in compact_query for term in ("지원", "정책", "급여", "수당", "대출", "바우처")):
        if any(_compact_text(term) in compact_name for term in _GENERIC_FACILITY_TERMS):
            bonus -= 0.10

    return bonus


class HybridSearcher:
    def __init__(self, device="cuda"):
        print("하이브리드 검색기 초기화 중...")

        # ChromaDB 연결 우선순위:
        # 1) HTTP 서버(localhost:8001) 2) 로컬 PersistentClient
        # 서버 기반 인덱스가 있는 경우 HNSW 로드 안정성이 더 높다.
        skip_chroma = os.getenv("BENEPICK_SKIP_CHROMA", "0") == "1"
        self.collection = None
        self._chroma_vector_disabled = True

        if skip_chroma:
            print("[Searcher] BENEPICK_SKIP_CHROMA=1 -> skip Chroma and use numpy dense fallback.")
        else:
            try:
                client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
                client.heartbeat()
                print(f"Chroma 연결: HTTP ({CHROMA_HOST}:{CHROMA_PORT})")
            except Exception:
                client = chromadb.PersistentClient(path=str(CHROMA_PATH))
                print(f"Chroma 연결: Persistent ({CHROMA_PATH})")

            try:
                self.collection = client.get_collection(COLLECTION_NAME)
                self._chroma_vector_disabled = False
            except Exception as exc:
                print(f"[Searcher] Chroma collection unavailable: {exc}")
                print("[Searcher] Using numpy dense fallback instead.")

        # 정책 데이터 로드 (복지로 + 정부24)
        df_welfare = pd.read_csv(PROCESSED_PATH / "chunks.csv")
        df_gov24   = pd.read_csv(PROCESSED_PATH / "gov24" / "chunks.csv")
        self.df_chunks = pd.concat([df_welfare, df_gov24], ignore_index=True)

        # chunk_id 인덱싱 → O(1) 조회
        self.df_chunks = self.df_chunks.set_index("chunk_id", drop=False)
        self.chunk_ids = self.df_chunks["chunk_id"].tolist()
        print(f"전체 정책 로드: {len(self.df_chunks)}개")
        self._load_dense_embeddings()

        # Dense embedding model load.
        print(f"Embedding model loading: {MODEL_NAME}")
        trust_remote_code = os.getenv("BENEPICK_EMBED_TRUST_REMOTE_CODE", "0") == "1"
        model_kwargs = {"device": device, "trust_remote_code": trust_remote_code}
        hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")
        if hf_token:
            model_kwargs["token"] = hf_token
        self.model = SentenceTransformer(MODEL_NAME, **model_kwargs)

        # BM25 초기화 (캐시 우선 로딩)
        import pickle, hashlib
        _cache_path = PROJECT_ROOT / "processed" / "bm25_cache.pkl"
        _hash_path  = PROJECT_ROOT / "processed" / "bm25_cache.hash"

        # 데이터 변경 감지용 해시 (chunks 파일 수정 시각 기반)
        _src_files = [
            PROCESSED_PATH / "chunks.csv",
            PROCESSED_PATH / "gov24" / "chunks.csv",
        ]
        _hash_val = hashlib.md5(
            b"".join(str(p.stat().st_mtime).encode() for p in _src_files)
        ).hexdigest()

        _use_cache = (
            _cache_path.exists() and
            _hash_path.exists() and
            _hash_path.read_text().strip() == _hash_val
        )

        if _use_cache:
            print("BM25 캐시 로딩 중... (이전 토크나이징 결과 재사용)")
            with open(_cache_path, "rb") as f:
                tokenized = pickle.load(f)
            print("BM25 캐시 로딩 완료!")
        else:
            print("BM25 인덱스 생성 중 (Kiwi 배치 형태소 분석)...")
            tokenized = tokenize_batch(self.df_chunks["text"].tolist())
            with open(_cache_path, "wb") as f:
                pickle.dump(tokenized, f)
            _hash_path.write_text(_hash_val)
            print("BM25 캐시 저장 완료!")

        self.bm25 = BM25Okapi(tokenized)

        print("초기화 완료!\n")

    def _load_dense_embeddings(self) -> None:
        """Dense fallback용 사전 계산 임베딩 로드 (Chroma 쿼리 실패 대비)."""
        missing = [
            str(path)
            for path in (WELFARE_EMBEDDINGS_PATH, GOV24_EMBEDDINGS_PATH)
            if not path.exists()
        ]
        if missing:
            raise FileNotFoundError(
                "Dense embedding files are missing for "
                f"BENEPICK_EMBED_MODEL={MODEL_NAME}. "
                "Build them first with rag/build_embedding_variants.py. "
                f"Missing: {missing}"
            )
        welfare_embeddings = np.load(WELFARE_EMBEDDINGS_PATH).astype(np.float32, copy=False)
        gov24_embeddings = np.load(GOV24_EMBEDDINGS_PATH).astype(np.float32, copy=False)
        dense_embeddings = np.vstack([welfare_embeddings, gov24_embeddings]).astype(np.float32, copy=False)
        if dense_embeddings.shape[0] != len(self.chunk_ids):
            raise ValueError(
                f"임베딩 개수 불일치: embeddings={dense_embeddings.shape[0]}, chunks={len(self.chunk_ids)}"
            )

        # cosine 유사도 계산용 정규화
        norms = np.linalg.norm(dense_embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1e-12
        self.dense_embeddings = dense_embeddings / norms
        self.chunk_ids_array = np.array(self.chunk_ids, dtype=object)

    def _vector_search_numpy(self, query_embedding: np.ndarray, top_k: int) -> dict:
        """Chroma 쿼리 실패 시 numpy 기반 dense 검색 fallback."""
        if query_embedding.ndim == 2:
            query_embedding = query_embedding[0]
        query_embedding = query_embedding.astype(np.float32, copy=False)
        norm = np.linalg.norm(query_embedding)
        if norm == 0:
            return {}
        query_embedding = query_embedding / norm

        similarities = self.dense_embeddings @ query_embedding
        k = min(max(top_k, 1), len(similarities))
        if k <= 0:
            return {}

        top_indices = np.argpartition(similarities, -k)[-k:]
        ordered_indices = top_indices[np.argsort(similarities[top_indices])[::-1]]
        return {
            str(self.chunk_ids_array[idx]): float(similarities[idx])
            for idx in ordered_indices
        }

    def vector_search(self, query: str, top_k: int = 10) -> dict:
        """벡터 유사도 검색"""
        query_embedding = self.model.encode(
            [query],
            normalize_embeddings=True
        )

        if not self._chroma_vector_disabled:
            try:
                results = self.collection.query(
                    query_embeddings=query_embedding.tolist(),
                    n_results=top_k
                )
                # chunk_id → 점수 딕셔너리 (거리 → 유사도)
                return {
                    chunk_id: 1 - dist
                    for chunk_id, dist in zip(results["ids"][0], results["distances"][0])
                }
            except Exception as exc:
                self._chroma_vector_disabled = True
                print(f"[Searcher] Chroma vector query failed: {exc}")
                print("[Searcher] Switching dense retrieval to numpy fallback.")

        return self._vector_search_numpy(query_embedding, top_k=top_k)

    def bm25_search(self, query: str) -> dict:
        """BM25 키워드 검색 (Kiwi 형태소 분석기)"""
        tokenized_query = tokenize(query)
        scores = self.bm25.get_scores(tokenized_query)

        # 정규화 (0~1)
        max_score = scores.max() + 1e-9
        normalized = scores / max_score

        return {
            chunk_id: float(normalized[i])
            for i, chunk_id in enumerate(self.chunk_ids)
        }

    def search(self, query: str, top_k: int = 5, alpha: float = 0.6, user_region: str = "") -> list:
        """
        하이브리드 검색
        alpha=0.6 → 벡터 60% + BM25 40%
        user_region: 사용자 지역 (예: "서울특별시") — 매칭 지역/전국 정책 우선
        """
        # 1. 벡터 검색 + BM25 검색
        vector_scores = self.vector_search(query, top_k=top_k * 2)
        bm25_scores   = self.bm25_search(query)

        # 2. 점수 합산 (bm25_scores가 전체 문서 포함, vector_scores는 그 부분집합)
        final_scores = {
            cid: alpha * vector_scores.get(cid, 0) + (1 - alpha) * score
            for cid, score in bm25_scores.items()
        }

        # 2-0. 의도 기반 보정: 지원 정책형 질의는 핵심 키워드/정책형 표현을 보너스,
        # 시설 할인/이용 안내형 문서는 페널티를 줘서 retrieval 잡음을 줄인다.
        for cid in list(final_scores.keys()):
            if cid not in self.df_chunks.index:
                continue
            row = self.df_chunks.loc[cid]
            final_scores[cid] += _keyword_overlap_bonus(
                query=query,
                policy_name=str(row.get("policy_name", "")),
                evidence_text=str(row.get("text", "")),
            )
            if ENABLE_RANK_PRECISION_BONUS:
                final_scores[cid] += _rank_precision_bonus(
                    query=query,
                    policy_name=str(row.get("policy_name", "")),
                    evidence_text=str(row.get("text", "")),
                    region=str(row.get("region", "")),
                    user_region=user_region,
                )

        # 2-1. 지역 보정: 명시 지역/전국 정책을 올리고, 다른 지역은 소폭 감점한다.
        target_regions = set()
        if user_region:
            target_regions.add(str(user_region)[:2])  # "서울특별시" → "서울"
        target_regions.update(_extract_query_regions(query))
        if target_regions:
            for cid in list(final_scores.keys()):
                if cid not in self.df_chunks.index:
                    continue
                row_region = str(self.df_chunks.loc[cid, "region"])
                if "전국" in row_region:
                    final_scores[cid] += 0.10
                elif any(region in row_region for region in target_regions):
                    final_scores[cid] += 0.18
                else:
                    final_scores[cid] -= 0.10

        # 3. Top-K 추출
        top_ids = sorted(final_scores, key=final_scores.get, reverse=True)[:top_k]

        # 4. 결과 조합 (set_index로 O(1) 조회)
        results = []
        for rank, chunk_id in enumerate(top_ids, 1):
            row = self.df_chunks.loc[chunk_id]
            results.append({
                "rank":          rank,
                "chunk_id":      chunk_id,
                "policy_id":     str(row["policy_id"]),
                "policy_name":   row["policy_name"],
                "category":      row["category"],
                "region":        row["region"],
                "source_url":    row["source_url"],
                "score":         round(final_scores[chunk_id], 4),
                "vector_score":  round(vector_scores.get(chunk_id, 0), 4),
                "bm25_score":    round(bm25_scores.get(chunk_id, 0), 4),
                "evidence_text": row["text"],
            })

        return results


def print_results(results, query):
    print(f"\n{'='*50}")
    print(f"검색어: '{query}'")
    print(f"{'='*50}")
    for r in results:
        print(f"\n[{r['rank']}위] {r['policy_name']} ({r['category']})")
        print(f"  최종 점수: {r['score']} (벡터: {r['vector_score']} / BM25: {r['bm25_score']})")
        print(f"  지역: {r['region']}")
        print(f"  내용: {r['evidence_text'][:80]}...")


if __name__ == "__main__":
    searcher = HybridSearcher()

    queries = [
        "서울 청년 월세 지원",
        "취업 준비생 훈련비 지원",
        "기초연금 받으려면",
        "실직한 30대 복지 정책",
        "노인 돌봄 서비스",
    ]

    for query in queries:
        results = searcher.search(query, top_k=3, alpha=0.6)
        print_results(results, query)

    print("\n하이브리드 검색 완료!")
