import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from rag.pipeline import get_searcher, get_reranker
        logger.info("Warming up searcher...")
        get_searcher()
        logger.info("Warming up reranker...")
        get_reranker()
        logger.info("Startup warming complete.")
    except Exception as e:
        logger.warning("Startup warming failed (non-fatal): %s", e)
    yield


app = FastAPI(title="BenePick API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
