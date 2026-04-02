from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pipeline import benepick_rag

app = FastAPI(title="BenePick RAG API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserCondition(BaseModel):
    age: int | None = None
    region: str | None = None
    income_level: str | None = None
    household_type: str | None = None
    employment_status: str | None = None
    housing_type: str | None = None


class SearchRequest(BaseModel):
    query: str
    user_condition: UserCondition | None = None
    lang_code: str = "ko"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/rag/search")
def rag_search(req: SearchRequest) -> dict:
    condition = req.user_condition.model_dump(exclude_none=True) if req.user_condition else None
    return benepick_rag(
        user_query=req.query,
        lang_code=req.lang_code,
        user_condition=condition,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=False)
