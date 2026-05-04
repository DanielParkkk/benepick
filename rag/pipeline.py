import os
import pickle
import re
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
from rank_bm25 import BM25Okapi

PROJECT_ROOT = Path(__file__).resolve().parents[1]
HF_CACHE_ROOT = PROJECT_ROOT / ".cache" / "huggingface"
os.environ.setdefault("HF_HOME", str(HF_CACHE_ROOT))
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(HF_CACHE_ROOT / "sentence-transformers"))

try:
    from .searcher import HybridSearcher
except ImportError:
    from searcher import HybridSearcher
from langchain_core.messages import HumanMessage, SystemMessage
from FlagEmbedding import FlagReranker

load_dotenv(override=True)
DEFAULT_PROMPT_VARIANT = os.getenv("BENEPICK_RAG_PROMPT_VARIANT", "B").strip().upper() or "B"

# ── LLM 초기화: GROQ_API_KEY 있으면 Groq, 없으면 Ollama ──
import threading


def _init_openai_llm():
    from langchain_openai import ChatOpenAI
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return ChatOpenAI(model=model, temperature=0.3, max_tokens=512), f"OpenAI ({model})"


def _init_groq_llm():
    from langchain_groq import ChatGroq
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    return ChatGroq(model=model, temperature=0.3, max_tokens=512), f"Groq ({model})"


def _init_ollama_llm():
    from langchain_ollama import ChatOllama
    model = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")
    return ChatOllama(model=model, temperature=0.3, num_predict=512), f"Ollama ({model})"


def _build_llm():
    """
    Provider selection priority:
    1) BENEPICK_LLM_PROVIDER (explicit override)
    2) BENEPICK_LLM_MODE=experiment|prod
    3) key-based auto fallback
    """
    llm_mode = os.getenv("BENEPICK_LLM_MODE", "auto").strip().lower()
    provider_override = os.getenv("BENEPICK_LLM_PROVIDER", "").strip().lower()
    experiment_provider = os.getenv("BENEPICK_EXPERIMENT_PROVIDER", "openai").strip().lower()
    prod_provider = os.getenv("BENEPICK_PROD_PROVIDER", "groq").strip().lower()

    provider_candidates = []
    if provider_override in {"openai", "groq", "ollama"}:
        provider_candidates.append(provider_override)
    elif llm_mode == "experiment":
        provider_candidates.extend([experiment_provider, "openai", "groq", "ollama"])
    elif llm_mode == "prod":
        provider_candidates.extend([prod_provider, "groq", "openai", "ollama"])
    else:
        if os.getenv("OPENAI_API_KEY"):
            provider_candidates.append("openai")
        if os.getenv("GROQ_API_KEY"):
            provider_candidates.append("groq")
        provider_candidates.append("ollama")

    seen = set()
    ordered_candidates = []
    for provider in provider_candidates:
        if provider and provider not in seen:
            seen.add(provider)
            ordered_candidates.append(provider)

    errors = []
    for provider in ordered_candidates:
        try:
            if provider == "openai":
                if not os.getenv("OPENAI_API_KEY"):
                    raise RuntimeError("OPENAI_API_KEY is not set")
                return _init_openai_llm()
            if provider == "groq":
                if not os.getenv("GROQ_API_KEY"):
                    raise RuntimeError("GROQ_API_KEY is not set")
                return _init_groq_llm()
            if provider == "ollama":
                return _init_ollama_llm()
        except Exception as exc:
            errors.append(f"{provider}: {exc}")

    raise RuntimeError("No LLM provider could be initialized. " + "; ".join(errors))


llm, llm_label = _build_llm()
print(f"LLM: {llm_label}")

# ── searcher/reranker 지연 로딩 ──
_searcher = None
_searcher_mode = "uninitialized"
_reranker = None
_searcher_lock = threading.Lock()
_reranker_lock = threading.Lock()
# ── CUDA 사용 가능 여부 ──
import torch as _torch
_USE_CUDA = _torch.cuda.is_available()
DEFAULT_ENABLE_RERANKER = "1" if _USE_CUDA else "0"
ENABLE_RERANKER = os.getenv("BENEPICK_ENABLE_RERANKER", DEFAULT_ENABLE_RERANKER) == "1"
FORCE_BM25_FALLBACK = os.getenv("BENEPICK_FORCE_BM25_FALLBACK", "0") == "1"
RETRIEVAL_TOP_K = max(5, int(os.getenv("BENEPICK_RETRIEVAL_TOP_K", "15")))
RETRIEVAL_ALPHA = float(os.getenv("BENEPICK_RETRIEVAL_ALPHA", "0.5"))
RERANK_BLEND_WEIGHT = float(os.getenv("BENEPICK_RERANK_BLEND_WEIGHT", "0.25"))

_QUERY_VALUE_MAP = {
    "SINGLE": "1인 가구",
    "COUPLE": "부부 가구",
    "MULTI_CHILD": "다자녀 가구",
    "MULTI_GENERATION": "다세대 가구",
    "UNEMPLOYED": "미취업",
    "EMPLOYED": "재직",
    "SELF_EMPLOYED": "자영업",
    "STUDENT": "학생",
    "MONTHLY_RENT": "월세 거주",
    "JEONSE": "전세 거주",
    "OWNER": "자가 거주",
    "LOW_0_50": "중위소득 0~50%",
    "MID_50_60": "중위소득 50~60%",
    "MID_60_80": "중위소득 60~80%",
    "MID_80_100": "중위소득 80~100%",
    "MID_100_120": "중위소득 100~120%",
    "MID_120_150": "중위소득 120~150%",
}

