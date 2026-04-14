## 주요 구조

```text
app/          FastAPI 백엔드
rag/          RAG 검색 및 답변 생성 파이프라인
frontend/     Next.js 프론트엔드
processed/    RAG 검색용 전처리 데이터
raw/          원본 정책 데이터
chroma.sqlite3, UUID 폴더들
              Chroma 벡터DB 데이터
```

## AI 모듈 통합

이 통합본은 `benepick-claude-recursing-tharp`를 기준으로 은철 담당 AI 모듈을
FastAPI 상세 분석 흐름에 연결한 버전입니다.

```text
frontend/components/dashboard.tsx
  -> GET /api/v1/policies/{policy_id}/detail?lang=ko|en|zh|ja|vi
  -> app.services.ai_enricher.PolicyAIEnricher
  -> app/services/ai_modules/
     summary_service.py
     translation_service.py
     qwen_reasoner.py
     prompt_builder.py
     output_guard.py
```

요약, 다국어 번역, 탈락 예상 사유, 보완 가이드는 `app/services/ai_modules`에서
처리합니다. 모델 호출이 실패하면 기존 DB/RAG 결과를 바탕으로 fallback 응답을
반환하므로 화면은 계속 동작합니다.

## 준비

프로젝트 루트는 다음 경로입니다.

```powershell
cd C:\Users\heuks\Desktop\final_rag\final_project
```

Python 패키지는 하나의 파일에서 설치합니다.

```powershell
pip install -r requirements.txt
```

프론트엔드 패키지는 `frontend` 폴더에서 설치합니다.

```powershell
cd C:\Users\heuks\Desktop\final_rag\final_project\frontend
npm install
```

`.env.example`을 참고해서 `.env`를 준비합니다. 실제 API 키와 DB 비밀번호는 `.env`에만 넣고 Git에는 올리지 않습니다.

AI 모듈은 아래 값을 사용합니다.

```text
QWEN_MODEL=qwen3.5:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT=300
```

## 실행

백엔드는 프로젝트 루트에서 실행합니다.

```powershell
cd C:\Users\heuks\Desktop\final_rag\final_project
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

프론트엔드는 별도 PowerShell 창에서 실행합니다.

```powershell
cd C:\Users\heuks\Desktop\final_rag\final_project\frontend
npm run dev
```

브라우저에서 접속합니다.

```text
http://localhost:3000
```

프론트엔드는 기본적으로 `http://127.0.0.1:8000/api/v1` 백엔드 API를 호출합니다. 다른 주소를 쓰려면 `frontend/.env.local`에 아래처럼 설정합니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## 참고

RAG가 백엔드 내부에서 실행되므로 첫 검색 요청에서는 임베딩 모델, reranker, Ollama 모델 로딩 때문에 시간이 걸릴 수 있습니다. Ollama를 사용하는 경우 로컬에서 `gemma3:1b` 모델을 사용할 수 있어야 합니다.
