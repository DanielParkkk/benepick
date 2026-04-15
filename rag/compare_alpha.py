"""
alpha 값 비교 실험 (compare_alpha.py)
──────────────────────────────────────
BM25:Dense 비율(alpha)별 검색 품질 비교
alpha=0.0 → BM25 100% / alpha=1.0 → Dense 100%

실행: python compare_alpha.py
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
from pipeline import get_searcher, get_reranker, rerank, crag_quality_check

TEST_QUERIES = [
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

ALPHA_VALUES = [0.3, 0.5, 0.6, 0.7, 0.9]  # 0.6은 현재 기준값


def main():
    results_data = []

    for alpha in ALPHA_VALUES:
        print(f"\n{'='*60}")
        print(f"[alpha = {alpha}] 실험")
        print(f"{'='*60}")

        alpha_qualities = []

        for query, lang in TEST_QUERIES:
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
                "alpha":    alpha,
                "질문":     query,
                "품질 점수": quality,
                "사용된 정책": ", ".join([d["policy_name"] for d in final_docs]),
            })

        avg = round(sum(alpha_qualities) / len(alpha_qualities), 3)
        print(f"\n▶ alpha={alpha} 평균 품질: {avg:.3f}")

    df = pd.DataFrame(results_data)
    df.to_excel(PROJECT_ROOT / "실험결과_alpha비교.xlsx", index=False)
    print("\n\n엑셀 저장 완료! → 실험결과_alpha비교.xlsx")

    summary = df.groupby("alpha")["품질 점수"].mean().round(3)
    print("\nalpha별 평균 품질 점수")
    print(summary)


if __name__ == "__main__":
    main()
