## 적용 위치

팀 repo 루트에서 이 패치 폴더의 내용을 같은 경로로 복사합니다.

```text
repo-root/
  app/
  frontend/
  rag/
  README.md
  .env.example
```

## 포함 파일

- `app/services/ai_modules/`
- `app/services/ai_enricher.py`
- `app/api/routes.py`
- `frontend/components/dashboard.tsx`
- `.env.example`
- `README.md`
- `EUNCHUL_AI_INTEGRATION.md`

## 실행 전 확인

`.env`에 아래 값을 추가하거나 `.env.example`을 참고합니다.

```text
QWEN_MODEL=qwen3.5:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT=300
```

## API 계약

기존 팀 API인 `/api/v1/...` 구조를 유지합니다.
old API인 `/analyze`, `/search/keyword` 구조로 되돌리지 마세요.

주요 연결 지점:

```text
GET /api/v1/policies/{policy_id}/detail?lang=ko|en|zh|ja|vi
```

이 API에서 정책 요약, 다국어 번역, 탈락 예상 사유, 보완 가이드가 보강됩니다.
