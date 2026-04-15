# BenePick — 한국 복지 정책 AI 추천 서비스

복지로·정부24 정책 데이터 10,367건을 하이브리드 RAG(Retrieval-Augmented Generation) 파이프라인으로 검색하고, 사용자 조건에 맞는 복지 정책을 AI가 추천·요약·번역하는 서비스입니다.

---

## 팀 구성

| 이름 | 역할 |
|------|------|
| 박종민 | RAG 파이프라인, 데이터 수집·임베딩, 평가 |
| 최태홍 | FastAPI 백엔드, PostgreSQL, API 연동 |
| 고준 | 데이터 수집 |
| 남정현 | Next.js 프론트엔드 |
| 최은철 | AI 요약·번역·추론 모듈, 프롬프트 엔지니어링 |

---

## 전체 아키텍처

```
사용자 (브라우저)
    │
    ▼
Next.js 프론트엔드 (port 3000)
    │  NEXT_PUBLIC_API_BASE_URL
    ▼
FastAPI 백엔드 (port 8000)
    │
    ├── app/api/routes.py         API 엔드포인트
    ├── app/services/rag.py       RAG 파이프라인 호출
    ├── app/services/ai_enricher.py  AI 요약·번역·추론
    └── PostgreSQL                정책 메타데이터 DB
         │
         ▼
    rag/pipeline.py               RAG 메인 파이프라인
         │
         ├── HybridSearcher       BGE-M3 벡터(60%) + BM25/Kiwi(40%)
         │       └── ChromaDB HTTP 서버 (port 8001)
         ├── bge-reranker-v2-m3  정밀 재정렬 (CUDA)
         ├── CRAG                 품질 검증 및 폴백
         └── gemma3:4b (Ollama)   최종 답변 생성
```

---

## 주요 구조

```
final_project-develope/
├── app/                          FastAPI 백엔드
│   ├── api/routes.py             전체 API 엔드포인트
│   ├── services/
│   │   ├── rag.py                RAG 호출 래퍼
│   │   ├── ai_enricher.py        AI 모듈 통합 진입점
│   │   ├── ai_modules/           요약·번역·추론 모듈
│   │   │   ├── summary_service.py
│   │   │   ├── translation_service.py
│   │   │   ├── qwen_reasoner.py
│   │   │   ├── output_guard.py
│   │   │   ├── prompt_builder.py
│   │   │   ├── benepick_dict.csv  행정 용어 번역 사전
│   │   │   └── prompts/
│   │   ├── analysis.py
│   │   ├── application.py
│   │   └── community.py
│   ├── db/
│   │   ├── models.py             SQLAlchemy 모델
│   │   └── session.py
│   ├── schemas/                  Pydantic 스키마
│   ├── core/config.py            환경변수 설정
│   └── main.py                   FastAPI 앱
│
├── rag/                          RAG 파이프라인
│   ├── pipeline.py               메인 파이프라인 (benepick_rag)
│   ├── searcher.py               하이브리드 검색기 (BGE-M3 + BM25/Kiwi)
│   ├── embedder.py               BGE-M3 임베딩 생성
│   ├── vector_store.py           ChromaDB 저장·로드
│   ├── preprocessor.py           데이터 전처리·청킹
│   ├── collector.py              복지로·정부24 API 수집
│   ├── evaluate.py               Ragas 평가 스크립트
│   └── chroma_db/                ChromaDB 벡터 DB
│
├── processed/                    전처리 완료 데이터
│   ├── chunks.csv                복지로 청크 (367건)
│   ├── embeddings.npy            복지로 임베딩
│   └── gov24/
│       ├── chunks.csv            정부24 청크 (10,000건)
│       └── embeddings.npy
│
├── frontend/                     Next.js 프론트엔드
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       └── dashboard.tsx         전체 화면 SPA 컴포넌트
│
├── requirements.txt
└── .env.example
```

---

## 핵심 모델 및 설정

