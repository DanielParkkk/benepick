import pandas as pd
import numpy as np
import chromadb
import os
from pathlib import Path
from rank_bm25 import BM25Okapi
from kiwipiepy import Kiwi

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_PATH = PROJECT_ROOT / "processed"
CACHE_ROOT = PROJECT_ROOT / ".cache" / "huggingface"
os.environ.setdefault("HF_HOME", str(CACHE_ROOT))
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(CACHE_ROOT / "sentence-transformers"))

from sentence_transformers import SentenceTransformer

CHROMA_PATH = PROJECT_ROOT / "chroma_db"
COLLECTION_NAME = "benepick_policies"
MODEL_NAME = "BAAI/bge-m3"

# KIWI_MODEL_PATH: 한글 경로에서 C 확장이 모델을 못 여는 문제 우회 (Windows 로컬 전용)
# Railway/Linux 등 배포 환경에서는 환경변수 미설정 → kiwipiepy 기본 경로 자동 사용
_kiwi_model_path = os.environ.get("KIWI_MODEL_PATH") or None
_kiwi = Kiwi(model_path=_kiwi_model_path, num_workers=-1)

# BM25 대상 품사: 일반명사(NNG) + 고유명사(NNP) + 어근(XR) + 외국어(SL)
# NNB(의존명사)·NR(수사)·NP(대명사) 제외 이유:
#   NNB → "것", "수", "데", "뿐" 등 문법적 의존명사 — 검색 변별력 없음
#   NR  → "하나", "둘" 등 수사 — 복지 검색 맥락에서 의미 없음
#   NP  → "나", "우리" 등 대명사 — 불필요
_VALID_TAGS = {"NNG", "NNP", "XR", "SL"}


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


class HybridSearcher:
    def __init__(self, device="cuda"):
        print("하이브리드 검색기 초기화 중...")

        # ChromaDB 로컬 클라이언트 (chroma_db/ 디렉토리 직접 사용, 별도 서버 불필요)
        client = chromadb.PersistentClient(path=str(CHROMA_PATH))
        self.collection = client.get_collection(COLLECTION_NAME)

        # 정책 데이터 로드 (복지로 + 정부24)
        df_welfare = pd.read_csv(PROCESSED_PATH / "chunks.csv")
        df_gov24   = pd.read_csv(PROCESSED_PATH / "gov24" / "chunks.csv")
        self.df_chunks = pd.concat([df_welfare, df_gov24], ignore_index=True)

        # chunk_id 인덱싱 → O(1) 조회
        self.df_chunks = self.df_chunks.set_index("chunk_id", drop=False)
        self.chunk_ids = self.df_chunks["chunk_id"].tolist()
        print(f"전체 정책 로드: {len(self.df_chunks)}개")

        # BGE-M3 모델 로드
        print("BGE-M3 모델 로딩 중...")
        self.model = SentenceTransformer(MODEL_NAME, device=device)

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

    def vector_search(self, query: str, top_k: int = 10) -> dict:
        """벡터 유사도 검색"""
        query_embedding = self.model.encode(
            [query],
            normalize_embeddings=True
        ).tolist()

        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=top_k
        )

        # chunk_id → 점수 딕셔너리 (거리 → 유사도)
        return {
            chunk_id: 1 - dist
            for chunk_id, dist in zip(results["ids"][0], results["distances"][0])
        }

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

        # 2-1. 지역 보정: 사용자 지역 또는 전국 정책에 +0.15 보정
        if user_region:
            region_short = user_region[:2]  # "서울특별시" → "서울"
            for cid in final_scores:
                row_region = str(self.df_chunks.loc[cid, "region"]) if cid in self.df_chunks.index else ""
                if "전국" in row_region or region_short in row_region:
                    final_scores[cid] += 0.15

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