_INTEREST_TAG_MAP = {
    "housing": "주거 월세",
    "주거": "주거 월세",
    "월세": "주거 월세",
    "finance": "금융 자산형성",
    "금융": "금융 자산형성",
    "자산": "금융 자산형성",
    "employment": "취업 구직",
    "고용": "취업 구직",
    "취업": "취업 구직",
    "medical": "의료 건강",
    "보건": "의료 건강",
    "의료": "의료 건강",
    "education": "교육 훈련",
    "교육": "교육 훈련",
    "훈련": "교육 훈련",
    "care": "돌봄 육아",
    "돌봄": "돌봄 육아",
    "육아": "돌봄 육아",
}


class BM25FallbackSearcher:
    """Low-memory fallback searcher used when dense model init fails."""

    def __init__(self) -> None:
        processed_path = PROJECT_ROOT / "processed"
        df_welfare = pd.read_csv(processed_path / "chunks.csv")
        df_gov24 = pd.read_csv(processed_path / "gov24" / "chunks.csv")
        self.df_chunks = pd.concat([df_welfare, df_gov24], ignore_index=True).set_index("chunk_id", drop=False)
        self.chunk_ids = self.df_chunks["chunk_id"].tolist()

        tokenized = None
        cache_path = processed_path / "bm25_cache.pkl"
        if cache_path.exists():
            try:
                with open(cache_path, "rb") as cache_file:
                    tokenized = pickle.load(cache_file)
            except Exception as exc:
                print(f"[Searcher] BM25 cache load failed: {exc}; rebuilding tokens.")

        if not tokenized or len(tokenized) != len(self.chunk_ids):
            tokenized = [
                self._simple_tokenize(text)
                for text in self.df_chunks["text"].fillna("").astype(str).tolist()
            ]

        self.bm25 = BM25Okapi(tokenized)
        print(f"[Searcher] BM25 fallback ready ({len(self.chunk_ids)} chunks).")

    @staticmethod
    def _simple_tokenize(text: str) -> list[str]:
        tokens = re.findall(r"[0-9A-Za-z가-힣]+", str(text).lower())
        return [token for token in tokens if len(token) >= 2]

    def search(self, query: str, top_k: int = 5, alpha: float = 0.6, user_region: str = "") -> list:
        _ = alpha  # keep signature compatible with HybridSearcher.search
        query_tokens = self._simple_tokenize(query)
        if not query_tokens:
            query_tokens = ["복지", "정책"]

        raw_scores = self.bm25.get_scores(query_tokens)
        max_score = float(raw_scores.max()) if len(raw_scores) else 0.0
        normalized_scores = (raw_scores / max_score) if max_score > 0 else raw_scores

        region_short = user_region[:2] if user_region else ""
        final_scores: dict[str, float] = {}
        for idx, chunk_id in enumerate(self.chunk_ids):
            score = float(normalized_scores[idx])
            if region_short:
                row_region = str(self.df_chunks.loc[chunk_id, "region"])
                if "전국" in row_region or region_short in row_region:
                    score += 0.15
            final_scores[chunk_id] = score

        top_ids = sorted(final_scores, key=final_scores.get, reverse=True)[:top_k]
        results = []
        for rank, chunk_id in enumerate(top_ids, 1):
            row = self.df_chunks.loc[chunk_id]
            bm25_score = round(final_scores.get(chunk_id, 0.0), 4)
            results.append({
                "rank": rank,
                "chunk_id": chunk_id,
                "policy_id": str(row.get("policy_id", "")),
                "policy_name": str(row.get("policy_name", "")),
                "category": str(row.get("category", "")),
                "region": str(row.get("region", "")),
                "source_url": str(row.get("source_url", "")),
                "score": bm25_score,
                "vector_score": 0.0,
                "bm25_score": bm25_score,
                "evidence_text": str(row.get("text", "")),
            })
        return results


class BM25FallbackSearcher:
    """Low-memory fallback searcher used when dense model init fails."""

    def __init__(self) -> None:
        processed_path = PROJECT_ROOT / "processed"
        df_welfare = pd.read_csv(processed_path / "chunks.csv")
        df_gov24 = pd.read_csv(processed_path / "gov24" / "chunks.csv")
        self.df_chunks = pd.concat([df_welfare, df_gov24], ignore_index=True).set_index("chunk_id", drop=False)
        self.chunk_ids = self.df_chunks["chunk_id"].tolist()

        tokenized = None
        cache_path = processed_path / "bm25_cache.pkl"
        if cache_path.exists():
            try:
                with open(cache_path, "rb") as cache_file:
                    tokenized = pickle.load(cache_file)
            except Exception as exc:
                print(f"[Searcher] BM25 cache load failed: {exc}; rebuilding tokens.")

        if not tokenized or len(tokenized) != len(self.chunk_ids):
            tokenized = [
                self._simple_tokenize(text)
                for text in self.df_chunks["text"].fillna("").astype(str).tolist()
            ]

        self.bm25 = BM25Okapi(tokenized)
        print(f"[Searcher] BM25 fallback ready ({len(self.chunk_ids)} chunks).")

    @staticmethod
    def _simple_tokenize(text: str) -> list[str]:
        tokens = re.findall(r"[0-9A-Za-z가-힣]+", str(text).lower())
        return [token for token in tokens if len(token) >= 2]

    def search(self, query: str, top_k: int = 5, alpha: float = 0.6, user_region: str = "") -> list:
        _ = alpha  # keep signature compatible with HybridSearcher.search
        query_tokens = self._simple_tokenize(query)
        if not query_tokens:
            query_tokens = ["복지", "정책"]

        raw_scores = self.bm25.get_scores(query_tokens)
        max_score = float(raw_scores.max()) if len(raw_scores) else 0.0
        normalized_scores = (raw_scores / max_score) if max_score > 0 else raw_scores

        region_short = user_region[:2] if user_region else ""
        final_scores: dict[str, float] = {}
        for idx, chunk_id in enumerate(self.chunk_ids):
            score = float(normalized_scores[idx])
            if region_short:
                row_region = str(self.df_chunks.loc[chunk_id, "region"])
                if "전국" in row_region or region_short in row_region:
                    score += 0.15
            final_scores[chunk_id] = score

        top_ids = sorted(final_scores, key=final_scores.get, reverse=True)[:top_k]
        results = []
        for rank, chunk_id in enumerate(top_ids, 1):
            row = self.df_chunks.loc[chunk_id]
            bm25_score = round(final_scores.get(chunk_id, 0.0), 4)
            results.append({
                "rank": rank,
                "chunk_id": chunk_id,
                "policy_id": str(row.get("policy_id", "")),
                "policy_name": str(row.get("policy_name", "")),
                "category": str(row.get("category", "")),
                "region": str(row.get("region", "")),
                "source_url": str(row.get("source_url", "")),
                "score": bm25_score,
                "vector_score": 0.0,
                "bm25_score": bm25_score,
                "evidence_text": str(row.get("text", "")),
            })
        return results

