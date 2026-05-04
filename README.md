# BenePick

한국 복지 정책(복지로 + 정부24) 데이터를 기반으로, 사용자 조건에 맞는 정책을 추천/검색/상세 분석하는 서비스입니다.  
RAG(하이브리드 검색) + FastAPI + Next.js + PostgreSQL 구조로 구성되어 있습니다.

## 1) 프로젝트 개요

- 정책 데이터: `10,367건` (`processed/chunks.csv` 367 + `processed/gov24/chunks.csv` 10,000)
- 백엔드: FastAPI (`app/`)
- 프론트엔드: Next.js + 정적 페이지 라우팅 (`frontend/`)
- 검색/추천: `rag/` 파이프라인 (Dense + BM25)
- 저장소:
  - 정책 정규화 데이터: PostgreSQL
  - 벡터/검색 인덱스: Chroma + numpy fallback

핵심 목표는 다음 3가지입니다.

1. 사용자 조건 기반 정책 추천 (`/api/v1/eligibility/analyze`)
2. 정책 검색/상세 조회 (`/api/v1/policies/search`, `/api/v1/policies/{id}/detail`)
3. 신청 준비/체크리스트/커뮤니티 기능 제공

---

## 2) 아키텍처

```text
Browser (Vercel)
  -> frontend (Next.js + public/*.html + main.js)
  -> FastAPI (Railway)
      -> app/api/routes.py
      -> app/services/rag.py
      -> app/services/ai_enricher.py (optional)
      -> PostgreSQL (policy_master, policy_condition, ...)
      -> rag/pipeline.py + rag/searcher.py
           - Dense: BGE-M3
           - Sparse: BM25 + Kiwi
           - Optional reranker
           - CRAG quality gate
```

### RAG LLM 선택(현재 코드 기준)

`rag/pipeline.py`에서 아래 우선순위로 모델 공급자를 선택합니다.

1. `BENEPICK_LLM_PROVIDER` 명시값
2. `BENEPICK_LLM_MODE=experiment|prod` + 각 provider 설정
3. 키 존재 여부 기반 자동 선택

기본값:

- `BENEPICK_PROD_PROVIDER=groq`
- `GROQ_MODEL=llama-3.1-8b-instant`
- OpenAI / Ollama는 폴백 경로

---

## 3) 주요 디렉토리

```text
final_project-develope/
├─ app/
│  ├─ api/
│  │  ├─ routes.py              # 주요 REST API
│  │  └─ deps.py
│  ├─ core/config.py            # 환경변수 로딩
│  ├─ db/
│  │  ├─ models.py              # SQLAlchemy 모델
│  │  ├─ session.py
│  │  └─ base.py
│  ├─ schemas/                  # 응답/요청 스키마
│  ├─ services/
│  │  ├─ analysis.py
│  │  ├─ rag.py                 # RAG 호출 + timeout/circuit 제어
│  │  ├─ application.py
│  │  ├─ community.py
│  │  ├─ ai_enricher.py         # 요약/번역/추론 통합
│  │  └─ ai_modules/
│  ├─ scripts/
│  │  ├─ init_db.py
│  │  ├─ fetch_policies.py
│  │  └─ normalize_policies.py
│  └─ main.py
├─ rag/
│  ├─ pipeline.py               # 쿼리 보강, 검색, rerank, CRAG, answer
│  ├─ searcher.py               # HybridSearcher(Dense + BM25)
│  ├─ rebuild_chroma.py         # Chroma 재생성
│  ├─ vector_store.py           # HTTP Chroma 적재 유틸
│  └─ tests/test_pipeline.py
├─ processed/
│  ├─ chunks.csv
│  ├─ embeddings.npy
│  └─ gov24/
│     ├─ chunks.csv
│     └─ embeddings.npy
├─ frontend/
│  ├─ app/                      # / -> /index.html 리다이렉트 구조
│  ├─ public/                   # 실제 UI 엔트리(html/css/js)
│  ├─ lib/api.ts
│  └─ package.json
├─ railway.json
├─ requirements.txt
└─ start_server.ps1             # 로컬 원클릭 실행 보조
```

---

## 4) API 요약

공통 응답 래퍼: `{"success": true, "data": ... , "meta": ...}`

### 분석/검색/상세

- `POST /api/v1/eligibility/analyze`
- `GET /api/v1/policies/search?q=...&size=...&lang=ko|en|zh|ja|vi`
- `GET /api/v1/policies/{policy_id}/detail?lang=...`

### 포트폴리오/신청

- `GET /api/v1/portfolio`
- `GET /api/v1/applications/{policy_id}/prep`
- `PATCH /api/v1/applications/{policy_id}/checklist/{code}`
- `PATCH /api/v1/applications/{policy_id}/documents/{document_type}`

### 커뮤니티

- `GET /api/v1/community/posts`
- `GET /api/v1/community/posts/{post_id}`
- `POST /api/v1/community/posts`
- `POST /api/v1/community/posts/{post_id}/like`
- `DELETE /api/v1/community/posts/{post_id}/like`
- `GET /api/v1/community/hot-posts`
- `GET /api/v1/community/stats`

