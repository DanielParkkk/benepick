import json
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
    model = os.getenv("OLLAMA_MODEL", os.getenv("GEMMA_MODEL", "gemma4:latest"))
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
    if provider_override == "gemma":
        provider_candidates.append("ollama")
    elif provider_override in {"openai", "groq", "ollama"}:
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
CONFIDENCE_HIGH_SCORE = 0.75
CONFIDENCE_MEDIUM_SCORE = 0.55
CONFIDENCE_HIGH_GAP = 0.08
CONFIDENCE_MEDIUM_GAP = 0.03
CONFIDENCE_CATEGORY_PENALTY = 0.08
CONFIDENCE_STRONG_NAME_MATCH = 0.6
CONFIDENCE_WEAK_NAME_MATCH = 0.3


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


def _confidence_tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[0-9A-Za-z가-힣]+", str(text or "").lower())
    return [token for token in tokens if len(token) >= 2]


def _policy_name_match_ratio(query: str, policy_name: str) -> float:
    query_tokens = set(_confidence_tokenize(query))
    if not query_tokens:
        return 0.0
    policy_tokens = set(_confidence_tokenize(policy_name))
    if not policy_tokens:
        return 0.0
    overlap = query_tokens & policy_tokens
    return round(len(overlap) / max(1, len(query_tokens)), 4)


