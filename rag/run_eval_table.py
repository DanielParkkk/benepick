# -*- coding: utf-8 -*-
"""
질문별 파이프라인 실행 결과 출력 스크립트
실험평가 표 작성용
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import json
import time
from datetime import datetime
from pipeline import benepick_rag

TEST_QUESTIONS = [
    "서울 청년 월세 지원 받을 수 있나요?",
    "취업 준비생이 받을 수 있는 훈련비 지원이 뭐가 있나요?",
    "청년 창업 지원금 신청 방법 알려주세요",
    "65세 이상 혼자 사는 노인 지원 정책",
    "노인 돌봄 서비스 신청 방법",
    "장애인 취업 지원 프로그램 알려줘",
    "장애인 의료비 지원 혜택",
    "기초생활수급자 혜택 뭐가 있어요?",
    "출산 지원금 얼마나 받을 수 있어요?",
    "어린이집 보육료 지원 신청",
    "한부모 가정 아동 양육비 지원",
    "다문화 가정 한국어 교육 지원",
    "실직한 30대 신청할 수 있는 복지 정책",
    "주거급여 신청 자격",
    "암 환자 의료비 지원 방법",
]

rows = []
print("\n" + "=" * 80)
print("베네픽 RAG 파이프라인 — 질문별 실행 결과")
print("=" * 80)

for i, q in enumerate(TEST_QUESTIONS, 1):
    print(f"\n[{i:02d}/{len(TEST_QUESTIONS)}] {q}")
    start = time.time()
    result = benepick_rag(q, lang_code="ko", user_condition=None)
    elapsed = round((time.time() - start) * 1000)

    if result["success"]:
        data = result["data"]
        top1 = data["docs_used"][0] if data["docs_used"] else {}
        row = {
            "no": i,
            "question": q,
            "answer": data["answer"],
            "top1_policy": top1.get("policy_name", "-"),
            "top1_score": top1.get("score", 0),
            "doc_count": data["doc_count"],
            "search_time_ms": data["search_time_ms"],
            "total_time_ms": elapsed,
            "success": True,
        }
        print(f"  ✅ Top1: {row['top1_policy']} (score: {row['top1_score']})")
        print(f"  ⏱  검색: {row['search_time_ms']}ms | 전체: {elapsed}ms")
        print(f"  📝 답변: {data['answer'][:120]}...")
    else:
        row = {
            "no": i,
            "question": q,
            "answer": f"[실패] {result.get('error_message', '')}",
            "top1_policy": "-",
            "top1_score": 0,
            "doc_count": 0,
            "search_time_ms": 0,
            "total_time_ms": elapsed,
            "success": False,
        }
        print(f"  ❌ 실패: {result.get('error_message')}")

    rows.append(row)

# ── 요약 출력 ──
print("\n\n" + "=" * 80)
print("질문별 결과 요약표")
print("=" * 80)
print(f"{'No':>3}  {'질문':<35} {'Top1 정책':<25} {'score':>6}  {'검색ms':>6}  {'전체ms':>6}")
print("-" * 80)
for r in rows:
    status = "✅" if r["success"] else "❌"
    print(f"{r['no']:>3}{status} {r['question'][:33]:<35} {r['top1_policy'][:23]:<25} {r['top1_score']:>6.4f}  {r['search_time_ms']:>6}  {r['total_time_ms']:>6}")

# ── 전체 답변 출력 ──
print("\n\n" + "=" * 80)
print("전체 답변 (인풋 → 아웃풋)")
print("=" * 80)
for r in rows:
    print(f"\n[Q{r['no']:02d}] {r['question']}")
    print(f"  Top1: {r['top1_policy']} (score: {r['top1_score']})")
    print(f"  Answer: {r['answer']}")
    print("-" * 60)

# ── JSON 저장 ──
timestamp = datetime.now().strftime("%Y%m%d_%H%M")
out_path = f"실험결과_파이프라인_인풋아웃풋_{timestamp}.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump({"timestamp": timestamp, "results": rows}, f, ensure_ascii=False, indent=2)
print(f"\n💾 저장: {out_path}")