def get_searcher():
    global _searcher, _searcher_mode
    if _searcher is None:
        with _searcher_lock:
            if _searcher is None:
                if FORCE_BM25_FALLBACK:
                    print("[Searcher] BENEPICK_FORCE_BM25_FALLBACK=1 -> use BM25 fallback.")
                    _searcher = BM25FallbackSearcher()
                    _searcher_mode = "bm25_fallback"
                    return _searcher
                preferred_device = "cuda" if _USE_CUDA else "cpu"
                devices_to_try = [preferred_device]
                if preferred_device == "cuda":
                    devices_to_try.append("cpu")

                last_exc = None
                for device in devices_to_try:
                    try:
                        print(f"[Searcher] Initializing hybrid searcher on {device}.")
                        _searcher = HybridSearcher(device=device)
                        _searcher_mode = f"hybrid_{device}"
                        break
                    except Exception as exc:
                        last_exc = exc
                        print(f"[Searcher] Hybrid init failed on {device}: {exc}")
                        _searcher = None
                        _searcher_mode = None

                if _searcher is None:
                    print("[Searcher] Switching to BM25 fallback mode.")
                    if last_exc is not None:
                        print(f"[Searcher] Last hybrid init error: {last_exc}")
                    _searcher = BM25FallbackSearcher()
                    _searcher_mode = "bm25_fallback"
    return _searcher


def is_searcher_ready() -> bool:
    return _searcher is not None


def get_reranker():
    global _reranker
    if not ENABLE_RERANKER:
        return None
    if _reranker is None:
        with _reranker_lock:
            if _reranker is None:
                _device = "cuda" if _USE_CUDA else "cpu"
                _reranker = FlagReranker('BAAI/bge-reranker-v2-m3', use_fp16=_USE_CUDA, device=_device)
                print(f"Reranker: bge-reranker-v2-m3 ({_device})")
    return _reranker

# ── 품질 기준 ──
QUALITY_HIGH   = 0.7
QUALITY_MEDIUM = 0.4


# ── 응답 형식 헬퍼 ──
def success_response(data: dict) -> dict:
    """팀 공통 성공 응답 형식"""
    return {
        "success": True,
        "data": data,
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    }

def error_response(error_code: str, error_message: str) -> dict:
    """팀 공통 실패 응답 형식"""
    return {
        "success": False,
        "error_code": error_code,
        "error_message": error_message,
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    }



# ── Reranking ──
def rerank(query: str, results: list, top_k: int = 5) -> list:
    """
    bge-reranker-v2-m3 로 정밀 재정렬
    score(float 0~1) 업데이트 후 반환
    """
    if not results:
        return []

    reranker = get_reranker()
    if reranker is None:
        print("[Rerank] disabled by BENEPICK_ENABLE_RERANKER=0 -> use search ranking")
        return sorted(results, key=lambda x: x.get("score", 0), reverse=True)[:top_k]

    original_scores = [float(r.get("score", 0.0) or 0.0) for r in results]
    min_original = min(original_scores) if original_scores else 0.0
    max_original = max(original_scores) if original_scores else 0.0
    original_range = max(max_original - min_original, 1e-9)

    texts = [r['evidence_text'] for r in results]
    pairs = [[query, text] for text in texts]
    scores = reranker.compute_score(pairs, normalize=True)

    # Domain result: generic rerankers can push policy-exact matches down.
    # Blend reranker score with the original hybrid score instead of replacing it.
    blend = min(max(RERANK_BLEND_WEIGHT, 0.0), 1.0)
    for result, original_score, rerank_score in zip(results, original_scores, scores):
        normalized_original = (original_score - min_original) / original_range
        final_score = (1.0 - blend) * normalized_original + blend * float(rerank_score)
        result["search_score"] = round(original_score, 4)
        result["reranker_score"] = round(float(rerank_score), 4)
        result["score"] = round(final_score, 4)

    reranked = sorted(results, key=lambda x: x['score'], reverse=True)
    return reranked[:top_k]


def _elapsed_ms(started_at: float) -> int:
    return round((time.perf_counter() - started_at) * 1000)


