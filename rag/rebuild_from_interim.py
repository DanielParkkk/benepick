from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import chromadb
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer


PROJECT_ROOT = Path(__file__).resolve().parents[1]
INTERIM_PATH = PROJECT_ROOT / "rag" / "interim_results_20260414_1252.json"
PROCESSED_DIR = PROJECT_ROOT / "processed"
PROCESSED_GOV24_DIR = PROCESSED_DIR / "gov24"
CHROMA_PATH = PROJECT_ROOT / "chroma_db"
COLLECTION_NAME = "benepick_policies"
EMBED_MODEL = "BAAI/bge-m3"


def _pick_value(text: str, key: str) -> str:
    m = re.search(rf"{re.escape(key)}:\s*(.+)", text)
    return (m.group(1).strip() if m else "").replace("\r", " ").replace("\n", " ")


def _make_policy_id(name: str) -> str:
    base = name.strip() or "unknown-policy"
    return hashlib.md5(base.encode("utf-8")).hexdigest()[:10]


def _load_rows() -> list[dict]:
    with INTERIM_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    return payload.get("rows", [])


def build_chunks() -> pd.DataFrame:
    rows = _load_rows()
    items: list[dict] = []
    seen_text: set[str] = set()
    counts_by_policy: dict[str, int] = {}

    for row in rows:
        for ctx in row.get("contexts", []):
            text = str(ctx or "").strip()
            if not text or text in seen_text:
                continue
            seen_text.add(text)

            policy_name = _pick_value(text, "정책명")
            category = _pick_value(text, "서비스분야") or "기타"
            region = _pick_value(text, "소관기관") or _pick_value(text, "소관부처") or "전국"
            source_url = ""
            policy_id = _make_policy_id(policy_name)

            counts_by_policy[policy_id] = counts_by_policy.get(policy_id, 0) + 1
            chunk_id = f"{policy_id}_{counts_by_policy[policy_id]:03d}"

            items.append(
                {
                    "chunk_id": chunk_id,
                    "policy_id": policy_id,
                    "policy_name": policy_name or "정책 정보",
                    "category": category,
                    "region": region,
                    "source_url": source_url,
                    "text": text,
                }
            )

    return pd.DataFrame(items)


def save_processed(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray, pd.DataFrame, np.ndarray]:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_GOV24_DIR.mkdir(parents=True, exist_ok=True)

    # 기존 코드가 welfare/gov24 두 파일을 모두 읽기 때문에 반으로 분할 저장
    mask = np.arange(len(df)) % 2 == 0
    df_welfare = df[mask].reset_index(drop=True)
    df_gov24 = df[~mask].reset_index(drop=True)

    model = SentenceTransformer(EMBED_MODEL, device="cpu")
    emb_welfare = model.encode(df_welfare["text"].tolist(), normalize_embeddings=True)
    emb_gov24 = model.encode(df_gov24["text"].tolist(), normalize_embeddings=True)

    df_welfare.to_csv(PROCESSED_DIR / "chunks.csv", index=False, encoding="utf-8-sig")
    df_gov24.to_csv(PROCESSED_GOV24_DIR / "chunks.csv", index=False, encoding="utf-8-sig")
    np.save(PROCESSED_DIR / "embeddings.npy", np.array(emb_welfare, dtype=np.float32))
    np.save(PROCESSED_GOV24_DIR / "embeddings.npy", np.array(emb_gov24, dtype=np.float32))

    return df_welfare, np.array(emb_welfare), df_gov24, np.array(emb_gov24)


def rebuild_chroma(df_all: pd.DataFrame, emb_all: np.ndarray) -> int:
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
    metadatas = [
        {
            "policy_id": str(row["policy_id"]),
            "policy_name": str(row["policy_name"]),
            "category": str(row["category"]),
            "region": str(row["region"]),
            "source_url": str(row["source_url"]),
        }
        for _, row in df_all.iterrows()
    ]

    batch_size = 512
    ids = df_all["chunk_id"].tolist()
    docs = df_all["text"].tolist()
    vecs = emb_all.tolist()
    for i in range(0, len(ids), batch_size):
        j = i + batch_size
        collection.add(ids=ids[i:j], embeddings=vecs[i:j], documents=docs[i:j], metadatas=metadatas[i:j])

    return collection.count()


if __name__ == "__main__":
    df = build_chunks()
    if df.empty:
        raise RuntimeError("interim 파일에서 정책 컨텍스트를 찾지 못했습니다.")

    df_welfare, emb_welfare, df_gov24, emb_gov24 = save_processed(df)
    df_all = pd.concat([df_welfare, df_gov24], ignore_index=True)
    emb_all = np.vstack([emb_welfare, emb_gov24])
    count = rebuild_chroma(df_all, emb_all)

    print(f"rebuild done: welfare={len(df_welfare)}, gov24={len(df_gov24)}, total={count}")
