import pandas as pd
import numpy as np
import chromadb
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "benepick_policies"
MODEL_NAME = "BAAI/bge-m3"


class HybridSearcher:
    def __init__(self, device="cuda"):
        print("하이브리드 검색기 초기화 중...")

        # Chroma DB 연결
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.collection = client.get_collection(COLLECTION_NAME)

        # 청크 데이터 로드 (복지로 + 정부24 합치기)
        df_welfare = pd.read_csv("data/processed/chunks.csv")
        df_gov24 = pd.read_csv("data/processed/gov24/chunks.csv")
        self.df_chunks = pd.concat([df_welfare, df_gov24], ignore_index=True)
        print(f"전체 청크 로드: {len(self.df_chunks)}개")

        # BGE-M3 모델 로드
        print("BGE-M3 모델 로딩 중...")
        self.model = SentenceTransformer(MODEL_NAME, device=device)

        # BM25 초기화 (한국어 공백 기준 토크나이징)
        print("BM25 인덱스 생성 중...")
        tokenized = [text.split() for text in self.df_chunks["text"].tolist()]
        self.bm25 = BM25Okapi(tokenized)
        self.texts = self.df_chunks["text"].tolist()

        print("초기화 완료!\n")

    def vector_search(self, query, top_k=10):
        """벡터 유사도 검색"""
        query_embedding = self.model.encode(
            [query],
            normalize_embeddings=True
        ).tolist()

        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=top_k
        )

        # chunk_id → 점수 딕셔너리
        vector_scores = {}
        for i, chunk_id in enumerate(results["ids"][0]):
            # 거리를 유사도로 변환 (1 - 거리)
            score = 1 - results["distances"][0][i]
            vector_scores[chunk_id] = score

        return vector_scores

    def bm25_search(self, query, top_k=10):
        """BM25 키워드 검색"""
        tokenized_query = query.split()
        scores = self.bm25.get_scores(tokenized_query)

        # 정규화 (0~1 사이)
        max_score = max(scores) + 1e-9
        normalized = scores / max_score

        # chunk_id → 점수 딕셔너리
        bm25_scores = {}
        chunk_ids = self.df_chunks["chunk_id"].tolist()
        for i, chunk_id in enumerate(chunk_ids):
            bm25_scores[chunk_id] = float(normalized[i])

        return bm25_scores

    def search(self, query, top_k=5, alpha=0.6):
        """
        하이브리드 검색
        alpha: 벡터 검색 비중 (0~1)
        alpha=0.6 → 벡터 60% + BM25 40%
        """
        # 1. 벡터 검색
        vector_scores = self.vector_search(query, top_k=10)

        # 2. BM25 검색
        bm25_scores = self.bm25_search(query, top_k=10)

        # 3. 점수 합산
        all_ids = set(vector_scores.keys()) | set(bm25_scores.keys())
        final_scores = {}
        for chunk_id in all_ids:
            v_score = vector_scores.get(chunk_id, 0)
            b_score = bm25_scores.get(chunk_id, 0)
            final_scores[chunk_id] = alpha * v_score + (1 - alpha) * b_score

        # 4. Top-K 추출
        top_ids = sorted(
            final_scores,
            key=final_scores.get,
            reverse=True
        )[:top_k]

        # 5. 결과 조합
        results = []
        for rank, chunk_id in enumerate(top_ids, 1):
            row = self.df_chunks[
                self.df_chunks["chunk_id"] == chunk_id
            ].iloc[0]

            results.append({
                "rank":         rank,
                "chunk_id":     chunk_id,
                "policy_id":    row["policy_id"],
                "policy_name":  row["policy_name"],
                "category":     row["category"],
                "region":       row["region"],
                "source_url":   row["source_url"],
                "score":        round(final_scores[chunk_id], 4),
                "vector_score": round(vector_scores.get(chunk_id, 0), 4),
                "bm25_score":   round(bm25_scores.get(chunk_id, 0), 4),
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

    # 테스트 검색
    queries = [
        "서울 청년 월세 지원",
        "취업 준비생 훈련비 지원",
        "외국인 다문화 가정 복지",
        "소상공인 자금 지원",
        "노인 돌봄 서비스",
    ]

    for query in queries:
        results = searcher.search(query, top_k=3, alpha=0.6)
        print_results(results, query)

    print("\n\n하이브리드 검색 완료!")
    print("다음 단계: RAG 파이프라인 연결 (pipeline.py)")