# ── CRAG 품질 검증 ──
def crag_quality_check(query: str, results: list) -> list:
    """score 평균으로 품질 판단 후 3단계 분기"""
    if not results:
        return _fallback(query)

    # score는 float 0~1 사이 (팀 규칙)
    scores = [r['score'] for r in results]
    quality = sum(scores) / len(scores)
    print(f"[CRAG] 품질 점수: {quality:.3f}")

    if quality >= QUALITY_HIGH:
        print("[CRAG] 품질 양호 → 원본 결과 사용")
        return results

    elif quality >= QUALITY_MEDIUM:
        print("[CRAG] medium quality: retry with relaxed query")
        relaxed = relax_query(query)
        try:
            results2 = get_searcher().search(relaxed, top_k=RETRIEVAL_TOP_K, alpha=0.6)
            if not results2:
                return _fallback(query)
            reranked_retry = rerank(query, results2, top_k=5)
            retry_quality = _score_quality(reranked_retry)
            print(f"[CRAG] relaxed retry quality: {retry_quality:.3f}")
            if retry_quality >= QUALITY_HIGH and not _is_broad_or_low_signal_query(query):
                return reranked_retry
            print("[CRAG] retry quality still weak or query is broad -> category fallback")
            fallback_results = _fallback(query)
            if fallback_results:
                fallback_quality = _score_quality(fallback_results)
                print(f"[CRAG] fallback quality: {fallback_quality:.3f}")
                if fallback_quality >= retry_quality:
                    return fallback_results
            return reranked_retry
        except Exception as e:
            # Keep current docs on low-memory failures instead of crashing the whole request.
            print(f"[CRAG relaxed retry failed] {e} -> keep current docs")
            return results[:5]

    else:
        print("[CRAG] 품질 낮음 → 카테고리 폴백")
        return _fallback(query)


def relax_query(query: str) -> str:
    """Remove profile/noise tokens so retry query focuses on policy intent."""
    stopwords = {
        # region
        "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
        "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
        "강남구", "강북구", "강서구", "강동구", "관악구", "광진구", "구로구",
        "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구",
        "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구",
        "은평구", "종로구", "중구", "중랑구",
        # profile
        "무직", "실업", "미취업", "청년도", "청년", "single", "unemployed",
        "age", "household", "region",
        # household words
        "가구", "세대", "거주", "사는", "살고있는",
        # helper words
        "있나요", "뭐예요", "알려줘", "정리해줘", "추천해줘",
    }

    intent_phrases = [
        "신청하기 전에 확인해야 할 점을 정리해줘",
        "이런 상황에서 함께 볼 만한 정책을 추천해줘",
        "받을 수 있는 조건이 뭐예요",
        "지원 금액이나 기간이 궁금해요",
        "온라인으로 신청할 수 있나요",
        "필요한 서류가 뭐예요",
        "소득 기준이 있나요",
        "서울에 살면 신청할 수 있나요",
        "27세 무직 청년도 대상이 될 수 있나요",
        "신청 방법을 알려줘",
    ]

    text = query
    for phrase in intent_phrases:
        text = text.replace(phrase, " ")

    raw_tokens = re.findall(r"[0-9A-Za-z가-힣]+", text.lower())
    suffixes = ("에서", "에게", "으로", "로", "에는", "에서의", "에서만", "에", "은", "는", "이", "가", "을", "를", "도", "만")
    kept = []
    for token in raw_tokens:
        t = token
        for suffix in suffixes:
            if t.endswith(suffix) and len(t) > len(suffix) + 1:
                t = t[:-len(suffix)]
                break
        if re.fullmatch(r"\d+세", t) or re.fullmatch(r"\d+인", t):
            continue
        if t in stopwords:
            continue
        if len(t) < 2:
            continue
        kept.append(t)

    relaxed = " ".join(kept[:8]).strip()
    if not relaxed:
        relaxed = " ".join(re.findall(r"[0-9A-Za-z가-힣]+", query))[:120].strip()
    print(f"[CRAG] 완화된 쿼리: '{query}' → '{relaxed}'")
    return relaxed


def get_category_query(query: str) -> str:
    """Map noisy user query into stable category query for fallback retrieval."""
    normalized = relax_query(query)
    if not normalized:
        normalized = query

    if "디지털" in normalized and any(keyword in normalized for keyword in ("교육", "역량", "훈련", "배움")):
        return "디지털 역량 교육 지원"
    if "평생교육" in normalized and "바우처" in normalized:
        return "평생교육 바우처"
    if "국비" in normalized or "직업훈련" in normalized:
        return "국비 직업훈련 지원"
    if "장학" in normalized or "대학생" in normalized:
        return "대학생 장학금 지원"

    rules = [
        (("월세", "전세", "주거", "주택", "임대", "임차", "보증금", "무주택"), "청년 주거 지원"),
        (("취업", "구직", "실업", "실직", "면접", "청년수당", "고용", "국민취업", "훈련", "내일배움"), "청년 고용 지원"),
        (("창업", "예비창업", "사업화", "소상공인", "자영업", "정책자금"), "창업·소상공인 지원"),
        (("자산", "적금", "저축", "금융", "도약계좌", "희망적금"), "청년 자산형성 지원"),
        (("생계", "수급", "긴급복지", "기초생활"), "저소득 생활 지원"),
        (("의료", "병원", "치료", "건강", "심리"), "의료·건강 지원"),
        (("교육", "훈련", "수강", "바우처", "디지털"), "교육 훈련 지원"),
        (("출산", "육아", "보육", "양육", "아동"), "출산·육아 지원"),
        (("장애", "장애인"), "장애인 복지 지원"),
        (("노인", "연금", "기초연금"), "노인 복지 지원"),
        (("다문화", "한부모", "가족"), "가족 복지 지원"),
    ]

    for keywords, category in rules:
        if any(k in normalized for k in keywords):
            return category

    if any(k in query for k in ("추천", "정리", "확인", "비교")):
        return "복지 지원 정책"
    return normalized


