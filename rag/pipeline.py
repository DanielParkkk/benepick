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

load_dotenv()

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
ENABLE_RERANKER = os.getenv("BENEPICK_ENABLE_RERANKER", "0" if os.name == "nt" else "1") == "1"
FORCE_BM25_FALLBACK = os.getenv("BENEPICK_FORCE_BM25_FALLBACK", "0") == "1"

# ── CUDA 사용 가능 여부 ──
import torch as _torch
_USE_CUDA = _torch.cuda.is_available()


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
                try:
                    _searcher = HybridSearcher(device="cuda" if _USE_CUDA else "cpu")
                    _searcher_mode = "hybrid_dense"
                except Exception as exc:
                    print(f"[Searcher] Hybrid init failed: {exc}")
                    print("[Searcher] Switching to BM25 fallback mode.")
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

    texts = [r['evidence_text'] for r in results]
    pairs = [[query, text] for text in texts]
    scores = reranker.compute_score(pairs, normalize=True)

    # score 업데이트 (팀 규칙: float 0~1)
    for result, score in zip(results, scores):
        result['score'] = round(float(score), 4)

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
            results2 = get_searcher().search(relaxed, top_k=25, alpha=0.6)
            if not results2:
                return _fallback(query)
            return rerank(query, results2, top_k=5)
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

    rules = [
        (("월세", "전세", "주거", "주택", "임대", "임차", "보증금", "무주택"), "청년 주거 지원"),
        (("취업", "구직", "실업", "실직", "면접", "청년수당", "고용", "국민취업", "훈련", "내일배움"), "청년 고용 지원"),
        (("창업", "예비창업", "사업화", "소상공인", "자영업", "정책자금"), "창업·소상공인 지원"),
        (("자산", "적금", "저축", "금융", "도약계좌", "희망적금"), "청년 자산형성 지원"),
        (("생계", "수급", "긴급복지", "기초생활"), "저소득 생활 지원"),
        (("의료", "병원", "치료", "건강", "심리"), "의료·건강 지원"),
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


def _fallback(query: str) -> list:
    """Fallback retrieval by category + rerank with original question."""
    fallback_query = get_category_query(query)
    print(f"[CRAG] 폴백 쿼리: '{fallback_query}'")
    try:
        candidates = get_searcher().search(fallback_query, top_k=25, alpha=0.6)
        if not candidates:
            return []
        return rerank(query, candidates, top_k=5)
    except Exception as e:
        print(f"[CRAG fallback failed] {e}")
        return []


# ── LLM 답변 생성 ──
def generate_answer(query: str, docs: list, lang_code: str = "ko") -> str:
    """
    검색된 문서 기반 최종 답변 생성
    lang_code: "ko"/"en"/"vi"/"zh" (팀 규칙 — ISO 639-1)
    """
    context = "\n\n".join([
        f"[{i+1}] {d['policy_name']}\n{d['evidence_text']}"
        for i, d in enumerate(docs)
    ])

    lang_prompt = {
        "ko": "한국어로 답변하세요.",
        "en": "Please answer in English.",
        "vi": "Vui lòng trả lời bằng tiếng Việt.",
        "zh": "请用中文回答。",
    }.get(lang_code, "한국어로 답변하세요.")

    messages = [
        SystemMessage(content=f"""당신은 한국 복지 정책 전문 AI입니다.
사용자 질문에 직접 답한 뒤, 관련 정책을 안내하세요.

답변 순서:
1. 핵심 답변: 질문에 바로 답하세요 (예: "네, 받을 수 있습니다" / "해당 지원은 ~입니다")
2. 관련 정책: 정책명과 지원 대상·내용을 2~3줄로 간결히
3. 신청 방법: 신청처 한 줄

규칙:
- 첫 문장은 반드시 질문의 핵심에 직접 답할 것
- 질문과 관련 없는 정책은 언급하지 말 것
- 문서에 없는 내용은 절대 추측하지 말 것
- {lang_prompt}"""),
        HumanMessage(content=f"질문: {query}\n\n참고 문서:\n{context}\n\n답변:")
    ]

    response = llm.invoke(messages)
    return response.content


def build_search_query(query: str, user_condition: dict) -> str:
    """Build an enriched retrieval query from user profile + preference tags."""
    if not user_condition:
        return query

    parts = [query]
    if user_condition.get("region"):
        parts.append(str(user_condition["region"]))
    if user_condition.get("age"):
        parts.append(f"age {user_condition['age']}")
    if user_condition.get("income_level"):
        parts.append(str(user_condition["income_level"]))
    if user_condition.get("income_band"):
        parts.append(str(user_condition["income_band"]))
    if user_condition.get("household_type"):
        parts.append(str(user_condition["household_type"]))
    if user_condition.get("employment_status"):
        parts.append(str(user_condition["employment_status"]))
    if user_condition.get("interest_tags"):
        tags = [str(tag).strip() for tag in user_condition["interest_tags"] if str(tag).strip()]
        if tags:
            parts.append("interest_tags " + " ".join(tags))

    enriched = " ".join(parts)
    print(f"[Query enrich] '{query}' -> '{enriched}'")
    return enriched


def retrieve_rag_documents(user_query: str, user_condition: dict | None = None) -> dict:
    user_condition = user_condition or {}
    pipeline_started_at = time.perf_counter()

    search_query = build_search_query(user_query, user_condition)

    search_started_at = time.perf_counter()
    results = get_searcher().search(
        search_query,
        top_k=25,
        alpha=0.6,
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
