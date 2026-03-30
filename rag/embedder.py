import pandas as pd
import numpy as np
import os
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"

def load_data(path="data/raw/welfare_policies.csv"):
    df = pd.read_csv(path)
    print(f"데이터 로드 완료! {len(df)}건")
    return df

def make_chunks(df):
    chunks = []
    for _, row in df.iterrows():
        text = f"""정책명: {row['서비스명']}
소관부처: {row['소관부처명']}
소관조직: {row['소관조직명']}
서비스요약: {row['서비스요약']}
대표문의: {row['대표문의']}
서비스URL: {row['서비스URL']}""".strip()

        chunks.append({
            "chunk_id":    f"{row['서비스아이디']}_01",
            "policy_id":   str(row['서비스아이디']),
            "text":        text,
            "policy_name": row['서비스명'],
            "category":    row['소관부처명'],
            "region":      "전국",
            "source_url":  row['서비스URL'],
        })

    print(f"청킹 완료! {len(chunks)}개 청크 생성")
    print(f"\n샘플 청크:\n{chunks[0]['text']}")
    return chunks

def create_embeddings(chunks):
    print(f"\nBGE-M3 모델 로딩 중... (처음 실행 시 다운로드 2GB, 시간이 걸려요)")
    model = SentenceTransformer(MODEL_NAME)

    texts = [c["text"] for c in chunks]
    print(f"\n임베딩 생성 중... ({len(texts)}개 청크)")

    embeddings = model.encode(
        texts,
        batch_size=8,
        show_progress_bar=True,
        normalize_embeddings=True
    )

    print(f"\n임베딩 완료!")
    print(f"shape: {embeddings.shape}")
    print(f"벡터 예시 (앞 5개 값): {embeddings[0][:5]}")
    return embeddings, model

def save_embeddings(chunks, embeddings, path="data/processed/"):
    os.makedirs(path, exist_ok=True)

    df_chunks = pd.DataFrame([{
        "chunk_id":    c["chunk_id"],
        "policy_id":   c["policy_id"],
        "policy_name": c["policy_name"],
        "category":    c["category"],
        "region":      c["region"],
        "source_url":  c["source_url"],
        "text":        c["text"],
    } for c in chunks])

    df_chunks.to_csv(f"{path}chunks.csv", index=False, encoding="utf-8-sig")
    np.save(f"{path}embeddings.npy", embeddings)

    print(f"\n저장 완료!")
    print(f"  청크 메타: {path}chunks.csv")
    print(f"  임베딩 벡터: {path}embeddings.npy")
    print(f"  벡터 shape: {embeddings.shape}")

if __name__ == "__main__":
    # 모델 한 번만 로딩
    print("\nBGE-M3 모델 로딩 중...")
    model = SentenceTransformer(MODEL_NAME)

    # 복지로 임베딩
    df = load_data()
    chunks = make_chunks(df)
    texts = [c["text"] for c in chunks]
    print(f"\n복지로 임베딩 생성 중... ({len(texts)}개)")
    embeddings = model.encode(texts, batch_size=8, show_progress_bar=True, normalize_embeddings=True)
    save_embeddings(chunks, embeddings)

    # 정부24 임베딩
    from preprocessor import load_gov24_data, make_gov24_chunks
    df_gov24 = load_gov24_data()
    chunks_gov24 = make_gov24_chunks(df_gov24)
    texts_gov24 = [c["text"] for c in chunks_gov24]
    print(f"\n정부24 임베딩 생성 중... ({len(texts_gov24)}개)")
    embeddings_gov24 = model.encode(texts_gov24, batch_size=8, show_progress_bar=True, normalize_embeddings=True)
    save_embeddings(chunks_gov24, embeddings_gov24, path="data/processed/gov24/")

    print("\n전체 임베딩 파이프라인 완료!")