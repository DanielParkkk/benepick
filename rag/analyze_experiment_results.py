import argparse
from pathlib import Path

import pandas as pd


COLUMN_ALIASES = {
    "question": ["question", "질문"],
    "success": ["success", "성공여부"],
    "top1_score": ["top1_score", "상위1점수"],
    "avg_doc_score": ["avg_doc_score", "평균문서점수"],
    "ragas_average": ["ragas_average", "avg_ragas_score", "RAGAS_평균점수"],
    "elapsed_sec": ["elapsed_sec", "총소요시간_초"],
    "answer": ["answer", "답변"],
    "top_policy_name": ["top_policy_name", "상위정책명"],
}


def _find_column(df: pd.DataFrame, names: list[str]) -> str | None:
    for name in names:
        if name in df.columns:
            return name
    return None


def _normalize_success(series: pd.Series) -> pd.Series:
    if series.dtype == bool:
        return series

    normalized = series.astype(str).str.strip().str.lower()
    truthy = {"true", "1", "yes", "y", "t", "성공", "정상"}
    return normalized.isin(truthy)


def _safe_numeric(series: pd.Series | None) -> pd.Series:
    if series is None:
        return pd.Series(dtype=float)
    return pd.to_numeric(series, errors="coerce")


def _weighted_score(df: pd.DataFrame) -> pd.Series:
    # Ignore missing metrics per row and renormalize by available weights.
    weights = {
        "top1_score_norm": 0.4,
        "avg_doc_score_norm": 0.2,
        "ragas_average_norm": 0.4,
    }
    weighted_sum = pd.Series(0.0, index=df.index)
    used_weight = pd.Series(0.0, index=df.index)

    for col, w in weights.items():
        if col not in df.columns:
            continue
        valid = df[col].notna()
        weighted_sum[valid] += df.loc[valid, col] * w
        used_weight[valid] += w

    score = weighted_sum / used_weight.replace(0, pd.NA)
    return score


def analyze(input_path: Path, output_path: Path, bottom_n: int = 20) -> None:
    df = pd.read_excel(input_path, sheet_name=0)

    col_question = _find_column(df, COLUMN_ALIASES["question"])
    col_success = _find_column(df, COLUMN_ALIASES["success"])
    col_top1 = _find_column(df, COLUMN_ALIASES["top1_score"])
    col_avg_doc = _find_column(df, COLUMN_ALIASES["avg_doc_score"])
    col_ragas_avg = _find_column(df, COLUMN_ALIASES["ragas_average"])
    col_elapsed = _find_column(df, COLUMN_ALIASES["elapsed_sec"])
    col_answer = _find_column(df, COLUMN_ALIASES["answer"])
    col_policy = _find_column(df, COLUMN_ALIASES["top_policy_name"])

    if col_question is None:
        raise ValueError("Question column not found in input file.")
    if col_success is None:
        raise ValueError("Success column not found in input file.")

    working = df.copy()
    working["success_norm"] = _normalize_success(working[col_success])
    working["top1_score_norm"] = _safe_numeric(working[col_top1]) if col_top1 else pd.NA
    working["avg_doc_score_norm"] = _safe_numeric(working[col_avg_doc]) if col_avg_doc else pd.NA
    working["ragas_average_norm"] = _safe_numeric(working[col_ragas_avg]) if col_ragas_avg else pd.NA

    success_df = working[working["success_norm"]].copy()
    success_df["composite_score"] = _weighted_score(success_df)
    success_df["score_gap"] = 1.0 - success_df["composite_score"]

    low_candidates = success_df.sort_values(["composite_score"], ascending=True).head(bottom_n).copy()

    output_columns = [col_question]
    if col_answer:
        output_columns.append(col_answer)
    if col_policy:
        output_columns.append(col_policy)
    if col_elapsed:
        output_columns.append(col_elapsed)
    if col_top1:
        output_columns.append(col_top1)
    if col_avg_doc:
        output_columns.append(col_avg_doc)
    if col_ragas_avg:
        output_columns.append(col_ragas_avg)

    output_columns += ["composite_score", "score_gap"]
    low_export = low_candidates[output_columns]

    summary = pd.DataFrame(
        [
            {
                "input_file": str(input_path),
                "total_rows": len(df),
                "success_rows": int(working["success_norm"].sum()),
                "analyzed_rows": len(success_df),
                "bottom_n": bottom_n,
                "avg_top1_score": success_df["top1_score_norm"].mean()
                if "top1_score_norm" in success_df.columns
                else None,
                "avg_doc_score": success_df["avg_doc_score_norm"].mean()
                if "avg_doc_score_norm" in success_df.columns
                else None,
                "avg_ragas_score": success_df["ragas_average_norm"].mean()
                if "ragas_average_norm" in success_df.columns
                else None,
                "avg_composite_score": success_df["composite_score"].mean(),
            }
        ]
    )

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        summary.to_excel(writer, index=False, sheet_name="summary")
        low_export.to_excel(writer, index=False, sheet_name=f"low_score_top{bottom_n}")

    print(f"Saved analysis file: {output_path}")
    print(f"Rows analyzed: {len(success_df)} / {len(df)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract low-score questions from BenePick experiment result Excel.")
    parser.add_argument("--input", required=True, help="Input .xlsx path")
    parser.add_argument("--output", default="", help="Output .xlsx path (optional)")
    parser.add_argument("--bottom-n", type=int, default=20, help="How many low-score rows to export")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
    else:
        output_path = input_path.with_name(input_path.stem + "_analysis.xlsx")

    analyze(input_path=input_path, output_path=output_path, bottom_n=args.bottom_n)


if __name__ == "__main__":
    main()
