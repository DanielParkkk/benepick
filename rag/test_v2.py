"""
/rag/search/v2 엔드포인트 수동 점검 스크립트
실행: python test_v2.py

주의:
- pytest 수집 시에는 실행되지 않도록 main 진입점으로만 동작한다.
"""

from __future__ import annotations

import httpx

BASE_URL = "http://localhost:8001"


def _load_questions() -> list[str]:
    """
    evaluate.py의 TEST_QUESTIONS를 우선 사용하고,
    실패하면 최소 샘플 질문으로 대체한다.
    """
    try:
        from evaluate import TEST_QUESTIONS  # optional dependency: ragas
        return list(TEST_QUESTIONS)
    except Exception:
        return [
            "서울 청년 월세 지원 받을 수 있나요?",
            "미취업 청년 구직 지원 정책이 있나요?",
            "의료비 부담 완화 정책이 궁금합니다.",
        ]


def run_v2_smoke_test(base_url: str = BASE_URL) -> dict[str, float | int]:
    questions = _load_questions()
    print("=" * 60)
    print(f"/rag/search/v2 테스트 ({len(questions)}개 질문)")
    print("=" * 60)

    success, fail = 0, 0
    scores: list[float] = []

    for i, q in enumerate(questions, 1):
        try:
            r = httpx.post(
                f"{base_url}/rag/search/v2",
                json={"query": q, "lang_code": "ko"},
                timeout=120,
            )
            data = r.json()
            if data.get("success"):
                results = data["data"]["search_results"]
                top_score = float(results[0]["score"]) if results else 0.0
                scores.append(top_score)
                print(f"  ({i:02d}/{len(questions):02d}) OK {len(results)}개 | top score: {top_score:.4f} | {q[:30]}...")
                success += 1
            else:
                print(f"  ({i:02d}/{len(questions):02d}) FAIL: {data.get('error_message')} | {q[:30]}...")
                fail += 1
        except Exception as e:
            print(f"  ({i:02d}/{len(questions):02d}) ERROR: {e} | {q[:30]}...")
            fail += 1

    summary: dict[str, float | int] = {
        "success": success,
        "fail": fail,
        "total": len(questions),
    }
    if scores:
        summary["avg_top_score"] = round(sum(scores) / len(scores), 4)
        summary["max_top_score"] = round(max(scores), 4)
        summary["min_top_score"] = round(min(scores), 4)

    print("\n" + "=" * 60)
    print(f"성공: {success}/{len(questions)}  실패: {fail}/{len(questions)}")
    if scores:
        print(f"평균 top score: {summary['avg_top_score']:.4f}")
        print(f"최고 score:     {summary['max_top_score']:.4f}")
        print(f"최저 score:     {summary['min_top_score']:.4f}")
    print("=" * 60)

    return summary


if __name__ == "__main__":
    run_v2_smoke_test()
