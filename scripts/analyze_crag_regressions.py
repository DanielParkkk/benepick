from __future__ import annotations

import argparse
import re
from datetime import datetime
from pathlib import Path

import pandas as pd


INTENT_RULES: dict[str, tuple[str, ...]] = {
    "target_youth": ("청년", "대학생", "사회초년생"),
    "target_elderly": ("고령자", "노인", "어르신", "치매", "기초연금"),
    "target_disabled": ("장애", "장애인", "발달장애", "중증장애", "청각장애"),
    "target_child_youth": ("아동", "청소년", "학교 밖", "보호종료", "자립준비"),
    "target_family": ("한부모", "조손", "입양", "다문화", "신혼부부", "가족"),
    "target_low_income": ("저소득", "기초생활", "수급", "차상위", "위기", "긴급복지"),
    "target_small_business": ("소상공인", "자영업", "창업", "폐업", "저신용"),
    "target_farmer": ("농어업", "농업인", "어업인", "농어업인"),
    "benefit_housing": ("월세", "전세", "주거", "주택", "임대", "임차", "보증금", "반지하", "고시원"),
    "benefit_housing_repair": ("개보수", "수선", "집수리", "주거 안전", "편의 개선", "주거편의"),
    "benefit_deposit_loan": ("보증금", "임차보증금", "전세대출", "전월세", "이자"),
    "benefit_employment": ("취업", "구직", "재취업", "실업", "실직", "고용", "면접"),
    "benefit_training": ("직업훈련", "훈련", "국비", "내일배움", "훈련비", "교통비", "식비"),
    "benefit_job_counseling": ("이력서", "자소서", "취업상담", "컨설팅"),
    "benefit_digital_education": ("디지털 역량", "디지털 교육", "디지털 문해", "디지털 배움", "디지털"),
    "benefit_education_device": ("디지털 기기", "기기 지원", "교육정보화", "정보화"),
    "benefit_online_night_education": ("직장인", "야간", "온라인", "온·오프라인", "온오프라인", "K-디지털", "일학습병행"),
    "benefit_scholarship_tuition": ("장학", "장학금", "등록금", "학자금", "대학원", "연구장학"),
    "benefit_school_out": ("검정고시", "학교 밖"),
    "benefit_medical": ("의료", "병원", "치료", "건강", "검진", "치과", "재활"),
    "benefit_mental": ("정신건강", "심리", "상담", "우울"),
    "benefit_assistive_device": ("보청기", "휠체어", "보조기기"),
    "benefit_living": ("생계", "생활비", "난방비", "에너지", "바우처", "자활", "주거급여"),
    "benefit_family_care": ("출산", "육아", "보육", "양육", "영유아", "아이돌봄", "돌봄"),
    "benefit_finance": ("자산", "적금", "저축", "금융", "도약계좌", "희망저축", "근로장려", "자녀장려", "신용회복"),
}


GENERIC_DRIFT_TERMS: dict[str, tuple[str, ...]] = {
    "generic_vocational_training": ("한국폴리텍", "직업훈련", "훈련장려금", "산재근로자 직업훈련", "훈련연장급여"),
    "generic_youth_housing": ("청년월세", "청년 매입임대", "청년 주거", "청년 취업자 주거비"),
    "generic_low_income_insurance": ("국민건강보험료", "저소득층 국민건강보험료"),
    "generic_scholarship": ("대학생 장학금", "장학금 지원", "기장군 장학금"),
    "generic_low_income_living": ("저소득 주민", "저소득층 지원", "저소득 위기가정"),
}


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _safe_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value)


def _split_names(value: object) -> list[str]:
    text = _safe_text(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"\s*\|\s*", text) if part.strip()]