def _build_fallback_queries(query: str) -> list[str]:
    normalized = relax_query(query)
    if not normalized:
        normalized = str(query or "").strip()

    queries: list[str] = []

    def add(candidate: str) -> None:
        value = str(candidate or "").strip()
        if value and value not in queries:
            queries.append(value)

    add(get_category_query(query))

    if "디지털" in normalized and any(keyword in normalized for keyword in ("교육", "역량", "훈련", "배움")):
        add("디지털 역량 교육 지원")
        add("디지털 교육 지원")
        add("디지털 배움 지원")
        add("교육 훈련 지원")
    if "평생교육" in normalized and "바우처" in normalized:
        add("평생교육 바우처")
        add("평생교육 지원")
        add("교육 바우처")
    if "국비" in normalized or "직업훈련" in normalized:
        add("국비 직업훈련 지원")
        add("직업훈련 지원")
        add("교육 훈련 지원")
    if "장학" in normalized or "대학생" in normalized:
        add("대학생 장학금 지원")
        add("장학금 지원")
        add("교육 지원")

    if any(keyword in normalized for keyword in ("교육", "훈련", "바우처", "디지털")):
        add("교육 훈련 지원")
    if any(keyword in normalized for keyword in ("의료", "건강", "암환자", "임산부")):
        add("의료 건강 지원")
    if any(keyword in normalized for keyword in ("주거", "월세", "전세", "보증금")):
        add("청년 주거 지원")

    add(normalized)
    return queries[:5]


def _score_quality(results: list[dict]) -> float:
    if not results:
        return 0.0
    scores = [float(result.get("score", 0.0)) for result in results]
    return (sum(scores) / len(scores)) if scores else 0.0


def _is_broad_or_low_signal_query(query: str) -> bool:
    normalized = str(query or "").strip().lower()
    broad_markers = ("정책", "지원", "알려", "궁금", "추천", "맞춤", "있나요", "뭐가", "어떤")
    specific_markers = ("월세", "전세", "암환자", "임산부", "차상위", "기초생활", "장학", "국비", "바우처")
    has_broad = any(marker in normalized for marker in broad_markers)
    has_specific = any(marker in normalized for marker in specific_markers)
    token_count = len(re.findall(r"[0-9A-Za-z가-힣]+", normalized))
    return has_broad and (not has_specific or token_count <= 4)


def _fallback(query: str) -> list:
    """Fallback retrieval by category + rerank with original question."""
    fallback_queries = _build_fallback_queries(query)
    print(f"[CRAG] 폴백 쿼리들: {fallback_queries}")
    try:
        merged: dict[str, dict] = {}
        for index, fallback_query in enumerate(fallback_queries):
            candidates = get_searcher().search(fallback_query, top_k=15, alpha=0.6)
            for candidate in candidates:
                chunk_id = candidate["chunk_id"]
                weighted_score = float(candidate.get("score", 0.0)) - (index * 0.02)
                existing = merged.get(chunk_id)
                if existing is None or weighted_score > float(existing.get("score", 0.0)):
                    merged[chunk_id] = {**candidate, "score": round(weighted_score, 4)}

        if not merged:
            return []
        merged_candidates = sorted(merged.values(), key=lambda item: item.get("score", 0), reverse=True)[:25]
        return rerank(query, merged_candidates, top_k=5)
    except Exception as e:
        print(f"[CRAG fallback failed] {e}")
        return []


# ── LLM 답변 생성 ──
def _clip_evidence_text(text: object, max_chars: int = 320) -> str:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 1].rstrip() + "..."


def _clip_answer_text(text: object, max_chars: int = 900) -> str:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 1].rstrip() + "..."


def generate_answer(query: str, docs: list, lang_code: str = "ko") -> str:
    """
    검색된 문서 기반 최종 답변 생성
    lang_code: "ko"/"en"/"vi"/"zh" (팀 규칙 — ISO 639-1)
    """
    grounded_docs = docs[:3]
    context = "\n\n".join([
        (
            f"[{i+1}] 정책명: {d['policy_name']}\n"
            f"근거: {_clip_evidence_text(d['evidence_text'])}\n"
            f"출처: {str(d.get('source_url') or '').strip() or '없음'}"
        )
        for i, d in enumerate(grounded_docs)
    ])

    lang_prompt = {
        "ko": "한국어로 답변하세요.",
        "en": "Please answer in English.",
        "vi": "Vui lòng trả lời bằng tiếng Việt.",
        "zh": "请用中文回答。",
    }.get(lang_code, "한국어로 답변하세요.")

    messages = [
        SystemMessage(content=f"""당신은 한국 복지 정책 전문 AI입니다.
반드시 제공된 참고 문서 안의 정보만 사용해서 답변하세요.

출력 형식:
1. 핵심 답변
2. 근거 정책
3. 신청/확인 방법
4. 확인 필요 사항

규칙:
- 첫 문장은 질문의 핵심에 직접 답할 것
- 참고 문서에 없는 금액, 대상, 기간, 자격 조건은 추측하지 말 것
- 확실하지 않은 내용은 "확인 필요"라고 명시할 것
- 관련 없는 정책은 언급하지 말 것
- 답변은 간결하게 6문장 이내로 정리할 것
- {lang_prompt}"""),
        HumanMessage(content=f"질문: {query}\n\n참고 문서:\n{context}\n\n답변:")
    ]

    response = llm.invoke(messages)
    answer = _clip_answer_text(response.content)

    source_lines = []
    for doc in grounded_docs[:2]:
        source_url = str(doc.get("source_url") or "").strip()
        if source_url:
            source_lines.append(f"- {doc['policy_name']}: {source_url}")
    if source_lines and "출처" not in answer:
        answer = f"{answer}\n\n출처\n" + "\n".join(source_lines)

    return answer


def _format_structured_sources_v2(docs: list[dict], limit: int = 2) -> list[str]:
    lines: list[str] = []
    seen_urls: set[str] = set()
    for doc in docs[:limit]:
        policy_name = str(doc.get("policy_name", "")).strip() or "정책명 확인 필요"
        source_url = str(doc.get("source_url", "")).strip()
        if not source_url or source_url in seen_urls:
            continue
        seen_urls.add(source_url)
        lines.append(f"- {policy_name}: {source_url}")
    return lines


