# BenePick Final v2 Runbook

## 기준 경로

이 프로젝트는 OneDrive 밖의 아래 경로를 기준으로 사용합니다.

```powershell
cd C:\Projects\final_project-develope
```

OneDrive 경로의 프로젝트는 파일 잠금, 캐시 충돌, ChromaDB 접근 문제를 만들 수 있으므로 실험/배포 기준으로 사용하지 않습니다.

## 현재 고정 버전

현재 상태는 `v2 final`로 고정합니다.

- 유지: OpenAI/Groq/Ollama provider 선택 구조
- 유지: 실험 단계에서 OpenAI API 사용 가능
- 유지: Colab 실험 노트북과 분석 스크립트
- 제외: v3/v4/v5의 query expand 실험 코드
- 제외: 점수 비교 기반 CRAG 교체 실험 코드

v3/v4/v5는 low20 재실험에서 기존 대비 점수가 낮아져 최종본에서 제외했습니다.

## 로컬 실행 전 체크

```powershell
cd C:\Projects\final_project-develope
python -m py_compile rag\pipeline.py
```

필요 시 가상환경을 새로 만들고 의존성을 설치합니다.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 실험용 GPT 설정

실험 단계에서만 GPT API를 사용합니다.

```powershell
$env:OPENAI_API_KEY="YOUR_KEY"
$env:OPENAI_MODEL="gpt-4o-mini"
$env:BENEPICK_LLM_MODE="experiment"
$env:BENEPICK_EXPERIMENT_PROVIDER="openai"
```

운영 기본값은 비용과 안정성을 고려해 별도 provider 설정으로 조정할 수 있습니다.

## 서버 실행

```powershell
cd C:\Projects\final_project-develope
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

헬스 체크:

```powershell
curl http://127.0.0.1:8000/health
```

## ChromaDB 관련

`chroma_db`, `__pycache__`, BM25 캐시, venv, node_modules 등은 환경성 산출물이므로 zip에 포함하지 않습니다.
배포/Colab에서는 필요 시 벡터 DB를 재구축하거나 해당 환경에서 새로 생성합니다.

## 품질 판단 메모

현재 RAG는 데모/베타 배포를 돌려 사용자 흐름과 장애를 확인하기에는 가능한 상태입니다.
다만 정책 추천 도메인 특성상 정답성이 중요하므로, 정식 운영 전에는 아래를 추가 확인합니다.

- low-score 질문군 수동 검수
- top1 정책명과 답변 근거 일치 여부 확인
- 지원 대상/금액/신청 방법의 hallucination 방지 문구 확인
- 실패 시 fallback 답변 UX 확인
- API 키/비용/속도 제한 모니터링

