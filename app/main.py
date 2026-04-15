from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 HybridSearcher 미리 로딩
    try:
        from rag.pipeline import get_searcher
        import asyncio
        await asyncio.to_thread(get_searcher)
        print("HybridSearcher 사전 로딩 완료")
    except Exception as e:
        print(f"HybridSearcher 사전 로딩 실패 (요청 시 로딩): {e}")
    yield


app = FastAPI(title="BenePick API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