def _build_structured_answer_fallback_v2(query: str, docs: list[dict]) -> str:
    top_docs = docs[:2]
    policy_names = [
        str(doc.get("policy_name", "")).strip()
        for doc in top_docs
        if str(doc.get("policy_name", "")).strip()
    ]
    policy_lines = [f"- {name}" for name in policy_names] or [
        "- 관련 정책은 검색되었지만 정책명을 다시 확인할 필요가 있습니다."
    ]
    source_lines = _format_structured_sources_v2(docs)
    if not source_lines:
        source_lines = ["- 공식 출처 링크를 확인하지 못했습니다."]

    return "\n".join(
        [
            "핵심 답변:",
            f"- '{query}'와 관련해 우선 확인할 정책 후보를 찾았습니다.",
            "",
            "근거 정책:",
            *policy_lines,
            "",
            "신청/확인 방법:",
            "- 각 정책의 공식 링크에서 지원 대상, 지원 내용, 신청 기간을 확인해 주세요.",
            "- 거주 지역과 소득 구간이 문서 조건과 일치하는지 다시 확인해 주세요.",
            "",
            "확인 필요:",
            "- 검색된 문서만으로는 최종 수급 여부를 확정할 수 없습니다.",
            "- 세부 금액, 기간, 추가 자격 조건은 공식 공고문 확인이 필요합니다.",
            "",
            "출처:",
            *source_lines,
        ]
    )


def _normalize_structured_answer_v2(answer: str, query: str, docs: list[dict]) -> str:
    normalized = str(answer or "").strip()
    required_headers = ["핵심 답변", "근거 정책", "신청/확인 방법", "확인 필요", "출처"]
    if not normalized:
        return _build_structured_answer_fallback_v2(query, docs)

    if all(header in normalized for header in required_headers):
        return normalized

    body_lines = [line.strip("- ").strip() for line in re.split(r"[\r\n]+", normalized) if line.strip()]
    if not body_lines:
        return _build_structured_answer_fallback_v2(query, docs)

    policy_lines = [
        f"- {str(doc.get('policy_name', '')).strip()}"
        for doc in docs[:2]
        if str(doc.get("policy_name", "")).strip()
    ] or ["- 검색 결과 정책명을 다시 확인할 필요가 있습니다."]
    source_lines = _format_structured_sources_v2(docs)
    if not source_lines:
        source_lines = ["- 공식 출처 링크를 확인하지 못했습니다."]

    return "\n".join(
        [
            "핵심 답변:",
            f"- {body_lines[0]}",
            "",
            "근거 정책:",
            *policy_lines,
            "",
            "신청/확인 방법:",
            f"- {body_lines[1] if len(body_lines) > 1 else '지원 대상, 신청 기간, 제출 서류를 공식 링크에서 다시 확인해 주세요.'}",
            "",
            "확인 필요:",
            f"- {body_lines[2] if len(body_lines) > 2 else '문서에 없는 금액, 기간, 추가 자격 조건은 공식 공고문 확인이 필요합니다.'}",
            "",
            "출처:",
            *source_lines,
        ]
    )


def _build_answer_system_prompt_v2(lang_prompt: str, variant: str = DEFAULT_PROMPT_VARIANT) -> str:
    variant = str(variant or DEFAULT_PROMPT_VARIANT).upper()
    if variant == "B":
        return f"""당신은 한국 복지 정책 전문 AI입니다.
반드시 제공된 참고 문서 안의 정보만 사용해서 답변하세요.

답변은 반드시 아래 다섯 섹션을 그대로 지키세요.
핵심 답변:
- 질문에 바로 답하는 한 줄 요약

근거 정책:
- 정책명
- 정책별로 왜 관련 있는지 짧게 설명

신청/확인 방법:
- 지원 대상 확인
- 혜택/지원 내용 확인
- 신청 방법 또는 확인 경로 안내

확인 필요:
- 문서에 없거나 불확실한 조건
- 지역/소득/기간처럼 추가 확인이 필요한 요소

출처:
- 정책명: URL

규칙:
- 첫 문장은 질문에 직접 답할 것
- 참고 문서에 없는 금액, 대상, 기간, 자격 조건은 추측하지 말 것
- 확실하지 않은 내용은 반드시 '확인 필요' 섹션에 적을 것
- 관련 없는 정책은 언급하지 말 것
- 각 섹션은 1~2개 bullet 이내로 간결하게 작성할 것
- 신청/확인 방법 섹션에는 사용자가 바로 확인할 다음 행동을 최소 2개 이상 제시할 것
- {lang_prompt}"""

    return f"""당신은 한국 복지 정책 전문 AI입니다.
반드시 제공된 참고 문서 안의 정보만 사용해서 답변하세요.

답변은 반드시 아래 다섯 섹션을 그대로 지키세요.
핵심 답변:
- ...

근거 정책:
- ...

신청/확인 방법:
- ...

확인 필요:
- ...

출처:
- 정책명: URL

규칙:
- 첫 문장은 질문에 직접 답할 것
- 참고 문서에 없는 금액, 대상, 기간, 자격 조건은 추측하지 말 것
- 확실하지 않은 내용은 '확인 필요' 섹션에 적을 것
- 관련 없는 정책은 언급하지 말 것
- 각 섹션은 1~2개 bullet 이내로 간결하게 작성할 것
- {lang_prompt}"""


