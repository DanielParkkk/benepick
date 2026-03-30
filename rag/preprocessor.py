import pandas as pd
import os

def load_data(path="data/raw/welfare_policies.csv"):
    df = pd.read_csv(path, encoding="utf-8-sig")
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
    return chunks

# ── 정부24 함수들 
def load_gov24_data(path="data/raw/gov24_policies.csv"):
    df = pd.read_csv(path, encoding="utf-8-sig")
    print(f"정부24 데이터 로드 완료! {len(df)}건")
    return df

def make_gov24_chunks(df):
    chunks = []
    for _, row in df.iterrows():
        text = f"""정책명: {row['서비스명']}
서비스분야: {row['서비스분야']}
지원대상: {row['지원대상']}
지원내용: {row['지원내용']}
선정기준: {row['선정기준']}
신청방법: {row['신청방법']}
신청기한: {row['신청기한']}
소관기관: {row['소관기관명']}
전화문의: {row['전화문의']}""".strip()

        chunks.append({
            "chunk_id":    f"{row['서비스ID']}_01",
            "policy_id":   str(row['서비스ID']),
            "text":        text,
            "policy_name": row['서비스명'],
            "category":    row['서비스분야'],
            "region":      "전국",
            "source_url":  row['상세조회URL'],
        })

    print(f"정부24 청킹 완료! {len(chunks)}개 청크 생성")
    return chunks

if __name__ == "__main__":
    # 복지로
    df = load_data()
    chunks = make_chunks(df)
    print("\n샘플 청크:")
    print(chunks[0]["text"])

    # 정부24
    df_gov24 = load_gov24_data()
    chunks_gov24 = make_gov24_chunks(df_gov24)
    print("\n정부24 샘플 청크:")
    print(chunks_gov24[0]["text"])