| 항목 | 값 | 근거 |
|------|-----|------|
| 임베딩 | `BAAI/bge-m3` (CPU) | MTEB 한국어 최상위 |
| Reranker | `BAAI/bge-reranker-v2-m3` (CUDA) | BGE 계열 한국어 강점 |
| 하이브리드 alpha | `0.6` (벡터 60% + BM25 40%) | 실험으로 확정 |
| BM25 토크나이저 | Kiwi 형태소 분석기 (NNG/NNP/XR/SL) | 한국어 조사 처리 |
| RAG LLM | `gemma3:4b` (Ollama) | 품질·속도 균형 |
| AI 모듈 LLM | `qwen3.5:4b` (Ollama) | 구조화 JSON 출력 특화 |
| 벡터 DB | ChromaDB (HTTP 서버, port 8001) | 벡터 + 메타데이터 통합 |
| CRAG 품질 기준 | HIGH ≥ 0.7 / MEDIUM ≥ 0.4 / LOW → 폴백 | |
| 지원 언어 | `ko` / `en` / `zh` / `ja` / `vi` | ISO 639-1 |

---

## 사전 준비

### 1. 필수 소프트웨어

```
Python 3.12
Node.js 18+
PostgreSQL 15+
Ollama (https://ollama.com)
ChromaDB (pip install chromadb)
```

### 2. Ollama 모델 설치

```bash
ollama pull gemma3:4b
ollama pull qwen3.5:4b
```

### 3. Kiwi 모델 경로 설정

한글 경로에서 Kiwi C 확장이 모델 파일을 열지 못하는 문제가 있습니다.  
모델 파일을 ASCII 경로로 복사한 뒤 `rag/searcher.py`의 `model_path`를 해당 경로로 수정하세요.

```bash
# 예시 (경로는 환경에 맞게 수정)
cp -r venv/Lib/site-packages/kiwipiepy_model C:/Users/<user>/kiwi_model
```

```python
# rag/searcher.py
_kiwi = Kiwi(model_path='C:/Users/<user>/kiwi_model', num_workers=-1)
```

---

## 설치

```bash
# 프로젝트 루트에서
pip install -r requirements.txt

# 프론트엔드
cd frontend
npm install
```

---

## 환경변수 설정

`.env.example`을 복사해서 `.env` 파일을 만들고 실제 값을 입력합니다.

```env
APP_ENV=local

# PostgreSQL
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/benepick

# 공공 API 키
GOV24_SERVICE_KEY=your-gov24-service-key
GOV24_BASE_URL=https://api.odcloud.kr/api/gov24/v3

BOKJIRO_SERVICE_KEY=your-bokjiro-service-key
BOKJIRO_BASE_URL=http://apis.data.go.kr/B554287/NationalWelfareInformationsV001

# AI 모듈 (요약·번역)
QWEN_MODEL=qwen3.5:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT=300
```

프론트엔드 API 주소가 다르면 `frontend/.env.local`도 추가합니다.

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

---

## 실행 순서

터미널 4개를 사용합니다.

```bash
# [터미널 1] Ollama
ollama serve

# [터미널 2] ChromaDB HTTP 서버
chroma run --port 8001 --path ./chroma_db

# [터미널 3] FastAPI 백엔드 (프로젝트 루트에서)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# [터미널 4] Next.js 프론트엔드
cd frontend
npm run dev
```

브라우저에서 접속합니다.

```
http://localhost:3000
```

---

## API 엔드포인트

모든 응답은 `{ "success": true, "data": { ... } }` 형식입니다.

| 메서드 | URL | 설명 |
|--------|-----|------|
| `POST` | `/api/v1/eligibility/analyze` | 사용자 조건 분석 + RAG 정책 추천 |
| `GET` | `/api/v1/policies/search?q=&lang=` | 키워드 정책 검색 |
| `GET` | `/api/v1/policies/{id}/detail?lang=` | 정책 상세 + AI 요약·번역 |
| `GET` | `/api/v1/portfolio` | 추천 정책 포트폴리오 |
| `GET` | `/api/v1/applications/{id}/prep` | 신청 준비 (서류·체크리스트) |
| `PATCH` | `/api/v1/applications/{id}/checklist/{code}` | 체크리스트 항목 업데이트 |
| `PATCH` | `/api/v1/applications/{id}/documents/{type}` | 서류 상태 업데이트 |
| `GET` | `/api/v1/community/posts` | 커뮤니티 목록 |
| `POST` | `/api/v1/community/posts` | 커뮤니티 글 작성 |
| `POST` | `/api/v1/community/posts/{id}/like` | 좋아요 |
| `GET` | `/api/v1/community/hot-posts` | 인기 글 |
| `GET` | `/api/v1/community/stats` | 커뮤니티 통계 |
| `GET` | `/health` | 헬스체크 |

