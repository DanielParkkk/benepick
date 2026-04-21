# Deployment Guide

## Recommended Topology

- Frontend: Vercel
- Backend/RAG API: Railway

This split keeps the Next.js frontend on the platform that supports it best, while the FastAPI/RAG backend runs in a long-lived Python service instead of a serverless function.

## Railway Backend

Deploy the repository root as the Railway service.

Start command is managed by `railway.json`:

```bash
python -m app.scripts.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required Railway variables:

```env
BENEPICK_LLM_MODE=prod
BENEPICK_PROD_PROVIDER=groq
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.1-8b-instant
DATABASE_URL=your-railway-postgres-url
```

Optional Railway variables:

```env
BENEPICK_ENABLE_RAG_WARMUP=1
BENEPICK_ENABLE_RERANKER=0
BENEPICK_FORCE_BM25_FALLBACK=0
```

Smoke test after deploy:

```bash
curl https://your-backend.up.railway.app/health
```

## Vercel Frontend

Create a Vercel project from the same GitHub repo.

Vercel project settings:

- Framework Preset: Next.js
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `.next`

Required Vercel variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_ANALYZE_TIMEOUT_MS=65000
```

After Vercel deploys, open the frontend URL and run one search/analyze request.

## Notes

- Do not commit `.env` or API keys.
- `chroma_db/` is a generated artifact and should be rebuilt per environment from `processed/`.
- GPT/OpenAI is for experiment mode only. Production should use Groq unless the team explicitly chooses otherwise.