def _hit_flags(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    rank = pd.to_numeric(out["first_hit_rank"], errors="coerce")
    out["hit_at_1_calc"] = (rank == 1).astype(int)
    out["hit_at_3_calc"] = ((rank >= 1) & (rank <= 3)).astype(int)
    out["hit_at_5_calc"] = ((rank >= 1) & (rank <= 5)).astype(int)
    out["miss_topk_calc"] = rank.isna().astype(int)
    out["rank_score"] = pd.to_numeric(out["rank_score"], errors="coerce").fillna(0.0)
    return out


def detect_intents(question: str) -> list[str]:
    text = _safe_text(question).lower()
    return [name for name, terms in INTENT_RULES.items() if _contains_any(text, terms)]


def detect_predicted_drift(question: str, predicted_names: object) -> list[str]:
    question_intents = set(detect_intents(question))
    predicted_text = " | ".join(_split_names(predicted_names)).lower()
    drift: list[str] = []

    for label, terms in GENERIC_DRIFT_TERMS.items():
        if _contains_any(predicted_text, terms):
            drift.append(label)

    if "target_elderly" in question_intents and "청년" in predicted_text and not _contains_any(predicted_text, INTENT_RULES["target_elderly"]):
        drift.append("target_drift_elderly_to_youth")
    if "target_disabled" in question_intents and "청년" in predicted_text and not _contains_any(predicted_text, INTENT_RULES["target_disabled"]):
        drift.append("target_drift_disabled_to_youth")
    if "benefit_scholarship_tuition" in question_intents and _contains_any(predicted_text, INTENT_RULES["benefit_training"]) and not _contains_any(predicted_text, INTENT_RULES["benefit_scholarship_tuition"]):
        drift.append("benefit_drift_scholarship_to_training")
    if "benefit_digital_education" in question_intents and _contains_any(predicted_text, INTENT_RULES["benefit_training"]) and not _contains_any(predicted_text, ("디지털", "정보화")):
        drift.append("benefit_drift_digital_to_training")
    if "benefit_living" in question_intents and "한국폴리텍" in predicted_text:
        drift.append("benefit_drift_living_to_training")
    if "benefit_medical" in question_intents and "국민건강보험료" in predicted_text and not _contains_any(predicted_text, ("치료", "검진", "상담", "재활", "의료")):
        drift.append("benefit_drift_medical_to_insurance")
    if "benefit_online_night_education" in question_intents and _contains_any(predicted_text, ("취약계층 온라인", "방과후", "특수교육", "교육정보화")) and not _contains_any(predicted_text, ("직장인", "소상공인", "온·오프라인", "온오프라인", "k-디지털", "K-디지털", "일학습병행")):
        drift.append("benefit_drift_online_night_to_generic_education")

    return sorted(set(drift))


def load_detail(path: Path) -> pd.DataFrame:
    detail = pd.read_csv(path, encoding="utf-8-sig")
    required = {
        "mode",
        "question",
        "category",
        "expected_policy_names",
        "predicted_policy_names_topk",
        "first_hit_rank",
        "rank_score",
    }
    missing = sorted(required - set(detail.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    return _hit_flags(detail)


def build_question_compare(detail: pd.DataFrame, baseline_mode: str, test_mode: str) -> pd.DataFrame:
    keep = [
        "question",
        "category",
        "expected_policy_names",
        "predicted_policy_names_topk",
        "first_hit_rank",
        "rank_score",
        "rank_issue",
        "latency_ms",
    ]
    baseline = detail[detail["mode"].eq(baseline_mode)][keep].copy()
    test = detail[detail["mode"].eq(test_mode)][keep].copy()
    merged = baseline.merge(test, on="question", how="outer", suffixes=("_baseline", "_test"))
    merged["category"] = merged["category_test"].fillna(merged["category_baseline"])
    merged["expected_policy_names"] = merged["expected_policy_names_test"].fillna(merged["expected_policy_names_baseline"])
    merged["score_delta"] = merged["rank_score_test"].fillna(0) - merged["rank_score_baseline"].fillna(0)
    merged["baseline_hit5"] = pd.to_numeric(merged["first_hit_rank_baseline"], errors="coerce").between(1, 5)
    merged["test_hit5"] = pd.to_numeric(merged["first_hit_rank_test"], errors="coerce").between(1, 5)
    merged["regression_type"] = "same_or_minor"
    merged.loc[merged["score_delta"] > 0, "regression_type"] = "improved"
    merged.loc[merged["score_delta"] < 0, "regression_type"] = "worsened"
    merged.loc[merged["baseline_hit5"] & ~merged["test_hit5"], "regression_type"] = "baseline_hit_crag_miss"
    merged["question_intents"] = merged["question"].map(lambda q: "|".join(detect_intents(q)))
    merged["predicted_drift_flags"] = merged.apply(
        lambda row: "|".join(detect_predicted_drift(row["question"], row["predicted_policy_names_topk_test"])),
        axis=1,
    )
    return merged


def category_summary(compare: pd.DataFrame) -> pd.DataFrame:
    return (
        compare.groupby("category", dropna=False)
        .agg(
            num_questions=("question", "count"),
            baseline_avg_score=("rank_score_baseline", "mean"),
            test_avg_score=("rank_score_test", "mean"),
            avg_delta=("score_delta", "mean"),
            baseline_hit_test_miss=("regression_type", lambda s: int((s == "baseline_hit_crag_miss").sum())),
            worsened=("regression_type", lambda s: int((s == "worsened").sum())),
            improved=("regression_type", lambda s: int((s == "improved").sum())),
        )
        .reset_index()
        .sort_values(["baseline_hit_test_miss", "avg_delta"], ascending=[False, True])
    )


def intent_summary(compare: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for _, row in compare.iterrows():
        intents = [item for item in _safe_text(row["question_intents"]).split("|") if item]
        if not intents:
            intents = ["no_intent_detected"]
        for intent in intents:
            rows.append({
                "intent": intent,
                "score_delta": row["score_delta"],
                "regression_type": row["regression_type"],
                "drift_flags": row["predicted_drift_flags"],
            })
    expanded = pd.DataFrame(rows)
    return (
        expanded.groupby("intent", dropna=False)
        .agg(
            num_questions=("intent", "count"),
            avg_delta=("score_delta", "mean"),
            baseline_hit_crag_miss=("regression_type", lambda s: int((s == "baseline_hit_crag_miss").sum())),
            worsened=("regression_type", lambda s: int((s == "worsened").sum())),
            improved=("regression_type", lambda s: int((s == "improved").sum())),
            drift_flagged=("drift_flags", lambda s: int((s.fillna("") != "").sum())),
        )
        .reset_index()
        .sort_values(["baseline_hit_crag_miss", "avg_delta"], ascending=[False, True])
    )


def write_markdown_report(
    output_path: Path,
    compare: pd.DataFrame,
    by_category: pd.DataFrame,
    by_intent: pd.DataFrame,
    baseline_mode: str,
    test_mode: str,
) -> None:
    def md_table(frame: pd.DataFrame) -> str:
        if frame.empty:
            return "_No rows._"
        printable = frame.fillna("").astype(str)
        headers = list(printable.columns)
        rows = printable.values.tolist()
        lines = [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join(["---"] * len(headers)) + " |",
        ]
        for row in rows:
            escaped = [cell.replace("|", "\\|").replace("\n", " ") for cell in row]
            lines.append("| " + " | ".join(escaped) + " |")
        return "\n".join(lines)

    total = len(compare)
    hard_regressions = int((compare["regression_type"] == "baseline_hit_crag_miss").sum())
    worsened = int((compare["score_delta"] < 0).sum())
    improved = int((compare["score_delta"] > 0).sum())

    worst_questions = compare.sort_values(["score_delta", "question"]).head(15)
    lines = [
        "# CRAG Regression Audit",
        "",
        f"- generated_at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- baseline_mode: `{baseline_mode}`",
        f"- test_mode: `{test_mode}`",
        f"- total_questions: {total}",
        f"- baseline_hit_crag_miss: {hard_regressions}",
        f"- worsened: {worsened}",
        f"- improved: {improved}",
        "",
        "## Category Hotspots",
        "",
        md_table(by_category.head(10)),
        "",
        "## Intent Hotspots",
        "",
        md_table(by_intent.head(15)),
        "",
        "## Worst Questions",
        "",
        md_table(worst_questions[
            [
                "question",
                "category",
                "first_hit_rank_baseline",
                "first_hit_rank_test",
                "rank_score_baseline",
                "rank_score_test",
                "score_delta",
                "question_intents",
                "predicted_drift_flags",
            ]
        ]),
        "",
        "## How To Use",
        "",
        "- `baseline_hit_crag_miss` means the baseline found an answer in Top-K, but CRAG pushed it out.",
        "- Prioritize rows with drift flags because they reveal wrong fallback direction, not just normal ranking noise.",
        "- Add or tune fallback rules for the worst intent groups first, then rerun the same audit.",
    ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit rank-order regressions introduced by rerank_crag.")
    parser.add_argument("--detail", required=True, type=Path, help="rank_order_detail CSV with multiple modes.")
    parser.add_argument("--output-dir", type=Path, default=None, help="Directory for audit CSV/MD outputs.")
    parser.add_argument("--baseline-mode", default="rerank_only")
    parser.add_argument("--test-mode", default="rerank_crag")
    args = parser.parse_args()

    detail = load_detail(args.detail)
    output_dir = args.output_dir or (args.detail.parent / f"crag_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    output_dir.mkdir(parents=True, exist_ok=True)

    compare = build_question_compare(detail, args.baseline_mode, args.test_mode)
    regressions = compare[compare["regression_type"].isin(["baseline_hit_crag_miss", "worsened"])].copy()
    misses = compare[compare["regression_type"].eq("baseline_hit_crag_miss")].copy()
    by_category = category_summary(compare)
    by_intent = intent_summary(compare)

    compare.to_csv(output_dir / "question_compare.csv", index=False, encoding="utf-8-sig")
    regressions.to_csv(output_dir / "crag_regressions.csv", index=False, encoding="utf-8-sig")
    misses.to_csv(output_dir / "baseline_hit_crag_miss.csv", index=False, encoding="utf-8-sig")
    by_category.to_csv(output_dir / "category_hotspots.csv", index=False, encoding="utf-8-sig")
    by_intent.to_csv(output_dir / "intent_hotspots.csv", index=False, encoding="utf-8-sig")
    write_markdown_report(output_dir / "crag_regression_audit.md", compare, by_category, by_intent, args.baseline_mode, args.test_mode)

    print(f"output_dir: {output_dir}")
    print(f"question_compare: {output_dir / 'question_compare.csv'}")
    print(f"crag_regressions: {output_dir / 'crag_regressions.csv'}")
    print(f"baseline_hit_crag_miss: {output_dir / 'baseline_hit_crag_miss.csv'}")
    print(f"category_hotspots: {output_dir / 'category_hotspots.csv'}")
    print(f"intent_hotspots: {output_dir / 'intent_hotspots.csv'}")
    print(f"markdown_report: {output_dir / 'crag_regression_audit.md'}")


if __name__ == "__main__":
    main()