### POST `/api/v1/eligibility/analyze` 요청 예시

```json
{
  "age": 27,
  "region_code": "KR-11-680",
  "region_name": "서울 강남구",
  "income_band": "MID_60_80",
  "household_type": "SINGLE",
  "employment_status": "UNEMPLOYED",
  "housing_status": "MONTHLY_RENT"
}
```

---

## AI 모듈 동작

`qwen3.5:4b`가 Ollama에 없으면 AI 모듈은 자동으로 비활성화되고, 서버는 정상 실행됩니다.

- **정책 상세 조회** 시 → `qwen3.5:4b`로 정책 요약 + 거절사유·신청 가이드 생성
- `lang=en/zh/ja/vi` 파라미터 → `qwen3.5:4b` + `benepick_dict.csv` 행정용어 사전으로 번역
- 번역 실패 시 → 한국어 원문 그대로 반환 (`is_fallback: true`)

---

## RAG 파이프라인 흐름

```
사용자 질문 + user_condition
    ↓
build_search_query()     user_condition을 자연어 쿼리에 보강
    ↓
HybridSearcher.search()  BGE-M3 Dense(60%) + BM25/Kiwi(40%) → Top-25
    ↓
rerank()                 bge-reranker-v2-m3로 정밀 재정렬 → Top-5
    ↓
crag_quality_check()     평균 점수 기준 3단계 분기
    │  HIGH(≥0.7)  → 원본 결과 사용
    │  MID(≥0.4)   → 조건 완화 재검색 (지역/가구 제거)
    └  LOW(<0.4)   → 카테고리 폴백 검색
    ↓
generate_answer()        gemma3:4b (Ollama) 로 문서 기반 답변 생성
    ↓
success_response()       팀 공통 응답 형식으로 반환
```

---

## VRAM 사용량 참고 (RTX 4060 Laptop 8GB 기준)

| 컴포넌트 | 디바이스 | VRAM |
|----------|----------|------|
| BGE-M3 임베딩 | CPU | RAM 사용 |
| bge-reranker-v2-m3 | CUDA | ~1.5 GB |
| gemma3:4b (Ollama) | CUDA | ~2.6 GB |
| qwen3.5:4b (Ollama, 필요시) | CUDA | ~2.6 GB |
| **최대 동시 사용** | | **~4.1 GB** |

Ollama는 한 번에 하나의 모델만 VRAM에 올리므로 gemma3:4b와 qwen3.5:4b는 동시에 로드되지 않습니다.

---

## 평가 결과 (Ragas, gemma3:4b 전환 후 재평가 예정)

| 지표 | gemma3:1b 기준 (2026-04-02) |
|------|---------------------------|
| Faithfulness | 0.9769 |
| Answer Relevancy | 0.5582 |
| 평균 | 0.7675 |

평가 재실행:

```bash
cd rag
# ChromaDB 서버 및 Ollama가 실행 중이어야 합니다
python evaluate.py
```

---

## 데이터 재구축 (ChromaDB 초기화)

ChromaDB를 처음 구축하거나 재구축이 필요할 때 실행합니다.  
`chroma run --port 8001 --path ./chroma_db`가 실행 중이어야 합니다.

```bash
cd rag
python vector_store.py
```

---

## Git 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 최종 배포 |
| `develope` | 통합 개발 (현재 메인 브랜치) |
| `backend` | 백엔드 API |
| `ai_modules` | AI 요약·번역 모듈 |
| `frontend` / `njh` | 프론트엔드 UI |
| `RAG` / `rag` | RAG 파이프라인 |
