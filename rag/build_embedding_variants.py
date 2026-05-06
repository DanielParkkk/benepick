"""Build dense embedding files for alternate RAG embedding models.

Default output naming matches rag.searcher:
- processed/embeddings_<model_slug>.npy
- processed/gov24/embeddings_<model_slug>.npy

Example:
    python rag/build_embedding_variants.py --model google/embeddinggemma-300m
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

PROCESSED_PATH = PROJECT_ROOT / "processed"


def embedding_slug(model_name: str) -> str:
    return re.sub(r"[^0-9A-Za-z._-]+", "_", str(model_name or "").strip()).strip("_").lower()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build BenePick dense embedding variants.")
    parser.add_argument("--model", default=os.getenv("BENEPICK_EMBED_MODEL", "google/embeddinggemma-300m"))
    parser.add_argument("--device", default=os.getenv("BENEPICK_EMBED_DEVICE", "cpu"))
    parser.add_argument("--batch-size", type=int, default=int(os.getenv("BENEPICK_EMBED_BATCH_SIZE", "16")))
    parser.add_argument("--limit", type=int, default=0, help="Smoke-test limit. 0 encodes all rows.")
    parser.add_argument("--hf-token", default=os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN") or "")
    parser.add_argument("--trust-remote-code", action="store_true", default=os.getenv("BENEPICK_EMBED_TRUST_REMOTE_CODE", "0") == "1")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def encode_file(
    model: SentenceTransformer,
    input_csv: Path,
    output_npy: Path,
    batch_size: int,
    overwrite: bool,
    limit: int,
) -> None:
    if output_npy.exists() and not overwrite:
        print(f"skip existing: {output_npy}")
        return

    frame = pd.read_csv(input_csv).fillna("")
    if "text" not in frame.columns:
        raise ValueError(f"{input_csv} must contain a text column")

    if limit and limit > 0:
        frame = frame.head(limit).copy()
    texts = frame["text"].astype(str).tolist()
    print(f"encode {len(texts)} rows -> {output_npy}")
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    output_npy.parent.mkdir(parents=True, exist_ok=True)
    np.save(output_npy, np.asarray(embeddings, dtype=np.float32))
    print(f"saved: {output_npy}")


def main() -> None:
    args = parse_args()
    slug = embedding_slug(args.model)
    output_slug = f"{slug}_smoke{args.limit}" if args.limit and args.limit > 0 else slug

    os.environ.setdefault("HF_HOME", str(PROJECT_ROOT / ".cache" / "huggingface"))
    os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(PROJECT_ROOT / ".cache" / "huggingface" / "sentence-transformers"))

    print(f"embedding model: {args.model}")
    print(f"device: {args.device}")
    print(f"slug: {slug}")
    if output_slug != slug:
        print(f"smoke output slug: {output_slug}")

    model_kwargs = {
        "device": args.device,
        "trust_remote_code": args.trust_remote_code,
    }
    if args.hf_token:
        model_kwargs["token"] = args.hf_token

    try:
        model = SentenceTransformer(args.model, **model_kwargs)
    except OSError as exc:
        message = str(exc)
        if "gated repo" in message.lower() or "401" in message:
            raise RuntimeError(
                "Embedding model access is gated. Accept the model terms and set "
                "HF_TOKEN or HUGGINGFACE_HUB_TOKEN before running this script."
            ) from exc
        raise

    encode_file(
        model,
        PROCESSED_PATH / "chunks.csv",
        PROCESSED_PATH / f"embeddings_{output_slug}.npy",
        args.batch_size,
        args.overwrite,
        args.limit,
    )
    encode_file(
        model,
        PROCESSED_PATH / "gov24" / "chunks.csv",
        PROCESSED_PATH / "gov24" / f"embeddings_{output_slug}.npy",
        args.batch_size,
        args.overwrite,
        args.limit,
    )


if __name__ == "__main__":
    main()
