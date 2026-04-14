# AI Integration Notes

## Base

This folder is based on `benepick-claude-recursing-tharp`.

## Integrated Scope

- Added `app/services/ai_modules/`
- Added `app/services/ai_enricher.py`
- Updated `app/api/routes.py` so policy detail responses can call AI enrichment
- Updated `frontend/components/dashboard.tsx` so detail/search requests pass `lang`
- Updated `.env.example` with Qwen/Ollama settings

## Runtime Flow

```text
Next.js dashboard
  -> /api/v1/eligibility/analyze
  -> RAG + DB policy mapping
  -> /api/v1/policies/{policy_id}/detail?lang=...
  -> ai_enricher
  -> summary / translation / rejection guide / output guard
```

## Notes

- Keep the current `/api/v1/...` API contract. Do not switch back to the old `/analyze` API.
- `benepick-RAG` was not copied wholesale because its paths target a standalone RAG layout.
- If Ollama or Qwen is unavailable, the detail API falls back to DB/RAG text and existing rule results.