### 헬스체크

- `GET /health`

---

## 5) 로컬 실행 가이드

## 5.1 필수 준비

- Python 3.12
- Node.js 18+
- PostgreSQL
- (선택) Ollama

## 5.2 설치

```bash
pip install -r requirements.txt
cd frontend
npm install
```

## 5.3 환경변수(.env)

루트 `.env.example`를 복사해 `.env` 생성:

```env
APP_ENV=local
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/benepick

GOV24_SERVICE_KEY=...
GOV24_BASE_URL=https://api.odcloud.kr/api/gov24/v3

BOKJIRO_SERVICE_KEY=...
BOKJIRO_BASE_URL=http://apis.data.go.kr/B554287/NationalWelfareInformationsV001

GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OLLAMA_MODEL=qwen3.5:4b

BENEPICK_LLM_MODE=auto
BENEPICK_LLM_PROVIDER=
BENEPICK_EXPERIMENT_PROVIDER=openai
BENEPICK_PROD_PROVIDER=groq

RAG_ANSWER_TIMEOUT_SECONDS=15
BENEPICK_ENABLE_RERANKER=0
BENEPICK_DISABLE_CHROMA_VECTOR=1
```

## 5.4 실행

### 옵션 A: 스크립트 실행

```powershell
.\start_server.ps1
```

### 옵션 B: 수동 실행

터미널 1:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

터미널 2:

```bash
cd frontend
npm run dev
```

접속:

- `http://localhost:3000`

---

## 6) RAG 동작 포인트

`rag/pipeline.py` 기준:

1. `build_search_query()`에서 user condition을 자연어 쿼리로 보강
2. `HybridSearcher.search()`로 Dense + BM25 검색
3. (옵션) reranker
4. `crag_quality_check()`로 품질 기반 분기
5. `generate_answer()`로 답변 생성

`rag/searcher.py` 기준:

- `BENEPICK_DISABLE_CHROMA_VECTOR=1`이면 Chroma vector query를 건너뛰고 numpy dense fallback 사용
- Chroma 쿼리 실패 시 자동으로 numpy fallback 전환
- BM25는 Kiwi 형태소 분석 기반

---

## 7) 데이터/인덱스 작업

### DB 테이블 생성

```bash
python -m app.scripts.init_db
```

### Chroma 재구축(로컬 persistent)

```bash
python rag/rebuild_chroma.py
```

### Chroma HTTP 적재 테스트 유틸

```bash
python rag/vector_store.py
```

---

## 8) 테스트/검증

### 백엔드(RAG 핵심)

```bash
cd rag
pytest tests/test_pipeline.py -q
```

### 프론트 빌드

```bash
cd frontend
npm run build
```

### 문법 컴파일 체크(선택)

```bash
python -m compileall app rag
```

---

## 9) 배포 운영 가이드

## 9.1 권장 조합

- 프론트: Vercel
- 백엔드: Railway

## 9.2 Railway

- `railway.json`에서 `uvicorn app.main:app ...` 기반 기동
- healthcheck: `/health`
- CORS는 `app/main.py`에서 허용 origin + regex(`*.railway.app`) 설정

## 9.3 Vercel

- `frontend`를 프로젝트 루트로 설정
- 백엔드 주소는 프론트 `API_BASE` 해석 로직(쿼리/전역/localStorage/default)을 통해 연결

---

## 10) 트러블슈팅

### 1) CORS 에러처럼 보이는데 실제 원인이 500인 경우

- 브라우저 CORS 메시지와 함께 백엔드 로그 traceback을 반드시 확인
- `/health`는 정상이어도 특정 API 내부 예외로 실패할 수 있음

### 2) Chroma HNSW 로드 실패

- `BENEPICK_DISABLE_CHROMA_VECTOR=1`로 numpy dense fallback 강제
- 필요 시 `python rag/rebuild_chroma.py`로 인덱스 재생성

### 3) 상세 화면 원문 발췌 비어 보임

- `policy_id` 기준으로 `/api/v1/policies/{id}/detail` 응답이 정상인지 확인
- `source_excerpt` 필드 유무 확인

### 4) OneDrive 경로에서 파일 잠금

- Chroma 파일 lock 문제가 잦으면 `BENEPICK_CHROMA_PATH`를 로컬 경로(OneDrive 외)로 지정

---

## 11) 팀

| 이름 | 담당 |
|---|---|
| 박종민 | 백엔드/프론트/RAG 통합, 배포 운영, 품질 개선 |
| 고준 | 데이터 수집 |
| 남정현 | 프론트엔드 UI |
| 최은철 | AI 요약/번역/추론 모듈 |

---

## 12) 보안/운영 주의사항

- `.env`/API 키는 절대 Git에 커밋하지 않습니다.
- 운영 배포에서는 `GROQ_API_KEY`, `DATABASE_URL`을 플랫폼 시크릿으로 관리하세요.
- 실서비스 로그에는 사용자 민감정보가 남지 않도록 주기적으로 점검하세요.

