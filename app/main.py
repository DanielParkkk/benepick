from contextlib import asynccontextmanager
import logging
import os
import threading
from typing import Any

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

try:
    from app.api.routes import router
except Exception as exc:
    logger.warning("Primary API router import failed; fallback routes enabled: %s", exc)
    router = None


ENABLE_RAG_WARMUP = os.getenv("BENEPICK_ENABLE_RAG_WARMUP", "1") == "1"


def _warmup_rag_searcher() -> None:
    try:
        from rag.pipeline import get_searcher

        get_searcher()
        logger.info("RAG warm-up completed.")
    except Exception as exc:  # pragma: no cover - best-effort warm-up
        logger.warning("RAG warm-up failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if ENABLE_RAG_WARMUP:
        warmup_thread = threading.Thread(
            target=_warmup_rag_searcher,
            name="rag-warmup",
            daemon=True,
        )
        warmup_thread.start()
        logger.info("RAG warm-up thread started.")
    yield


app = FastAPI(title="BenePick API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://benepick.up.railway.app",
        "https://benepick-frontend.up.railway.app",
    ],
    allow_origin_regex=r"https://.*\.(railway\.app|up\.railway\.app|vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if router is not None:
    app.include_router(router)
else:
    fallback_router = APIRouter(prefix="/api/v1")

    def _map_doc_to_policy_item(doc: dict[str, Any], sort_order: int) -> dict[str, Any]:
        raw_score = float(doc.get("score", 0.0))
        match_score = max(1, min(99, int(round(raw_score * 100))))
        if match_score >= 85:
            score_level = "HIGH"
            status = "APPLICABLE_NOW"
        elif match_score >= 65:
            score_level = "MID"
            status = "NEEDS_CHECK"
        else:
            score_level = "LOW"
            status = "NEEDS_CHECK"

        return {
            "policy_id": str(doc.get("policy_id", f"rag-{sort_order}")),
            "title": str(doc.get("policy_name", "RAG policy")),
            "description": str(doc.get("evidence_text", ""))[:140],
            "match_score": match_score,
            "score_level": score_level,
            "apply_status": status,
            "benefit_amount": None,
            "benefit_amount_label": "Check official notice",
            "benefit_summary": "RAG candidate",
            "badge_items": ["RAG", f"Score {match_score}%"],
            "sort_order": sort_order,
        }

    def _run_rag(
        query: str,
        lang: str,
        user_condition: dict[str, Any] | None = None,
    ) -> tuple[str | None, list[dict[str, Any]], str | None]:
        try:
            from rag.pipeline import benepick_rag

            rag_result = benepick_rag(query, lang_code=lang, user_condition=user_condition or {})
            if not rag_result.get("success"):
                return None, [], rag_result.get("error_message") or "RAG execution failed"

            data = rag_result.get("data") or {}
            return data.get("answer"), data.get("docs_used") or [], None
        except Exception as exc:
            return None, [], str(exc)

    @fallback_router.post("/eligibility/analyze")
    async def analyze_fallback(request: Request) -> dict[str, Any]:
        payload = await request.json()
        query = (
            f"region {payload.get('region_name', '')} "
            f"age {payload.get('age', '')} "
            f"income {payload.get('income_band', '')} "
            "welfare policy recommendation"
        ).strip()
        rag_answer, docs, rag_error = _run_rag(query=query, lang="ko", user_condition=payload)
        policies = [_map_doc_to_policy_item(doc, i + 1) for i, doc in enumerate(docs[:5])]
        if not policies:
            policies = [
                {
                    "policy_id": "fallback-1",
                    "title": "Fallback policy recommendation",
                    "description": "RAG returned no result. Safe fallback response.",
                    "match_score": 75,
                    "score_level": "MID",
                    "apply_status": "NEEDS_CHECK",
                    "benefit_amount": None,
                    "benefit_amount_label": "Check official notice",
                    "benefit_summary": "Fallback benefit summary",
                    "badge_items": ["fallback"],
                    "sort_order": 1,
                }
            ]

        return {
            "success": True,
            "data": {
                "profile_summary": {"analysis_score": 75, "tags": ["fallback", "rag", "analysis"]},
                "policies": policies,
                "rag_answer": rag_answer or f"RAG fallback used: {rag_error or 'unknown error'}",
                "rag_docs_used": [str(doc.get("policy_id", "")) for doc in docs],
                "unmatched_policies": [],
            },
        }

    @fallback_router.get("/policies/search")
    def search_fallback(
        q: str = Query(default=""),
        size: int = Query(default=20),
        lang: str = Query(default="ko"),
    ) -> dict[str, Any]:
        rag_answer, docs, rag_error = _run_rag(query=q or "welfare policy", lang=lang, user_condition={})
        items = [_map_doc_to_policy_item(doc, i + 1) for i, doc in enumerate(docs[:size])]
        if not items:
            items = [
                {
                    "policy_id": "fallback-search-1",
                    "title": f"Fallback result for '{q}'",
                    "description": "No RAG candidates returned.",
                    "match_score": 70,
                    "score_level": "MID",
                    "apply_status": "NEEDS_CHECK",
                    "benefit_amount": None,
                    "benefit_amount_label": "Check official notice",
                    "benefit_summary": "Fallback search summary",
                    "badge_items": ["fallback"],
                    "sort_order": 1,
                }
            ]

        return {
            "success": True,
            "data": {
                "items": items,
                "query": q,
                "total_count": len(items),
                "rag_answer": rag_answer or f"RAG fallback used: {rag_error or 'unknown error'}",
                "rag_docs_used": [str(doc.get("policy_id", "")) for doc in docs],
                "unmatched_policies": [],
            },
        }

    @fallback_router.get("/modules/status")
    def modules_status() -> dict[str, Any]:
        _, rag_docs, rag_error = _run_rag(query="welfare policy", lang="ko", user_condition={})
        return {
            "success": True,
            "data": {
                "rag_ok": len(rag_docs) > 0 and rag_error is None,
                "rag_error": rag_error,
                "ai_ok": False,
                "ai_error": "AI enricher unavailable in fallback mode",
            },
        }

    app.include_router(fallback_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