def generate_answer(
    query: str,
    docs: list,
    lang_code: str = "ko",
    prompt_variant: str = DEFAULT_PROMPT_VARIANT,
) -> str:
    """
    Generate a grounded, structured answer from retrieved policy documents.
    This redefinition intentionally overrides the earlier implementation.
    """
    grounded_docs = docs[:3]
    context = "\n\n".join(
        [
            (
                f"[{i+1}] 정책명: {d['policy_name']}\n"
                f"근거: {_clip_evidence_text(d['evidence_text'])}\n"
                f"출처: {str(d.get('source_url') or '').strip() or '없음'}"
            )
            for i, d in enumerate(grounded_docs)
        ]
    )

    lang_prompt = {
        "ko": "한국어로 답변하세요.",
        "en": "Please answer in English.",
        "vi": "Vui lòng trả lời bằng tiếng Việt.",
        "zh": "请用中文回答。",
    }.get(lang_code, "한국어로 답변하세요.")

    messages = [
        SystemMessage(
            content=_build_answer_system_prompt_v2(lang_prompt, prompt_variant)
        ),
        HumanMessage(content=f"질문: {query}\n\n참고 문서:\n{context}\n\n답변:"),
    ]

    response = llm.invoke(messages)
    answer = _clip_answer_text(getattr(response, "content", response), max_chars=1200)
    answer = _normalize_structured_answer_v2(answer, query, grounded_docs)
    return _clip_answer_text(answer, max_chars=1200)


def _map_query_value(value: object) -> str:
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return ""
    return _QUERY_VALUE_MAP.get(text, _QUERY_VALUE_MAP.get(text.upper(), text))


def _normalize_interest_tags(tags: object) -> list[str]:
    if tags is None:
        return []
    if isinstance(tags, str):
        raw = [part.strip() for part in re.split(r"[|,;/]+", tags) if part.strip()]
    else:
        raw = [str(part).strip() for part in tags if str(part).strip()]
    normalized = []
    seen = set()
    for tag in raw:
        mapped = _INTEREST_TAG_MAP.get(tag, _INTEREST_TAG_MAP.get(tag.lower(), tag))
        key = mapped.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(mapped)
    return normalized


def _sanitize_query_seed(query: str) -> str:
    text = re.sub(
        r"\b(region|age|household|employment|housing|income|interest_tags|welfare|policy|recommendation)\b",
        " ",
        str(query),
        flags=re.IGNORECASE,
    )
    for token, mapped in _QUERY_VALUE_MAP.items():
        text = re.sub(rf"\b{re.escape(token)}\b", mapped, text)
    return re.sub(r"\s+", " ", text).strip()


def _expand_domain_aliases(query: str) -> list[str]:
    normalized_query = re.sub(r"\s+", " ", str(query or "")).strip().lower()
    if not normalized_query:
        return []

    alias_groups: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
        (("영유아 양육비", "양육비 지원"), ("보육료", "유아학비", "양육수당", "아동수당")),
        (("조손가정",), ("가족돌봄", "아동돌봄", "가족지원")),
        (("장애아동 가족 양육", "장애아동 양육"), ("장애아동", "발달재활", "가족지원")),
        (("병원비 지원", "의료비 지원", "저소득층 병원비"), ("의료비", "본인부담금", "진료비")),
        (("난임", "난임 시술비"), ("난임부부 시술비", "보조생식술", "의료비 지원")),
        (("채무조정", "금융 취약계층"), ("신용회복", "서민금융", "채무조정 지원")),
        (("자산형성", "중장년 자산형성"), ("희망저축계좌", "내일저축계좌", "자산형성지원")),
    ]

    expanded: list[str] = []
    seen: set[str] = set()
    for triggers, aliases in alias_groups:
        if not any(trigger in normalized_query for trigger in triggers):
            continue
        for alias in aliases:
            key = alias.lower()
            if key in seen:
                continue
            seen.add(key)
            expanded.append(alias)
    return expanded


def build_search_query(query: str, user_condition: dict) -> str:
    """Build a human-readable retrieval query from profile fields."""
    seed = _sanitize_query_seed(query)
    parts = [seed] if seed else []
    parts.extend(_expand_domain_aliases(seed or query))

    if user_condition:
        region = str(user_condition.get("region", "")).strip()
        if region:
            parts.append(region)

        age = user_condition.get("age")
        if age not in (None, ""):
            try:
                age_num = int(float(str(age)))
                parts.append(f"만 {age_num}세")
            except ValueError:
                parts.append(str(age).strip())

        income_level = str(user_condition.get("income_level", "")).strip()
        if income_level:
            parts.append(income_level)

        income_band = _map_query_value(user_condition.get("income_band", ""))
        if income_band:
            parts.append(income_band)

        household = _map_query_value(user_condition.get("household_type", ""))
        if household:
            parts.append(household)

        employment = _map_query_value(user_condition.get("employment_status", ""))
        if employment:
            parts.append(employment)

        housing = _map_query_value(user_condition.get("housing_status", ""))
        if housing:
            parts.append(housing)

        interest_tags = _normalize_interest_tags(user_condition.get("interest_tags"))
        if interest_tags:
            parts.extend(interest_tags)

    deduped_parts = []
    seen = set()
    for part in parts:
        text = re.sub(r"\s+", " ", str(part).strip())
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped_parts.append(text)

    normalized_query = " ".join(deduped_parts) if deduped_parts else str(query).strip()
    print(f"[Query normalized] '{query}' -> '{normalized_query}'")
    return normalized_query


