"""
ChromaDB HNSW 인덱스 재구축 (rebuild_chroma.py)
──────────────────────────────────────────────
RAM 크래쉬로 chroma_db/ 아래 바이너리 파일이 삭제된 경우 이 스크립트를 실행합니다.
processed/embeddings.npy + processed/chunks.csv 를 읽어 새 컬렉션을 생성합니다.

실행: cd <project_root>  &&  python rag/rebuild_chroma.py
"""

import os
import stat
import numpy as np
import pandas as pd
import chromadb
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHROMA_PATH = Path(os.environ.get("LOCALAPPDATA", str(PROJECT_ROOT))) / "BenePick" / "chroma_db"


def _is_onedrive_path(path: Path) -> bool:
    normalized = str(path).lower()
    onedrive_root = os.environ.get("OneDrive") or os.environ.get("OneDriveCommercial") or ""
    if onedrive_root and normalized.startswith(str(Path(onedrive_root)).lower()):
        return True
    return "onedrive" in normalized


def _resolve_chroma_path() -> Path:
    configured = os.environ.get("BENEPICK_CHROMA_PATH")
    if configured:
        return Path(configured)

    project_path = PROJECT_ROOT / "chroma_db"
    if project_path.exists() and not _is_onedrive_path(project_path):
        return project_path

    return DEFAULT_CHROMA_PATH


CHROMA_PATH = _resolve_chroma_path()
PROCESSED    = PROJECT_ROOT / "processed"
COLLECTION   = "benepick_policies"
BATCH_SIZE   = 500


# ── Windows OneDrive 잠금 우회 삭제 ──────────────────────────────
def _force_remove(path: Path) -> bool:
    """읽기전용·OneDrive 잠금을 우회하며 디렉터리를 삭제. 성공 여부 반환."""
    if not path.exists():
        return True

    # 1차: 파일별 읽기전용 해제 후 rmtree
    def _on_error(func, fpath, exc_info):
        try:
            os.chmod(fpath, stat.S_IWRITE)
            func(fpath)
        except Exception:
            pass

    shutil.rmtree(path, onerror=_on_error)
    if not path.exists():
        return True

    # 2차: Windows rd 명령 (OneDrive 잠금 풀린 직후 재시도)
    if sys.platform == "win32":
        result = subprocess.run(
            ["rd", "/s", "/q", str(path)],
            shell=True, capture_output=True
        )
        if not path.exists():
            return True

    # 3차: 내부 파일만 지우기 (디렉터리 구조는 남겨도 됨)
    print("  WARN: directory delete failed, removing internal files only.")
    for f in path.rglob("*"):
        if f.is_file():
            try:
                os.chmod(f, stat.S_IWRITE)
                f.unlink()
            except Exception:
                pass
    return False


def load_source(name: str, csv_path: Path, npy_path: Path):
    print(f"\n[{name}] CSV 로딩: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"  -> rows: {len(df)}")

    print(f"[{name}] 임베딩 로딩: {npy_path}")
    emb = np.load(npy_path).astype("float32")
    print(f"  -> shape {emb.shape}")

    if len(df) != len(emb):
        raise ValueError(f"[{name}] CSV({len(df)}) ≠ NPY({len(emb)}) 행 수 불일치")

    return df, emb


def upsert_batch(collection, ids, embeddings, metadatas, documents):
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        metadatas=metadatas,
        documents=documents,
    )


def rebuild():
    # ── 기존 chroma_db 삭제 ────────────────────────────────────────
    if CHROMA_PATH.exists():
        print(f"기존 chroma_db 삭제 중: {CHROMA_PATH}")
        deleted = _force_remove(CHROMA_PATH)
        if deleted:
            print("  -> delete complete")
        else:
            print("  -> partial delete failed (likely OneDrive lock). Internal files were cleared.")

    # ── 데이터 로딩 (복지로 + 정부24) ─────────────────────────────
    df_w, emb_w = load_source(
        "복지로",
        PROCESSED / "chunks.csv",
        PROCESSED / "embeddings.npy",
    )
    df_g, emb_g = load_source(
        "정부24",
        PROCESSED / "gov24" / "chunks.csv",
        PROCESSED / "gov24" / "embeddings.npy",
    )

    df_all  = pd.concat([df_w, df_g], ignore_index=True)
    emb_all = np.vstack([emb_w, emb_g])
    print(f"\n전체 합산: {len(df_all)}개 청크 / 임베딩 shape {emb_all.shape}")

    # ── Chroma 클라이언트 & 컬렉션 생성 ───────────────────────────
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    # 기존 컬렉션이 깨진 채로 남아있으면 삭제 후 재생성
    try:
        client.delete_collection(COLLECTION)
        print(f"기존 컬렉션 '{COLLECTION}' 제거")
    except Exception:
        pass  # 없으면 무시

    collection = client.create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    print(f"컬렉션 '{COLLECTION}' 생성 완료")

    # ── 배치 업서트 ────────────────────────────────────────────────
    total = len(df_all)
    for start in range(0, total, BATCH_SIZE):
        end   = min(start + BATCH_SIZE, total)
        batch = df_all.iloc[start:end]

        ids        = batch["chunk_id"].astype(str).tolist()
        embeddings = emb_all[start:end].tolist()
        documents  = batch["text"].fillna("").tolist()
        metadatas  = [
            {
                "policy_id":   str(row.get("policy_id",  "")),
                "policy_name": str(row.get("policy_name","")),
                "category":    str(row.get("category",   "")),
                "region":      str(row.get("region",     "")),
                "source_url":  str(row.get("source_url", "")),
            }
            for _, row in batch.iterrows()
        ]

        upsert_batch(collection, ids, embeddings, metadatas, documents)
        print(f"  업서트 {end}/{total} ({round(end / total * 100)}%)")

    # ── 검증 ──────────────────────────────────────────────────────
    count = collection.count()
    print(f"\nRebuild complete. Collection now has {count} vectors.")
    if count < total * 0.98:
        print(f"WARN: missing {total - count} vectors compared to expected total ({total}). Retry recommended.")
    else:
        print(f"   (예상 {total}개 대비 정상 범위)")

    # ── 간단 검색 테스트 ───────────────────────────────────────────
    print("\n[검색 테스트] 첫 번째 임베딩으로 유사 벡터 3개 조회")
    results = collection.query(
        query_embeddings=[emb_all[0].tolist()],
        n_results=3,
    )
    for i, (cid, dist) in enumerate(zip(results["ids"][0], results["distances"][0]), 1):
        meta = results["metadatas"][0][i - 1]
        print(f"  {i}. [{meta.get('policy_name','?')}]  chunk={cid}  dist={dist:.4f}")

    print("\n이제 백엔드를 기동하세요:")
    print("  uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    rebuild()
