# BenePick LLM 비교실험 Colab 실행 가이드

## 목적
- GPT / Claude / Gemini / BenePick를 같은 질문 세트로 비교
- Direct QA / Same Evidence QA / Full RAG 3단 비교
- LLM-as-a-Judge로 groundedness, relevance, coverage, actionability, hallucination risk 평가

## 준비물
- Google Drive에 `final_project-develope` 폴더 업로드
- API 키
  - 필수: `OPENAI_API_KEY`
  - 선택: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

## 실행 순서
1. Colab에서 `rag/compare_llm_systems_colab.ipynb` 열기
2. 패키지 설치 셀 실행
3. Drive 마운트
4. `PROJECT_DIR`를 본인 Drive 경로로 맞추기
5. API 키 입력
6. 10문항 스모크 테스트 실행
7. 이상 없으면 100문항 본실험 실행

## 추천 순서
1. `benepick:full_rag + openai:direct + openai:evidence`
2. 이후 `claude` 추가
3. 이후 `gemini` 추가

## 결과 파일
- 상세 결과: `rag/llm_compare_outputs/llm_compare_detail_*.csv`
- 요약 결과: `rag/llm_compare_outputs/llm_compare_summary_*.csv`

## 해석 포인트
- `direct`: 체감형 비교
- `evidence`: retrieval을 고정한 생성 능력 비교
- `full_rag`: BenePick 전체 파이프라인 비교