def assess_answer_confidence(query: str, docs: list) -> dict:
    """Summarize retrieval certainty for answer-time fallback handling."""
    docs = list(docs or [])
    top_docs = docs[:3]
    top1 = float(top_docs[0].get("score", 0.0) or 0.0) if top_docs else 0.0
    top2 = float(top_docs[1].get("score", 0.0) or 0.0) if len(top_docs) > 1 else 0.0
    gap = top1 - top2

    categories = []
    seen_categories = set()
    for doc in top_docs:
        category = str(doc.get("category", "") or "").strip()
        if not category:
            continue
        key = category.lower()
        if key in seen_categories:
            continue
        seen_categories.add(key)
        categories.append(category)

    top1_name = str(top_docs[0].get("policy_name", "") or "").strip() if top_docs else ""
    name_match_ratio = _policy_name_match_ratio(query, top1_name)
    category_penalty = CONFIDENCE_CATEGORY_PENALTY if len(categories) >= 2 else 0.0
    blended_confidence = max(
        0.0,
        min(
            1.0,
            (top1 * 0.7)
            + (max(gap, 0.0) * 1.5)
            + (name_match_ratio * 0.2)
            - category_penalty,
        ),
    )

    if (
        top1 >= CONFIDENCE_HIGH_SCORE
        and gap >= CONFIDENCE_HIGH_GAP
        and name_match_ratio >= CONFIDENCE_WEAK_NAME_MATCH
    ):
        level = "high"
        reason = "top-1 score is strong and clearly ahead of the next candidate"
    elif (
        top1 >= CONFIDENCE_MEDIUM_SCORE
        and gap >= CONFIDENCE_MEDIUM_GAP
        and blended_confidence >= CONFIDENCE_MEDIUM_SCORE
    ):
        level = "medium"
        reason = "top candidates are relevant, but the leading result is not decisive"
    else:
        level = "low"
        reason = "top candidates are close together or individually weak, so a single exact policy cannot be stated safely"

    if name_match_ratio >= CONFIDENCE_STRONG_NAME_MATCH:
        reason += "; the top policy name strongly overlaps with the query"
    elif name_match_ratio <= CONFIDENCE_WEAK_NAME_MATCH:
        reason += "; the top policy name does not overlap strongly with the query wording"

    if len(categories) >= 2:
        reason += f"; top results span multiple categories ({', '.join(categories[:3])})"

    candidates = []
    seen_names = set()
    for doc in top_docs:
        name = str(doc.get("policy_name", "") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        candidates.append(name)

    return {
        "level": level,
        "top1_score": round(top1, 4),
        "top2_score": round(top2, 4),
        "gap": round(gap, 4),
        "confidence_score": round(blended_confidence, 4),
        "name_match_ratio": round(name_match_ratio, 4),
        "needs_confirmation": level != "high",
        "candidate_policy_names": candidates,
        "reason": reason,
    }


def _build_confidence_guidance(confidence_meta: dict | None) -> str:
    if not confidence_meta:
        return ""

    level = str(confidence_meta.get("level", "medium"))
    candidates = confidence_meta.get("candidate_policy_names") or []
    reason = str(confidence_meta.get("reason", "") or "").strip()
    lines = [
        f"confidence_level: {level}",
        f"candidate_policies: {', '.join(candidates) if candidates else 'none'}",
    ]
    if reason:
        lines.append(f"confidence_reason: {reason}")
    if level == "low":
        lines.append(
            "answer_rule: do not state a single policy as certain; present the top candidates and explain that exact matching needs verification"
        )
    elif level == "medium":
        lines.append(
            "answer_rule: mention the leading candidate first, but note that eligibility or conditions may change the best match"
        )
    else:
        lines.append(
            "answer_rule: answer directly, but stay grounded in the provided evidence"
        )
    return "\n".join(lines)


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
                if _should_replace_with_fallback(query, reranked_retry, fallback_results, retry_quality, fallback_quality):
                    return fallback_results
            return reranked_retry
        except Exception as e:
            # Keep current docs on low-memory failures instead of crashing the whole request.
            print(f"[CRAG relaxed retry failed] {e} -> keep current docs")
            return results[:5]

    else:
        print("[CRAG] 품질 낮음 → 카테고리 폴백")
        fallback_results = _fallback(query)
        if fallback_results:
            fallback_quality = _score_quality(fallback_results)
            print(f"[CRAG] fallback quality: {fallback_quality:.3f}")
            if _should_replace_with_fallback(query, results[:5], fallback_results, quality, fallback_quality):
                return fallback_results
        print("[CRAG] adaptive guard rejected fallback -> keep original low-quality docs")
        return results[:5]


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
        "무직", "실업", "미취업", "청년도", "single", "unemployed",
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

    # Preserve high-signal education intent anchors so fallback does not drift
    # from "직장인 야간/온라인 교육" into generic "온라인 교육" results.
    anchor_groups = [
        ("직장인", ("직장인", "재직자", "근로자")),
        ("야간", ("야간",)),
        ("온라인", ("온라인", "온오프라인", "온·오프라인")),
        ("교육", ("교육", "훈련", "직업훈련", "평생교육")),
    ]
    for preferred, terms in anchor_groups:
        if any(term in query for term in terms) and not any(term in kept for term in terms):
            kept.insert(0, preferred)

    relaxed = " ".join(kept[:8]).strip()
    if not relaxed:
        relaxed = " ".join(re.findall(r"[0-9A-Za-z가-힣]+", query))[:120].strip()
    print(f"[CRAG] 완화된 쿼리: '{query}' → '{relaxed}'")
    return relaxed


_INTENT_GROUP_TERMS = {
    "youth": ("청년", "대학생", "사회초년생"),
    "elderly": ("고령자", "노인", "어르신", "기초연금", "치매"),
    "disabled": ("장애", "장애인", "발달장애", "중증장애", "청각장애"),
    "child_youth": ("아동", "청소년", "학교 밖", "보호종료", "자립준비"),
    "family": ("한부모", "조손", "입양", "다문화", "가족", "신혼부부"),
    "low_income": ("저소득", "기초생활", "수급", "차상위", "위기", "긴급복지"),
    "middle_aged": ("중장년", "중년", "중장년층"),
    "small_business": ("소상공인", "자영업", "창업", "폐업", "저신용"),
    "farmer": ("농어업", "농업인", "어업인", "농어업인"),
    "parenting": ("출산", "육아", "보육", "양육", "영유아", "아이돌봄", "산후", "산모", "임산부", "양육모", "난임", "유산", "사산"),
}


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _intent_text(query: str, normalized: str | None = None) -> str:
    relaxed = normalized if normalized is not None else relax_query(query)
    return f"{str(query or '').lower()} {relaxed.lower()}"


def _intent_profile(query: str, normalized: str | None = None) -> dict[str, bool]:
    text = _intent_text(query, normalized)
    profile = {name: _contains_any(text, terms) for name, terms in _INTENT_GROUP_TERMS.items()}
    profile.update({
        "housing": _contains_any(text, ("월세", "전세", "주거", "주택", "임대", "임차", "보증금", "무주택", "반지하", "고시원")),
        "housing_repair": _contains_any(text, ("개보수", "수선", "집수리", "주거 안전", "편의 개선", "주거편의")),
        "rent": _contains_any(text, ("월세", "임대료")),
        "deposit_loan": _contains_any(text, ("보증금", "임차보증금", "전세대출", "전월세", "이자")),
        "jeonse_fraud": _contains_any(text, ("전세사기", "전세 피해")),
        "employment": _contains_any(text, ("취업", "구직", "실업", "실직", "재취업", "면접", "고용")),
        "vocational_training": _contains_any(text, ("직업훈련", "국비", "내일배움", "훈련비", "교통비", "식비")),
        "counseling_job": _contains_any(text, ("이력서", "자소서", "취업상담", "컨설팅")),
        "digital_education": _contains_any(text, ("디지털 역량", "디지털 교육", "디지털 문해", "디지털 배움", "디지털", "문해")),
        "education_device": _contains_any(text, ("디지털 기기", "기기 지원", "교육정보화", "정보화")),
        "scholarship": _contains_any(text, ("장학", "장학금")),
        "tuition": _contains_any(text, ("등록금", "학자금", "대학 등록금")),
        "graduate": _contains_any(text, ("대학원", "연구장학", "연구 장학")),
        "exam_school_out": _contains_any(text, ("검정고시", "학교 밖")),
        "lifelong": _contains_any(text, ("평생교육", "바우처")),
        "online_night": _contains_any(text, ("야간", "온라인", "직장인", "온·오프라인", "온오프라인", "일학습병행")),
        "medical": _contains_any(text, ("의료", "병원", "치료", "건강", "검진", "치과", "재활")),
        "mental": _contains_any(text, ("정신건강", "심리", "상담", "우울")),
        "severe_disease": _contains_any(text, ("중증질환", "암환자", "희귀질환")),
        "assistive_device": _contains_any(text, ("보청기", "휠체어", "보조기기")),
        "living": _contains_any(text, ("생계", "생활비", "난방비", "에너지", "바우처", "자활")),
        "finance": _contains_any(text, ("자산", "적금", "저축", "금융", "도약계좌", "희망저축", "근로장려", "자녀장려", "신용회복", "정책자금", "경영자금")),
        "finance_education": _contains_any(text, ("금융교육", "금융 교육", "자산관리", "서민금융")),
    })
    return profile


def _target_phrase(profile: dict[str, bool]) -> str:
    if profile["elderly"]:
        return "고령자"
    if profile["disabled"]:
        return "장애인"
    if profile["child_youth"]:
        return "아동 청소년"
    if profile["family"]:
        return "가족"
    if profile["low_income"]:
        return "저소득"
    if profile["middle_aged"]:
        return "중장년"
    if profile["small_business"]:
        return "소상공인"
    if profile["farmer"]:
        return "농어업인"
    if profile["youth"]:
        return "청년"
    return ""


def _join_query(*parts: str) -> str:
    return re.sub(r"\s+", " ", " ".join(part for part in parts if part).strip())


def _specific_category_query(query: str, normalized: str | None = None) -> str:
    normalized = normalized or relax_query(query)
    profile = _intent_profile(query, normalized)
    target = _target_phrase(profile)

    if profile["housing_repair"]:
        return _join_query(target or "주거취약계층", "주거 개보수 안전 지원")
    if profile["jeonse_fraud"]:
        return "전세사기 피해자 주거 지원"
    if profile["deposit_loan"]:
        return _join_query(target or "주거", "임차보증금 전월세 대출 이자 지원")
    if profile["rent"]:
        return _join_query(target or "주거", "월세 지원")
    if profile["housing"]:
        return _join_query(target or "주거취약계층", "주거 지원")

    if profile["education_device"]:
        return "교육정보화 디지털 기기 지원"
    if profile["graduate"]:
        return "대학원 연구장학금 지원"
    if profile["tuition"]:
        return "대학생 등록금 학자금 지원"
    if profile["scholarship"]:
        return "대학생 장학금 지원"
    if profile["digital_education"] and profile["middle_aged"]:
        return "중장년 디지털 문해 평생교육 지원"
    if profile["digital_education"]:
        return "디지털 역량 교육 지원"
    if profile["exam_school_out"]:
        return "학교 밖 청소년 검정고시 교육 지원"
    if profile["lifelong"]:
        return "평생교육 바우처"
    if profile["online_night"]:
        if profile["small_business"]:
            return "소상공인 온·오프라인 교육"
        return "직장인 재직자 온라인 야간 직업훈련 지원"
    if profile["vocational_training"]:
        return _join_query(target or "구직자", "직업훈련 지원")

    if profile["counseling_job"]:
        return "취업상담 이력서 자소서 컨설팅 지원"
    if profile["employment"]:
        return _join_query(target or "구직자", "취업 구직 지원")
    if profile["mental"] and profile["parenting"]:
        return "임산부 양육모 산후 우울 심리상담 지원"
    if profile["mental"]:
        return "정신건강 심리상담 치료 지원"
    if profile["severe_disease"]:
        return "중증질환 치료비 의료비 지원"
    if profile["assistive_device"]:
        return _join_query(target or "장애인", "보조기기 지원")
    if profile["medical"]:
        return _join_query(target, "의료 건강 지원")
    if profile["living"]:
        return _join_query(target or "저소득", "생활 안정 지원")
    if profile["parenting"]:
        return "출산 육아 양육 보육 지원"
    if profile["finance"] and profile["farmer"]:
        return "농어업인 정책자금 경영자금 금융 지원"
    if profile["finance_education"]:
        return _join_query(target or "서민", "금융교육 자산관리 지원")
    if profile["finance"]:
        return _join_query(target or "청년", "금융 자산형성 지원")
    if profile["small_business"]:
        return "창업 소상공인 지원"

    return normalized


def get_category_query(query: str) -> str:
    """Map noisy user query into stable category query for fallback retrieval."""
    normalized = relax_query(query)
    if not normalized:
        normalized = str(query or "").strip()
    specific = _specific_category_query(query, normalized)
    if specific:
        return specific
    if any(k in query for k in ("추천", "정리", "확인", "비교")):
        return "복지 지원 정책"
    return normalized


def _build_fallback_queries(query: str) -> list[str]:
    normalized = relax_query(query)
    if not normalized:
        normalized = str(query or "").strip()

    profile = _intent_profile(query, normalized)
    target = _target_phrase(profile)
    queries: list[str] = []

    def add(candidate: str) -> None:
        value = str(candidate or "").strip()
        if value and value not in queries:
            queries.append(value)

    specific = _specific_category_query(query, normalized)
    add(specific)
    add(normalized)

    if profile["housing_repair"]:
        add(_join_query(target or "주거취약계층", "주거 개보수"))
        add(_join_query(target or "주거취약계층", "주거 안전 지원"))
    if profile["jeonse_fraud"]:
        add("전세사기 피해자 주거 지원")
        add("전세사기 피해 이사 주거 지원")
    if profile["deposit_loan"]:
        add(_join_query(target or "청년", "임차보증금 대출 이자 지원"))
        add(_join_query(target or "청년", "전월세 보증금 지원"))
    if profile["rent"]:
        add(_join_query(target or "청년", "월세 지원"))
        add(_join_query(target or "청년", "주거비 지원"))
    if profile["housing"] and not target:
        add("주거취약계층 주거 지원")

    if profile["digital_education"]:
        add("디지털 역량 교육 지원")
        add("디지털배움터 교육 지원")
        add("디지털 문해 교육 지원")
        if profile["middle_aged"]:
            add("중장년 디지털 문해 평생교육 지원")
            add("평생교육이용권 문해교실")
            add("초등학력 인정 문해교실")
    if profile["education_device"]:
        add("교육정보화 디지털 기기 지원")
        add("저소득층 교육정보화 지원")
    if profile["tuition"]:
        add("대학생 등록금 학자금 지원")
        add("국가장학금 등록금 지원")
    if profile["graduate"]:
        add("대학원생 연구장학금 지원")
        add("연구장려금 대학원 지원")
    if profile["scholarship"]:
        add("대학생 장학금 지원")
        add("장학금 교육 지원")
    if profile["exam_school_out"]:
        add("학교 밖 청소년 교육지원")
        add("검정고시 준비 지원")
    if profile["lifelong"]:
        add("평생교육 바우처")
        add("평생교육 지원")
    if profile["online_night"]:
        add("직장인 재직자 온라인 야간 교육 지원")
        add("재직자 온라인 직업훈련 지원")
        add("근로자 온라인 직업훈련 지원")
        add("재직자 평생교육 지원")
        add("소상공인 온·오프라인 교육")
        add("K-디지털 트레이닝")
        add("일학습병행 학습기업 지원")
    if profile["vocational_training"]:
        add("국비 직업훈련 지원")
        add("국민내일배움카드 직업훈련")

    if profile["counseling_job"]:
        add("취업상담 이력서 자소서 컨설팅 지원")
    if profile["employment"]:
        add(_join_query(target or "구직자", "취업 구직 지원"))
    if profile["mental"] and profile["parenting"]:
        add("임산부 양육모 산후 우울 심리상담 지원")
        add("난임 유산 사산 임산부 심리상담")
        add("임산부 우울 선별검사 지원")
    if profile["mental"]:
        add("정신건강 심리상담 치료 지원")
    if profile["severe_disease"]:
        add("중증질환 치료비 의료비 지원")
    if profile["assistive_device"]:
        add(_join_query(target or "장애인", "보조기기 지원"))
    if profile["medical"]:
        add(_join_query(target, "의료 건강 지원"))
    if profile["living"]:
        add(_join_query(target or "저소득", "생활 안정 지원"))
    if profile["parenting"]:
        add("출산 육아 양육 보육 지원")
    if profile["finance"] and profile["farmer"]:
        add("농어업인 정책자금 경영자금 금융 지원")
        add("농수산식품 정책자금 종합지원")
        add("어업경영자금 지원")
        add("농어촌진흥기금 융자")
        add("농어가목돈마련저축")
    if profile["finance_education"]:
        add(_join_query(target or "서민", "금융교육 자산관리 지원"))
        add("서민금융진흥원 금융교육")
        add("청년 금융교육 자산관리")
        add("수급자 차상위계층 자산형성지원")
    if profile["finance"]:
        add(_join_query(target or "청년", "금융 자산형성 지원"))

    if profile["education_device"] or profile["digital_education"] or profile["tuition"] or profile["graduate"] or profile["scholarship"]:
        add("교육 지원")
    elif profile["vocational_training"]:
        add("교육 훈련 지원")

    return queries[:7]


def _fallback_candidate_penalty(query: str, candidate: dict) -> float:
    """Small penalty for fallback candidates that conflict with protected intent terms."""
    profile = _intent_profile(query)
    text = " ".join([
        str(candidate.get("policy_name", "")),
        str(candidate.get("category", "")),
        str(candidate.get("evidence_text", ""))[:500],
    ]).lower()

    penalty = 0.0
    if profile["elderly"] and "청년" in text and not _contains_any(text, _INTENT_GROUP_TERMS["elderly"]):
        penalty += 0.12
    if profile["disabled"] and "청년" in text and not _contains_any(text, _INTENT_GROUP_TERMS["disabled"]):
        penalty += 0.08
    if profile["youth"] and _contains_any(text, _INTENT_GROUP_TERMS["elderly"]) and "청년" not in text:
        penalty += 0.08
    if profile["education_device"] and _contains_any(text, ("직업훈련", "내일배움", "구직", "취업")) and not _contains_any(text, ("디지털 기기", "교육정보화", "정보화")):
        penalty += 0.12
    if (profile["tuition"] or profile["scholarship"] or profile["graduate"]) and _contains_any(text, ("직업훈련", "내일배움", "구직")) and not _contains_any(text, ("장학", "등록금", "학자금", "대학")):
        penalty += 0.12
    if profile["housing_repair"] and "월세" in text and not _contains_any(text, ("개보수", "수선", "집수리", "주거 안전", "편의")):
        penalty += 0.08
    if profile["farmer"] and profile["finance"] and _contains_any(text, ("수당", "직불금")) and not _contains_any(text, ("정책자금", "경영자금", "융자", "진흥기금", "저축")):
        penalty += 0.35
    if profile["finance_education"] and _contains_any(text, ("도약계좌", "저축계좌", "통장")) and not _contains_any(text, ("금융교육", "자산관리", "서민금융", "자산형성")):
        penalty += 0.12
    if profile["mental"] and profile["parenting"] and not _contains_any(text, ("산후", "산모", "임산부", "양육모", "난임", "유산", "사산", "우울")):
        penalty += 0.14
    if profile["middle_aged"] and profile["digital_education"] and _contains_any(text, ("교육정보화", "교육급여", "교육비")) and not _contains_any(text, ("중장년", "문해", "평생교육", "디지털")):
        penalty += 0.14
    if profile["online_night"] and _contains_any(text, ("취약계층 온라인", "방과후", "특수교육")) and not _contains_any(text, ("직장인", "소상공인", "온·오프라인", "온오프라인", "k-디지털", "K-디지털", "일학습병행")):
        penalty += 0.28
    return penalty


def _fallback_candidate_bonus(query: str, candidate: dict) -> float:
    """Boost candidates that match the remaining high-value intent patterns."""
    profile = _intent_profile(query)
    text = " ".join([
        str(candidate.get("policy_name", "")),
        str(candidate.get("category", "")),
        str(candidate.get("evidence_text", ""))[:500],
    ]).lower()

    bonus = 0.0
    if profile["farmer"] and profile["finance"]:
        if _contains_any(text, ("농수산식품 정책자금", "어업경영자금", "정책자금", "경영자금", "융자", "진흥기금", "농어가목돈마련저축")):
            bonus += 0.22
        if _contains_any(text, ("농어촌", "농어업", "농업인", "어업인", "농어가")) and _contains_any(text, ("자금", "금융", "융자", "저축")):
            bonus += 0.08

    if profile["online_night"]:
        if _contains_any(text, ("소상공인 온·오프라인 교육", "소상공인 온오프라인 교육", "k-디지털 트레이닝", "일학습병행", "학습기업")):
            bonus += 0.22
        if _contains_any(text, ("직장인", "온라인", "야간", "온·오프라인", "온오프라인")) and _contains_any(text, ("교육", "훈련", "학습")):
            bonus += 0.08

    return bonus


def _score_quality(results: list[dict]) -> float:
    if not results:
        return 0.0
    scores = [float(result.get("score", 0.0)) for result in results]
    return (sum(scores) / len(scores)) if scores else 0.0


_INTENT_KEYWORD_GROUPS: dict[str, tuple[str, ...]] = {
    "elderly": ("고령자", "노인", "어르신", "치매", "기초연금"),
    "disabled": ("장애", "장애인", "발달장애", "중증장애", "청각장애"),
    "youth": ("청년", "대학생", "사회초년생"),
    "low_income": ("저소득", "기초생활", "수급", "차상위", "긴급복지"),
    "middle_aged": ("중장년", "중년", "중장년층"),
    "farmer": ("농어업", "농업인", "어업인", "농어업인"),
    "housing_repair": ("개보수", "수선", "집수리", "주거 안전", "편의 개선", "주거편의"),
    "deposit_loan": ("보증금", "임차보증금", "전세대출", "전월세", "이자"),
    "digital_education": ("디지털", "디지털배움터", "문해", "정보화", "평생교육", "문해교실"),
    "education_device": ("디지털 기기", "교육정보화", "정보화", "보조공학기기"),
    "scholarship_tuition": ("장학", "장학금", "등록금", "학자금", "대학원", "연구장학"),
    "living": ("생계", "생활비", "난방비", "에너지", "바우처", "자활", "주거급여"),
    "mental": ("정신건강", "심리", "상담", "우울", "산후", "임산부", "양육모"),
    "finance": ("자산", "적금", "저축", "금융", "신용회복", "근로장려", "자녀장려", "정책자금", "경영자금", "금융교육", "자산관리"),
    "online_night": ("직장인", "야간", "온라인", "온·오프라인", "k-디지털", "K-디지털", "일학습병행"),
    "job_counseling": ("이력서", "자소서", "취업상담", "컨설팅"),
}


def _doc_text(results: list[dict], limit: int = 5) -> str:
    parts: list[str] = []
    for result in results[:limit]:
        parts.extend([
            str(result.get("policy_name", "")),
            str(result.get("category", "")),
            str(result.get("evidence_text", ""))[:500],
        ])
    return " ".join(parts).lower()


def _active_intent_keyword_groups(query: str) -> dict[str, tuple[str, ...]]:
    text = str(query or "").lower()
    active: dict[str, tuple[str, ...]] = {}
    for name, keywords in _INTENT_KEYWORD_GROUPS.items():
        if any(keyword in text for keyword in keywords):
            active[name] = keywords
    return active


def _intent_overlap_ratio(query: str, results: list[dict]) -> float:
    active_groups = _active_intent_keyword_groups(query)
    if not active_groups:
        return 1.0

    text = _doc_text(results)
    if not text:
        return 0.0

    matched = 0
    for keywords in active_groups.values():
        if any(keyword in text for keyword in keywords):
            matched += 1
    return matched / len(active_groups)


def _is_intent_preserved(query: str, results: list[dict], min_ratio: float = 0.60) -> bool:
    ratio = _intent_overlap_ratio(query, results)
    if ratio >= min_ratio:
        return True
    print(f"[CRAG guard] intent overlap too low: {ratio:.2f} < {min_ratio:.2f}")
    return False


def _adaptive_guard_thresholds(current_quality: float) -> tuple[float, float, str]:
    """Return quality margin, minimum intent overlap, and label by current retrieval quality."""
    if current_quality >= QUALITY_HIGH:
        return (
            float(os.getenv("BENEPICK_CRAG_HIGH_MARGIN", "0.12")),
            float(os.getenv("BENEPICK_CRAG_HIGH_MIN_INTENT_OVERLAP", "0.75")),
            "high",
        )
    if current_quality >= QUALITY_MEDIUM:
        return (
            float(os.getenv("BENEPICK_CRAG_MEDIUM_MARGIN", os.getenv("BENEPICK_CRAG_FALLBACK_MARGIN", "0.08"))),
            float(os.getenv("BENEPICK_CRAG_MEDIUM_MIN_INTENT_OVERLAP", os.getenv("BENEPICK_CRAG_MIN_INTENT_OVERLAP", "0.60"))),
            "medium",
        )
    return (
        float(os.getenv("BENEPICK_CRAG_LOW_MARGIN", "0.03")),
        float(os.getenv("BENEPICK_CRAG_LOW_MIN_INTENT_OVERLAP", "0.45")),
        "low",
    )


def _should_replace_with_fallback(
    query: str,
    current_results: list[dict],
    fallback_results: list[dict],
    current_quality: float,
    fallback_quality: float,
) -> bool:
    """Adaptive guard: stricter for decent results, looser when current retrieval is poor."""
    quality_margin, min_overlap, guard_level = _adaptive_guard_thresholds(current_quality)
    current_overlap = _intent_overlap_ratio(query, current_results)
    fallback_overlap = _intent_overlap_ratio(query, fallback_results)

    print(
        "[CRAG guard] "
        f"level={guard_level} margin={quality_margin:.2f} min_intent={min_overlap:.2f} "
        f"current_quality={current_quality:.3f} fallback_quality={fallback_quality:.3f} "
        f"current_intent={current_overlap:.2f} fallback_intent={fallback_overlap:.2f}"
    )

    if fallback_quality < current_quality + quality_margin:
        print("[CRAG guard] keep current: fallback quality gain is not large enough")
        return False
    if fallback_overlap < min_overlap:
        print("[CRAG guard] keep current: fallback does not preserve question intent")
        return False
    intent_drop_tolerance = 0.30 if guard_level == "low" else 0.15
    if fallback_overlap + intent_drop_tolerance < current_overlap:
        print("[CRAG guard] keep current: fallback loses more intent keywords than current results")
        return False
    print("[CRAG guard] use fallback: quality and intent checks passed")
    return True


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
                mismatch_penalty = _fallback_candidate_penalty(query, candidate)
                intent_bonus = _fallback_candidate_bonus(query, candidate)
                weighted_score = float(candidate.get("score", 0.0)) - (index * 0.02) - mismatch_penalty + intent_bonus
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


_LANGUAGE_INSTRUCTIONS = {
    "ko": "한국어로 답변하세요.",
    "en": "Please answer in English.",
    "ja": "日本語で回答してください。",
    "zh": "请用中文回答。",
    "vi": "Vui lòng trả lời bằng tiếng Việt.",
}

_ANSWER_HEADERS = {
    "ko": ["핵심 답변", "근거 정책", "신청/확인 방법", "확인 필요", "출처"],
    "en": ["Key Answer", "Supporting Policies", "How to Apply/Check", "Needs Confirmation", "Sources"],
    "ja": ["要点回答", "根拠となる政策", "申請・確認方法", "確認が必要", "出典"],
    "zh": ["核心回答", "依据政策", "申请/确认方法", "需要确认", "出处"],
    "vi": ["Câu trả lời chính", "Chính sách làm căn cứ", "Cách đăng ký/kiểm tra", "Cần xác nhận", "Nguồn"],
}

_FALLBACK_TEXT = {
    "ko": {
        "found": "'{query}'와 관련해 우선 확인할 정책 후보를 찾았습니다.",
        "no_policy": "관련 정책은 검색되었지만 정책명을 다시 확인할 필요가 있습니다.",
        "no_source": "공식 출처 링크를 확인하지 못했습니다.",
        "action_1": "각 정책의 공식 링크에서 지원 대상, 지원 내용, 신청 기간을 확인해 주세요.",
        "action_2": "거주 지역과 소득 구간이 문서 조건과 일치하는지 다시 확인해 주세요.",
        "need_1": "검색된 문서만으로는 최종 수급 여부를 확정할 수 없습니다.",
        "need_2": "정확한 금액, 기간, 추가 자격 조건은 공식 공고문 확인이 필요합니다.",
        "policy_check": "검색 결과 정책명을 다시 확인할 필요가 있습니다.",
        "action_default": "지원 대상, 신청 기간, 제출 서류를 공식 링크에서 다시 확인해 주세요.",
        "need_default": "문서에 없는 금액, 기간, 추가 자격 조건은 공식 공고문 확인이 필요합니다.",
    },
    "en": {
        "found": "I found policy candidates to check first for '{query}'.",
        "no_policy": "Related policies were retrieved, but the policy names need to be checked again.",
        "no_source": "No official source link was available.",
        "action_1": "Check each official link for eligibility, benefit details, and application dates.",
        "action_2": "Confirm that your region and income band match the policy conditions.",
        "need_1": "The retrieved documents alone cannot confirm final eligibility.",
        "need_2": "Exact amounts, dates, and additional conditions must be verified in the official notice.",
        "policy_check": "The retrieved policy names need to be checked again.",
        "action_default": "Check eligibility, application dates, and required documents through the official link.",
        "need_default": "Amounts, dates, and extra eligibility conditions not shown in the documents require official verification.",
    },
    "ja": {
        "found": "「{query}」に関連して、まず確認すべき政策候補を見つけました。",
        "no_policy": "関連政策は検索されましたが、政策名を再確認する必要があります。",
        "no_source": "公式出典リンクを確認できませんでした。",
        "action_1": "各政策の公式リンクで、対象者、支援内容、申請期間を確認してください。",
        "action_2": "居住地域と所得区分が文書の条件に合うか再確認してください。",
        "need_1": "検索された文書だけでは最終的な受給可否を確定できません。",
        "need_2": "正確な金額、期間、追加資格条件は公式公告で確認が必要です。",
        "policy_check": "検索結果の政策名を再確認する必要があります。",
        "action_default": "対象者、申請期間、提出書類を公式リンクで再確認してください。",
        "need_default": "文書にない金額、期間、追加資格条件は公式公告で確認が必要です。",
    },
    "zh": {
        "found": "已找到与“{query}”相关、需要优先确认的政策候选。",
        "no_policy": "已检索到相关政策，但需要再次确认政策名称。",
        "no_source": "未能确认官方来源链接。",
        "action_1": "请在各政策官方链接中确认支持对象、支持内容和申请期间。",
        "action_2": "请再次确认居住地区和收入区间是否符合文件条件。",
        "need_1": "仅凭检索到的文件无法确定最终受益资格。",
        "need_2": "准确金额、期间和追加资格条件需要查看官方公告。",
        "policy_check": "需要再次确认检索结果中的政策名称。",
        "action_default": "请通过官方链接再次确认支持对象、申请期间和所需材料。",
        "need_default": "文件中没有的金额、期间和追加资格条件需要官方确认。",
    },
    "vi": {
        "found": "Đã tìm thấy các chính sách nên kiểm tra trước liên quan đến '{query}'.",
        "no_policy": "Đã tìm thấy chính sách liên quan, nhưng cần kiểm tra lại tên chính sách.",
        "no_source": "Không xác nhận được liên kết nguồn chính thức.",
        "action_1": "Hãy kiểm tra đối tượng hỗ trợ, nội dung hỗ trợ và thời gian đăng ký tại liên kết chính thức.",
        "action_2": "Hãy xác nhận lại khu vực cư trú và nhóm thu nhập có khớp điều kiện trong tài liệu hay không.",
        "need_1": "Chỉ dựa trên tài liệu tìm được thì chưa thể xác nhận quyền lợi cuối cùng.",
        "need_2": "Số tiền, thời gian và điều kiện bổ sung chính xác cần được xác minh trong thông báo chính thức.",
        "policy_check": "Cần kiểm tra lại tên chính sách trong kết quả tìm kiếm.",
        "action_default": "Hãy kiểm tra lại đối tượng, thời gian đăng ký và giấy tờ cần nộp qua liên kết chính thức.",
        "need_default": "Số tiền, thời gian và điều kiện bổ sung không có trong tài liệu cần được xác minh chính thức.",
    },
}


def _normalize_lang_code(lang_code: str | None) -> str:
    normalized = str(lang_code or "ko").lower().strip()
    return normalized if normalized in _LANGUAGE_INSTRUCTIONS else "ko"


def _language_instruction(lang_code: str | None) -> str:
    return _LANGUAGE_INSTRUCTIONS[_normalize_lang_code(lang_code)]


def _answer_headers(lang_code: str | None) -> list[str]:
    return _ANSWER_HEADERS[_normalize_lang_code(lang_code)]


def _fallback_text(lang_code: str | None) -> dict[str, str]:
    return _FALLBACK_TEXT[_normalize_lang_code(lang_code)]


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


def _build_structured_answer_fallback_v2(query: str, docs: list[dict], lang_code: str = "ko") -> str:
    headers = _answer_headers(lang_code)
    fallback = _fallback_text(lang_code)
    top_docs = docs[:2]
    policy_names = [
        str(doc.get("policy_name", "")).strip()
        for doc in top_docs
        if str(doc.get("policy_name", "")).strip()
    ]
    policy_lines = [f"- {name}" for name in policy_names] or [
        f"- {fallback['no_policy']}"
    ]
    source_lines = _format_structured_sources_v2(docs)
    if not source_lines:
        source_lines = [f"- {fallback['no_source']}"]

    return "\n".join(
        [
            f"{headers[0]}:",
            f"- {fallback['found'].format(query=query)}",
            "",
            f"{headers[1]}:",
            *policy_lines,
            "",
            f"{headers[2]}:",
            f"- {fallback['action_1']}",
            f"- {fallback['action_2']}",
            "",
            f"{headers[3]}:",
            f"- {fallback['need_1']}",
            f"- {fallback['need_2']}",
            "",
            f"{headers[4]}:",
            *source_lines,
        ]
    )


def _normalize_structured_answer_v2(answer: str, query: str, docs: list[dict], lang_code: str = "ko") -> str:
    headers = _answer_headers(lang_code)
    fallback = _fallback_text(lang_code)
    normalized = str(answer or "").strip()
    required_headers = headers
    if not normalized:
        return _build_structured_answer_fallback_v2(query, docs, lang_code)

    if all(header in normalized for header in required_headers):
        return normalized

    body_lines = [line.strip("- ").strip() for line in re.split(r"[\r\n]+", normalized) if line.strip()]
    if not body_lines:
        return _build_structured_answer_fallback_v2(query, docs, lang_code)

    policy_lines = [
        f"- {str(doc.get('policy_name', '')).strip()}"
        for doc in docs[:2]
        if str(doc.get("policy_name", "")).strip()
    ] or [f"- {fallback['policy_check']}"]
    source_lines = _format_structured_sources_v2(docs)
    if not source_lines:
        source_lines = [f"- {fallback['no_source']}"]

    return "\n".join(
        [
            f"{headers[0]}:",
            f"- {body_lines[0]}",
            "",
            f"{headers[1]}:",
            *policy_lines,
            "",
            f"{headers[2]}:",
            f"- {body_lines[1] if len(body_lines) > 1 else fallback['action_default']}",
            "",
            f"{headers[3]}:",
            f"- {body_lines[2] if len(body_lines) > 2 else fallback['need_default']}",
            "",
            f"{headers[4]}:",
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


def _extract_structured_sections_v2_final(answer: str, lang_code: str = "ko") -> dict[str, list[str]]:
    headers = _answer_headers(lang_code)
    sections: dict[str, list[str]] = {header: [] for header in headers}
    current_header: str | None = None
    for raw_line in str(answer or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        matched_header = next(
            (header for header in headers if line == f"{header}:" or line == header),
            None,
        )
        if matched_header:
            current_header = matched_header
            continue
        if current_header:
            sections[current_header].append(line)
    return sections


def _render_structured_sections_v2_final(sections: dict[str, list[str]], lang_code: str = "ko") -> str:
    headers = _answer_headers(lang_code)
    rendered: list[str] = []
    for header in headers:
        rendered.append(f"{header}:")
        rendered.extend(sections.get(header) or ["- 내용 확인 필요"])
        rendered.append("")
    return "\n".join(rendered).strip()


def apply_confidence_fallback(
    answer: str,
    confidence_meta: dict | None,
    docs: list | None = None,
    lang_code: str = "ko",
) -> str:
    """
    Final confidence-aware renderer.
    This definition intentionally overrides earlier fallback helpers.
    """
    if not confidence_meta:
        return answer

    level = str(confidence_meta.get("level", "medium"))
    if level == "high":
        return answer

    candidates = confidence_meta.get("candidate_policy_names") or []
    reason = str(confidence_meta.get("reason", "") or "").strip()
    headers = _answer_headers(lang_code)
    sections = _extract_structured_sections_v2_final(answer, lang_code)

    if str(lang_code).lower() == "en":
        summary_line = (
            "- An exact single-policy answer would be unsafe, so the closest policy candidates are shown first."
            if level == "low"
            else "- The leading result is useful, but eligibility or detail conditions may change the best match."
        )
        reason_line = (
            f"- Why these candidates: {reason}"
            if reason
            else "- Why these candidates: the top search results were relevant but not decisive enough for a single exact match."
        )
    else:
        summary_line = (
            "- 정확한 단일 정책으로 단정하기 어려워, 우선 확인할 후보 정책 중심으로 안내합니다."
            if level == "low"
            else "- 선두 결과는 유력하지만, 세부 자격이나 조건에 따라 최적 정책이 달라질 수 있습니다."
        )
        reason_line = (
            f"- 왜 이 후보를 보여주는지: {reason}"
            if reason
            else "- 왜 이 후보를 보여주는지: 상위 검색 결과는 관련성이 있었지만 하나의 정확한 정책으로 단정할 만큼 충분히 강하지 않았습니다."
        )

    sections[headers[0]] = [summary_line]
    sections[headers[1]] = [f"- {name}" for name in candidates[:3]] or sections.get(headers[1]) or ["- 정책 후보 확인 필요"]

    confirm_lines = sections.get(headers[3]) or []
    merged_confirm_lines = [reason_line]
    for line in confirm_lines:
        if line not in merged_confirm_lines:
            merged_confirm_lines.append(line)
    sections[headers[3]] = merged_confirm_lines[:3]

    if docs:
        source_lines = _format_structured_sources_v2(list(docs), limit=3)
        if source_lines:
            sections[headers[4]] = source_lines

    return _clip_answer_text(_render_structured_sections_v2_final(sections, lang_code), max_chars=1200)


def generate_answer(
    query: str,
    docs: list,
    lang_code: str = "ko",
    prompt_variant: str = DEFAULT_PROMPT_VARIANT,
    confidence_meta: dict | None = None,
) -> str:
    """
    Final answer generator with confidence-aware fallback messaging.
    This definition intentionally overrides earlier generate_answer versions.
    """
    lang_code = _normalize_lang_code(lang_code)
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

    lang_prompt = _language_instruction(lang_code)
    confidence_guidance = _build_confidence_guidance(confidence_meta)
    human_content = f"질문: {query}\n\n참고 문서:\n{context}"
    if confidence_guidance:
        human_content += f"\n\n답변 가이드:\n{confidence_guidance}"
    human_content += "\n\n답변:"

    messages = [
        SystemMessage(
            content=_build_answer_system_prompt_v2(lang_prompt, prompt_variant)
        ),
        HumanMessage(content=human_content),
    ]

    response = llm.invoke(messages)
    answer = _clip_answer_text(getattr(response, "content", response), max_chars=1200)
    answer = _normalize_structured_answer_v2(answer, query, grounded_docs, lang_code)
    answer = apply_confidence_fallback(answer, confidence_meta, grounded_docs, lang_code)
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


def extract_query_plan_fields(query: str) -> dict:
    text = re.sub(r"\s+", " ", str(query or "")).strip()
    lowered = text.lower()

    target_rules = [
        ("청년", ["청년", "청소년", "대학생", "대학원생"]),
        ("직장인", ["직장인", "재직자", "근로자", "회사원"]),
        ("장애인", ["장애인", "발달장애", "시각장애", "청각장애", "지체장애"]),
        ("고령자", ["고령자", "어르신", "노인", "시니어"]),
        ("저소득층", ["저소득", "기초생활수급", "수급자", "차상위", "중위소득"]),
        ("소상공인", ["소상공인", "자영업자", "창업", "가게", "사업자"]),
        ("임산부·육아", ["임산부", "출산", "육아", "양육", "보육", "영유아", "한부모"]),
        ("농어업인", ["농어업", "농업인", "어업인", "농업", "어업", "귀농", "귀어"]),
    ]
    support_rules = [
        ("주거", ["주거", "월세", "전세", "보증금", "임대", "주택", "자취"]),
        ("교육/훈련", ["교육", "훈련", "장학", "장학금", "온라인", "야간", "배움", "평생교육"]),
        ("취업", ["취업", "구직", "채용", "일자리", "이력서", "자소서", "재취업"]),
        ("의료", ["의료", "병원", "진료", "치과", "건강검진", "수술", "치료"]),
        ("금융/자산형성", ["금융", "대출", "이자", "자산", "저축", "통장", "목돈", "근로장려금"]),
        ("돌봄/육아", ["돌봄", "육아", "양육", "보육", "아이돌봄", "아동수당"]),
        ("생활지원", ["생계", "생활비", "난방비", "바우처", "긴급복지", "자활"]),
    ]
    intent_rules = [
        ("신청 방법", ["신청", "접수", "어떻게", "방법", "절차", "온라인 신청"]),
        ("자격 조건", ["자격", "조건", "대상", "가능한지", "받을 수", "해당"]),
        ("필요 서류", ["서류", "준비물", "증빙", "제출"]),
        ("추천/비교", ["추천", "비교", "어떤 정책", "뭐가 있", "알려줘", "궁금"]),
        ("금액/기간 확인", ["얼마", "금액", "지원액", "기간", "언제까지", "몇 개월"]),
    ]
    modifier_keywords = [
        "월세", "전세", "보증금", "온라인", "야간", "주간", "대출", "장학금",
        "창업", "재취업", "자립", "돌봄", "보육", "양육", "생활비", "의료비",
    ]

    def _first_match(rules: list[tuple[str, list[str]]]) -> str | None:
        for label, keywords in rules:
            if any(keyword.lower() in lowered for keyword in keywords):
                return label
        return None

    policy_target = _first_match(target_rules)
    support_type = _first_match(support_rules)
    intent = _first_match(intent_rules) or "일반 문의"
    modifiers = [keyword for keyword in modifier_keywords if keyword.lower() in lowered]
    modifiers = list(dict.fromkeys(modifiers))
    specific_question = intent in {"신청 방법", "자격 조건", "필요 서류", "금액/기간 확인"}

    return {
        "intent": intent,
        "policy_target": policy_target,
        "support_type": support_type,
        "modifiers": modifiers,
        "specific_question": specific_question,
    }


_extract_query_plan_fields_rule = extract_query_plan_fields
_PLANNER_ALLOWED_INTENTS = {"일반 문의", "자격 조건", "신청 방법", "필요 서류", "추천/비교", "금액/기간 확인"}
_PLANNER_ALLOWED_TARGETS = {"청년", "직장인", "재직자", "장애인", "고령자", "저소득층", "소상공인", "임산부/육아", "농어업인"}
_PLANNER_ALLOWED_SUPPORT_TYPES = {"주거", "교육/훈련", "취업", "의료", "금융/자산형성", "돌봄/육아", "생활지원"}
_PLANNER_ALLOWED_MODIFIERS = {
    "대출", "보증", "이자", "월세", "전세사기", "보조기기", "야간", "온라인",
    "전세", "교육", "훈련", "직업훈련",
}
_PLANNER_BROAD_SUPPORT_TYPES = {"교육/훈련", "금융/자산형성"}
_PLANNER_PRIORITY_TARGETS = {"직장인", "재직자", "소상공인"}


def _should_use_gemma_query_planner(query: str, plan_fields: dict) -> bool:
    del query
    if os.getenv("ENABLE_GEMMA_QUERY_PLANNER", "0") != "1":
        return False
    if os.getenv("GEMMA_QUERY_PLANNER_AMBIGUOUS_ONLY", "1") != "1":
        return True
    if plan_fields.get("specific_question"):
        return False
    support_type = plan_fields.get("support_type")
    if support_type not in _PLANNER_BROAD_SUPPORT_TYPES:
        return False
    modifiers = plan_fields.get("modifiers") or []
    policy_target = plan_fields.get("policy_target")
    return len(modifiers) >= 2 or policy_target in _PLANNER_PRIORITY_TARGETS


def _normalize_gemma_plan_fields(plan: dict, query: str, fallback_plan_fields: dict) -> dict:
    if not isinstance(plan, dict):
        return fallback_plan_fields

    intent = plan.get("intent")
    if intent not in _PLANNER_ALLOWED_INTENTS:
        intent = fallback_plan_fields.get("intent")

    policy_target = plan.get("policy_target")
    if policy_target not in _PLANNER_ALLOWED_TARGETS:
        policy_target = fallback_plan_fields.get("policy_target")

    support_type = plan.get("support_type")
    if support_type not in _PLANNER_ALLOWED_SUPPORT_TYPES:
        support_type = fallback_plan_fields.get("support_type")

    query_modifiers = [keyword for keyword in _PLANNER_ALLOWED_MODIFIERS if keyword in query]
    raw_modifiers = plan.get("modifiers") if isinstance(plan.get("modifiers"), list) else []
    modifiers = []
    for modifier in raw_modifiers:
        if isinstance(modifier, str) and modifier in query_modifiers and modifier not in modifiers:
            modifiers.append(modifier)
    if not modifiers:
        modifiers = list(fallback_plan_fields.get("modifiers") or [])

    specific_question = plan.get("specific_question")
    if not isinstance(specific_question, bool):
        specific_question = bool(fallback_plan_fields.get("specific_question"))

    return {
        "intent": intent,
        "policy_target": policy_target,
        "support_type": support_type,
        "modifiers": modifiers,
        "specific_question": specific_question,
    }


def _extract_query_plan_fields_with_gemma(query: str, fallback_plan_fields: dict) -> dict:
    planner_llm = llm
    planner_label = llm_label
    if "Ollama" not in planner_label:
        planner_llm, planner_label = _init_ollama_llm()

    planner_prompt = """
You are a query planner for a Korean welfare policy retrieval system.
Return JSON only.

Schema:
{
  "intent": "일반 문의|자격 조건|신청 방법|필요 서류|추천/비교|금액/기간 확인",
  "policy_target": "청년|직장인|재직자|장애인|고령자|저소득층|소상공인|임산부/육아|농어업인|null",
  "support_type": "주거|교육/훈련|취업|의료|금융/자산형성|돌봄/육아|생활지원|null",
  "modifiers": ["query keywords only"],
  "specific_question": true
}

Rules:
- Do not answer the question.
- Do not invent keywords not present in the original query.
- Be conservative. If uncertain, use null or an empty list.
- Keep modifiers only if they literally appear in the user query.
""".strip()

    response = planner_llm.invoke([
        SystemMessage(content=planner_prompt),
        HumanMessage(content=f"User query: {query}"),
    ])
    content = getattr(response, "content", response)
    if isinstance(content, list):
        content = "".join(str(part) for part in content)
    content = str(content).strip()
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError("Gemma planner did not return JSON")
    parsed = json.loads(match.group(0))
    normalized = _normalize_gemma_plan_fields(parsed, query, fallback_plan_fields)
    print(f"[AgenticRAG] gemma_planner={normalized}")
    return normalized


def extract_query_plan_fields(query: str) -> dict:
    rule_plan_fields = _extract_query_plan_fields_rule(query)
    if not _should_use_gemma_query_planner(query, rule_plan_fields):
        return rule_plan_fields
    try:
        return _extract_query_plan_fields_with_gemma(query, rule_plan_fields)
    except Exception as exc:
        print(f"[AgenticRAG] gemma planner fallback: {exc}")
        return rule_plan_fields


def select_retrieval_strategy(query: str, plan_fields: dict, user_condition: dict | None = None) -> dict:
    del query, user_condition
    specific_question = bool(plan_fields.get("specific_question"))
    has_refinement_anchor = bool(plan_fields.get("policy_target")) and bool(plan_fields.get("support_type"))

    if specific_question:
        return {
            "mode": "specific_bm25_priority",
            "alpha": min(RETRIEVAL_ALPHA, 0.35),
            "allow_refine": False,
        }

    return {
        "mode": "general_hybrid",
        "alpha": RETRIEVAL_ALPHA,
        "allow_refine": has_refinement_anchor,
    }


def build_refined_query(query: str, plan_fields: dict, user_condition: dict | None = None) -> str:
    user_condition = user_condition or {}
    if plan_fields.get("specific_question"):
        return build_search_query(query, user_condition)

    parts = []
    policy_target = plan_fields.get("policy_target")
    support_type = plan_fields.get("support_type")
    if policy_target:
        parts.append(str(policy_target))
    for modifier in plan_fields.get("modifiers") or []:
        if modifier not in parts:
            parts.append(str(modifier))
    if support_type:
        parts.append(str(support_type))
    parts.append("지원")

    refined = " ".join(part for part in parts if part).strip()
    if not refined:
        refined = relax_query(query)
    refined = re.sub(r"\s+", " ", refined).strip()
    return refined or build_search_query(query, user_condition)


def build_refined_query(query: str, plan_fields: dict, user_condition: dict | None = None) -> str:
    user_condition = user_condition or {}
    if plan_fields.get("specific_question"):
        return build_search_query(query, user_condition)

    search_query = build_search_query(query, user_condition)
    policy_target = plan_fields.get("policy_target")
    support_type = plan_fields.get("support_type")
    modifiers = list(plan_fields.get("modifiers") or [])
    concrete_keywords = [
        keyword
        for keyword in [
            "대출",
            "보증",
            "이자",
            "월세",
            "전세사기",
            "보조기기",
            "야간",
            "온라인",
        ]
        if keyword in query and keyword not in modifiers
    ]

    support_term = support_type
    if support_type == "금융/자산형성":
        support_term = None
    elif support_type == "교육/훈련":
        if "직장인" in str(policy_target) or "재직자" in str(policy_target):
            support_term = "직업훈련"
        elif "훈련" in query:
            support_term = "훈련"
        else:
            support_term = None

    parts = []
    if policy_target:
        parts.append(str(policy_target))
    for modifier in modifiers:
        if modifier not in parts:
            parts.append(str(modifier))
    for keyword in concrete_keywords:
        if keyword not in parts:
            parts.append(keyword)
    if support_term and support_term not in parts:
        parts.append(str(support_term))
    if "지원" not in parts:
        parts.append("지원")

    refined = re.sub(r"\s+", " ", " ".join(part for part in parts if part)).strip()
    if support_type in {"금융/자산형성", "교육/훈련"} and not concrete_keywords and not modifiers:
        return search_query
    return refined or search_query


def _retrieve_rag_documents_legacy(user_query: str, user_condition: dict | None = None) -> dict:
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


def retrieve_rag_documents(user_query: str, user_condition: dict | None = None) -> dict:
    user_condition = user_condition or {}
    pipeline_started_at = time.perf_counter()

    plan_fields = extract_query_plan_fields(user_query)
    strategy = select_retrieval_strategy(user_query, plan_fields, user_condition)
    print(f"[AgenticRAG] plan_fields={plan_fields}")
    print(f"[AgenticRAG] selected_strategy={strategy}")

    search_query = build_search_query(user_query, user_condition)
    total_search_time_ms = 0
    total_rerank_time_ms = 0

    search_started_at = time.perf_counter()
    results = get_searcher().search(
        search_query,
        top_k=RETRIEVAL_TOP_K,
        alpha=strategy.get("alpha", RETRIEVAL_ALPHA),
        user_region=user_condition.get("region", ""),
    )
    total_search_time_ms += _elapsed_ms(search_started_at)
    if not results:
        return error_response("SEARCH_FAILED", "검색 결과가 없습니다.")
    print(f"[검색] {len(results)}개 후보 검색 완료 ({total_search_time_ms}ms)")

    rerank_started_at = time.perf_counter()
    try:
        reranked = rerank(user_query, results, top_k=5)
        print(f"[Rerank] {len(reranked)}개로 압축")
    except Exception as e:
        print(f"[Rerank 실패] {e} -> 상위 5개 사용")
        reranked = results[:5]
    total_rerank_time_ms += _elapsed_ms(rerank_started_at)
    print(f"[Timing] rerank={total_rerank_time_ms}ms")

    selected_reranked = reranked
    base_confidence = assess_answer_confidence(user_query, reranked)

    if base_confidence.get("level") != "high" and strategy.get("allow_refine"):
        refined_query = build_refined_query(user_query, plan_fields, user_condition)
        print(f"[AgenticRAG] refined_query={refined_query}")

        if refined_query and refined_query != search_query:
            try:
                refined_search_started_at = time.perf_counter()
                refined_results = get_searcher().search(
                    refined_query,
                    top_k=RETRIEVAL_TOP_K,
                    alpha=strategy.get("alpha", RETRIEVAL_ALPHA),
                    user_region=user_condition.get("region", ""),
                )
                total_search_time_ms += _elapsed_ms(refined_search_started_at)

                if refined_results:
                    refined_rerank_started_at = time.perf_counter()
                    try:
                        refined_reranked = rerank(user_query, refined_results, top_k=5)
                    except Exception as e:
                        print(f"[Rerank 실패] refined {e} -> 상위 5개 사용")
                        refined_reranked = refined_results[:5]
                    total_rerank_time_ms += _elapsed_ms(refined_rerank_started_at)

                    refined_confidence = assess_answer_confidence(user_query, refined_reranked)
                    print(
                        "[AgenticRAG] confidence_compare "
                        f"base={base_confidence.get('confidence_score')}({base_confidence.get('level')}) "
                        f"refined={refined_confidence.get('confidence_score')}({refined_confidence.get('level')})"
                    )
                    if refined_confidence.get("confidence_score", 0.0) > base_confidence.get("confidence_score", 0.0):
                        selected_reranked = refined_reranked
                        base_confidence = refined_confidence
                else:
                    print("[AgenticRAG] refined search returned no results -> keep original")
            except Exception as e:
                print(f"[AgenticRAG] refined search failed: {e} -> keep original")
        else:
            print("[AgenticRAG] refined query not meaningful -> keep original")

    crag_started_at = time.perf_counter()
    try:
        final_docs = crag_quality_check(user_query, selected_reranked)
    except Exception as e:
        print(f"[CRAG failed] {e} -> keep reranked docs")
        final_docs = selected_reranked
    crag_time_ms = _elapsed_ms(crag_started_at)
    print(f"[Timing] crag={crag_time_ms}ms")
    print(f"[CRAG] 최종 {len(final_docs)}개 문서 확정")

    return success_response({
        "query": user_query,
        "user_condition": user_condition,
        "search_time_ms": total_search_time_ms,
        "rerank_time_ms": total_rerank_time_ms,
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
        confidence_meta = assess_answer_confidence(user_query, final_docs)

        answer_started_at = time.perf_counter()
        answer = generate_answer(
            user_query,
            final_docs,
            lang_code,
            confidence_meta=confidence_meta,
        )
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
            "confidence_level": confidence_meta.get("level"),
            "confidence_score": confidence_meta.get("confidence_score"),
            "confidence_reason": confidence_meta.get("reason"),
            "needs_confirmation": confidence_meta.get("needs_confirmation"),
            "top_policy_candidates": confidence_meta.get("candidate_policy_names"),
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