def retrieve_rag_documents(user_query: str, user_condition: dict | None = None) -> dict:
    user_condition = user_condition or {}
    pipeline_started_at = time.perf_counter()

    search_query = build_search_query(user_query, user_condition)

    search_started_at = time.perf_counter()
    results = get_searcher().search(
        search_query,
        top_k=RETRIEVAL_TOP_K,
        alpha=RETRIEVAL_ALPHA,
        user_region=user_condition.get("region", ""),
    )
    search_time_ms = _elapsed_ms(search_started_at)
    if not results:
        return error_response("SEARCH_FAILED", "검색 결과가 없습니다.")
    print(f"[검색] {len(results)}개 후보 검색 완료 ({search_time_ms}ms)")

    rerank_started_at = time.perf_counter()
    try:
        reranked = rerank(user_query, results, top_k=5)
        print(f"[Rerank] {len(reranked)}개로 압축")
    except Exception as e:
        print(f"[Rerank 스킵] {e} -> 상위 5개 사용")
        reranked = results[:5]
    rerank_time_ms = _elapsed_ms(rerank_started_at)
    print(f"[Timing] rerank={rerank_time_ms}ms")

    crag_started_at = time.perf_counter()
    try:
        final_docs = crag_quality_check(user_query, reranked)
    except Exception as e:
        print(f"[CRAG failed] {e} -> keep reranked docs")
        final_docs = reranked
    crag_time_ms = _elapsed_ms(crag_started_at)
    print(f"[Timing] crag={crag_time_ms}ms")
    print(f"[CRAG] 최종 {len(final_docs)}개 문서 확정")

    return success_response({
        "query": user_query,
        "user_condition": user_condition,
        "search_time_ms": search_time_ms,
        "rerank_time_ms": rerank_time_ms,
        "crag_time_ms": crag_time_ms,
        "total_retrieval_time_ms": _elapsed_ms(pipeline_started_at),
        "docs_used": [
            {
                "policy_id": d["policy_id"],
                "chunk_id": d["chunk_id"],
                "policy_name": d["policy_name"],
                "score": round(float(d["score"]), 4),
                "rank": d["rank"],
            }
            for d in final_docs
        ],
        "final_docs": final_docs,
        "doc_count": len(final_docs),
    })


def benepick_rag(
    user_query: str,
    lang_code: str = "ko",
    user_condition: dict = None,
) -> dict:
    """
    BenePick RAG main pipeline.
    Retrieval succeeds first, then answer generation is attempted.
    """
    user_condition = user_condition or {}

    print(f"\n{'='*50}")
    print(f"??: {user_query}")
    if user_condition:
        print(f"??: {user_condition}")
    print(f"{'='*50}")

    try:
        pipeline_started_at = time.perf_counter()
        retrieval_result = retrieve_rag_documents(user_query, user_condition)
        if not retrieval_result.get("success"):
            return retrieval_result

        retrieval_data = retrieval_result.get("data") or {}
        final_docs = retrieval_data.get("final_docs") or []

        answer_started_at = time.perf_counter()
        answer = generate_answer(user_query, final_docs, lang_code)
        answer_time_ms = _elapsed_ms(answer_started_at)
        total_time_ms = _elapsed_ms(pipeline_started_at)
        print(
            "[Timing] summary "
            f"search={retrieval_data.get('search_time_ms')}ms "
            f"rerank={retrieval_data.get('rerank_time_ms')}ms "
            f"crag={retrieval_data.get('crag_time_ms')}ms "
            f"answer={answer_time_ms}ms "
            f"total={total_time_ms}ms"
        )

        return success_response({
            "query": user_query,
            "answer": answer,
            "lang_code": lang_code,
            "user_condition": user_condition,
            "search_time_ms": retrieval_data.get("search_time_ms"),
            "rerank_time_ms": retrieval_data.get("rerank_time_ms"),
            "crag_time_ms": retrieval_data.get("crag_time_ms"),
            "docs_used": retrieval_data.get("docs_used") or [],
            "doc_count": retrieval_data.get("doc_count", len(final_docs)),
        })

    except Exception as e:
        print(f"[ERROR] {e}")
        return error_response("SEARCH_FAILED", str(e))


if __name__ == "__main__":
    import pandas as pd

    test_queries = [
        ("서울 청년 월세 지원 받을 수 있어요?", "ko"),
        ("취업 준비생 훈련비 지원", "ko"),
        ("노인 돌봄 서비스", "ko"),
        ("청년 창업 지원금 받을 수 있나요?", "ko"),
        ("대학생 장학금 신청 방법", "ko"),
        ("장애인 취업 지원 프로그램", "ko"),
        ("장애인 의료비 지원", "ko"),
        ("출산 지원금 얼마나 받을 수 있어요?", "ko"),
        ("어린이집 보육료 지원", "ko"),
        ("기초생활수급자 혜택 뭐가 있어요?", "ko"),
        ("다문화 가정 한국어 교육 지원", "ko"),
        ("disability support benefits", "en"),
    ]

    alpha_values = [0.3, 0.5, 0.6, 0.7, 0.9]  # 0.6은 현재 기준값
    results_data = []

    for alpha in alpha_values:
        print(f"\n{'='*60}")
        print(f"[alpha = {alpha}] 실험")
        print(f"{'='*60}")

        alpha_qualities = []

        for query, lang in test_queries:
            # alpha 값 적용해서 검색
            results = get_searcher().search(query, top_k=25, alpha=alpha)
            reranked = rerank(query, results, top_k=5)
            final_docs = crag_quality_check(query, reranked)

            scores = get_reranker().compute_score(
                [[query, d["evidence_text"]] for d in final_docs],
                normalize=True
            )
            quality = round(sum(scores) / len(scores), 3)
            alpha_qualities.append(quality)

            print(f"질문: {query[:20]}... | 품질: {quality:.3f}")

            results_data.append({
                "alpha":   alpha,
                "질문":    query,
                "품질 점수": quality,
                "사용된 정책": ", ".join([d["policy_name"] for d in final_docs]),
            })

        avg = round(sum(alpha_qualities) / len(alpha_qualities), 3)
        print(f"\n▶ alpha={alpha} 평균 품질: {avg:.3f}")

    df = pd.DataFrame(results_data)
    df.to_excel("실험결과_alpha비교.xlsx", index=False)
    print("\n\n엑셀 저장 완료! -> 실험결과_alpha비교.xlsx")

    # alpha별 평균 요약
    summary = df.groupby("alpha")["품질 점수"].mean().round(3)
    print("\nalpha별 평균 품질 점수")
    print(summary)
