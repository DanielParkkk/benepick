from __future__ import annotations

import argparse
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
import re

import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisProfileState,
    AnalysisResultState,
    PolicyApplication,
    PolicyBenefit,
    PolicyCondition,
    PolicyDocument,
    PolicyLaw,
    PolicyMaster,
    PolicyRelatedLink,
    PolicyTag,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BOKJIRO_CHUNKS = PROJECT_ROOT / "processed" / "chunks.csv"
DEFAULT_GOV24_CHUNKS = PROJECT_ROOT / "processed" / "gov24" / "chunks.csv"

SECTION_LABELS = {
    "정책명",
    "서비스분야",
    "지원대상",
    "지원내용",
    "선정기준",
    "신청방법",
    "신청기한",
    "소관기관",
    "전화문의",
    "소관부처",
    "소관조직",
    "서비스요약",
    "대표문의",
    "구비서류",
    "제출서류",
    "신청서류",
    "관련법령",
}

REGION_WORDS = [
    "서울",
    "부산",
    "대구",
    "인천",
    "광주",
    "대전",
    "울산",
    "세종",
    "경기",
    "강원",
    "충북",
    "충청북도",
    "충남",
    "충청남도",
    "전북",
    "전라북도",
    "전남",
    "전라남도",
    "경북",
    "경상북도",
    "경남",
    "경상남도",
    "제주",
]

TAG_LABELS = {
    "YOUNG_ADULT": "청년",
    "CHILD": "아동",
    "INFANT": "영유아",
    "SENIOR": "노인",
    "DISABLED": "장애인",
    "SINGLE_PARENT": "한부모",
    "MULTICULTURAL": "다문화",
    "LOW_INCOME": "저소득",
    "BASIC_LIVELIHOOD": "기초생활",
    "NEAR_POOR": "차상위",
    "UNEMPLOYED": "미취업",
    "EMPLOYED": "재직",
    "SELF_EMPLOYED": "자영업",
    "SINGLE": "1인 가구",
    "MONTHLY_RENT": "월세",
    "JEONSE": "전세",
    "OWNER_FAMILY_HOME": "자가/가족주택",
}


@dataclass(frozen=True)
class SourceConfig:
    source: str
    path: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed normalized policy tables from processed RAG chunk CSV files."
    )
    parser.add_argument("--source", choices=("all", "bokjiro", "gov24"), default="all")
    parser.add_argument("--bokjiro-path", type=Path, default=DEFAULT_BOKJIRO_CHUNKS)
    parser.add_argument("--gov24-path", type=Path, default=DEFAULT_GOV24_CHUNKS)
    parser.add_argument("--init-tables", action="store_true", help="Create DB tables before seeding.")
    parser.add_argument("--skip-if-populated", action="store_true", help="Exit if policy_master already has rows.")
    parser.add_argument("--clear-existing", action="store_true", help="Delete normalized policy tables before seeding.")
    parser.add_argument("--limit", type=int, default=None, help="Limit total rows for smoke tests.")
    parser.add_argument("--commit-every", type=int, default=500)
    parser.add_argument("--dry-run", action="store_true", help="Parse files and print counts without DB writes.")
    return parser.parse_args()


def clean_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text or text.lower() == "nan":
        return None
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def shorten(value: str | None, max_len: int = 700) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def parse_sections(text: str | None) -> dict[str, str]:
    if not text:
        return {}

    sections: dict[str, list[str]] = {}
    current_label: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        match = re.match(r"^\s*([가-힣A-Za-z0-9·\s]+):\s*(.*)$", line)
        label = match.group(1).strip() if match else None
        if label in SECTION_LABELS:
            current_label = label
            sections.setdefault(label, [])
            first_value = match.group(2).strip()
            if first_value:
                sections[label].append(first_value)
            continue
        if current_label and line.strip():
            sections[current_label].append(line)

    return {key: clean_text("\n".join(lines)) or "" for key, lines in sections.items()}


def first_present(*values: str | None) -> str | None:
    for value in values:
        cleaned = clean_text(value)
        if cleaned:
            return cleaned
    return None


def split_items(value: str | None) -> list[str]:
    text = clean_text(value)
    if not text:
        return []
    candidates = re.split(r"\n+|ㆍ|·|,|/|;| - |\u2022", text)
    items: list[str] = []
    for candidate in candidates:
        item = re.sub(r"^[○\-*ㆍ·\s]+", "", candidate).strip()
        item = re.sub(r"\s+", " ", item)
        if 2 <= len(item) <= 120 and item not in items:
            items.append(item)
    return items[:20]


def contains_any(text: str, keywords: Iterable[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def ordered_unique(items: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


def infer_age_range(text: str) -> tuple[int | None, int | None]:
    ranges: list[tuple[int, int]] = []
    for match in re.finditer(r"(?:만\s*)?(\d{1,2})\s*세\s*[~∼\-부터]+\s*(?:만\s*)?(\d{1,2})\s*세", text):
        left, right = int(match.group(1)), int(match.group(2))
        if 0 < left <= right <= 100:
            ranges.append((left, right))

    min_ages = [int(m.group(1)) for m in re.finditer(r"만\s*(\d{1,2})\s*세\s*(?:이상|부터)", text)]
    max_ages = [int(m.group(1)) for m in re.finditer(r"만\s*(\d{1,2})\s*세\s*(?:이하|까지|미만)", text)]
    if ranges:
        return min(start for start, _ in ranges), max(end for _, end in ranges)
    return (min(min_ages) if min_ages else None, max(max_ages) if max_ages else None)


def infer_income_code(text: str) -> str | None:
    codes: list[str] = []
    if re.search(r"중위소득\s*50\s*%", text):
        codes.append("MID_50_60")
    if re.search(r"중위소득\s*(?:60|70|75|80)\s*%", text):
        codes.append("MID_60_80")
    if re.search(r"중위소득\s*(?:90|100)\s*%", text):
        codes.append("MID_80_100")
    if contains_any(text, ["저소득", "기초생활", "차상위", "생계급여", "의료급여", "주거급여"]):
        codes.append("MID_50_60")
    return ",".join(ordered_unique(codes)) or None


def infer_json_codes(text: str, region: str | None) -> dict[str, list[str] | None]:
    household: list[str] = []
    employment: list[str] = []
    housing: list[str] = []
    life_cycle: list[str] = []
    special: list[str] = []

    if contains_any(text, ["1인 가구", "1인가구", "단독세대", "단독가구"]):
        household.append("SINGLE")
    if contains_any(text, ["한부모", "조손가족"]):
        household.append("SINGLE")
        special.append("SINGLE_PARENT")

    if contains_any(text, ["미취업", "구직", "실업", "취업준비", "일자리"]):
        employment.append("UNEMPLOYED")
    if contains_any(text, ["재직", "근로자", "근로소득", "직장", "취업자"]):
        employment.append("EMPLOYED")
    if contains_any(text, ["자영업", "소상공인", "사업자", "창업", "예비창업"]):
        employment.append("SELF_EMPLOYED")

    if contains_any(text, ["월세", "임차료"]):
        housing.append("MONTHLY_RENT")
    if contains_any(text, ["전세", "보증금"]):
        housing.append("JEONSE")
    if contains_any(text, ["무주택"]):
        housing.extend(["MONTHLY_RENT", "JEONSE"])

    if contains_any(text, ["청년", "대학생", "취업준비생"]):
        life_cycle.append("YOUNG_ADULT")
    if contains_any(text, ["영유아", "유아", "보육"]):
        life_cycle.append("INFANT")
    if contains_any(text, ["아동", "초등학생", "중학생", "고등학생"]):
        life_cycle.append("CHILD")
    if contains_any(text, ["노인", "어르신", "고령", "기초연금"]):
        life_cycle.append("SENIOR")

    if contains_any(text, ["장애", "장애인"]):
        special.append("DISABLED")
    if contains_any(text, ["다문화", "외국인", "이주민"]):
        special.append("MULTICULTURAL")
    if contains_any(text, ["저소득"]):
        special.append("LOW_INCOME")
    if contains_any(text, ["기초생활", "생계급여", "의료급여", "주거급여"]):
        special.append("BASIC_LIVELIHOOD")
    if contains_any(text, ["차상위"]):
        special.append("NEAR_POOR")

    region_codes: list[str] = []
    cleaned_region = clean_text(region)
    if cleaned_region and cleaned_region != "전국":
        region_codes.append(cleaned_region)
    for word in REGION_WORDS:
        if word in text:
            region_codes.append(word)

    return {
        "household": ordered_unique(household) or None,
        "employment": ordered_unique(employment) or None,
        "housing": ordered_unique(housing) or None,
        "life_cycle": ordered_unique(life_cycle) or None,
        "special": ordered_unique(special) or None,
        "region": ordered_unique(region_codes) or None,
    }


def extract_amount_value(text: str | None) -> int | None:
    if not text:
        return None

    amounts: list[int] = []
    normalized = text.replace(",", "")

    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*억", normalized):
        amounts.append(int(float(match.group(1)) * 100_000_000))
    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*천\s*만\s*원?", normalized):
        amounts.append(int(float(match.group(1)) * 10_000_000))
    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*백\s*만\s*원?", normalized):
        amounts.append(int(float(match.group(1)) * 1_000_000))
    for match in re.finditer(r"(\d+(?:\.\d+)?)\s*만\s*원?", normalized):
        amounts.append(int(float(match.group(1)) * 10_000))
    for match in re.finditer(r"(\d{4,})\s*원", normalized):
        amounts.append(int(match.group(1)))

    return max(amounts) if amounts else None


def infer_period_type(text: str | None) -> str:
    value = clean_text(text) or ""
    if contains_any(value, ["상시", "수시", "연중", "계속"]):
        return "ALWAYS"
    if re.search(r"\d{4}[.\-/년]\s*\d{1,2}", value) or contains_any(value, ["부터", "까지", "마감"]):
        return "PERIOD"
    return "UNKNOWN"


def infer_online_apply(text: str | None, url: str | None) -> bool | None:
    blob = f"{text or ''} {url or ''}".lower()
    if contains_any(blob, ["온라인", "인터넷", "정부24", "복지로", "www.", "http://", "https://"]):
        return True
    if contains_any(blob, ["방문", "우편", "팩스", "전화"]):
        return False
    return None


def extract_restricted_text(text: str) -> str | None:
    match = re.search(r"(.{0,80}(?:제외|제한|중복\s*불가|지원\s*불가).{0,240})", text, re.DOTALL)
    return shorten(match.group(1), 350) if match else None


def source_configs(args: argparse.Namespace) -> list[SourceConfig]:
    configs = [
        SourceConfig("bokjiro", args.bokjiro_path),
        SourceConfig("gov24", args.gov24_path),
    ]
    if args.source == "all":
        return configs
    return [config for config in configs if config.source == args.source]


def load_rows(args: argparse.Namespace) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for config in source_configs(args):
        if not config.path.exists():
            raise FileNotFoundError(f"Processed CSV not found: {config.path}")
        frame = pd.read_csv(config.path, dtype=str).fillna("")
        frame["source"] = config.source
        frames.append(frame)
        print(f"[load] {config.source}: {config.path} rows={len(frame)}")

    if not frames:
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates(subset=["policy_id", "source"], keep="first")
    if args.limit is not None:
        df = df.head(args.limit)
    return df


def build_records(row: pd.Series) -> dict[str, object]:
    now = datetime.now(UTC).replace(tzinfo=None)
    policy_id = clean_text(row.get("policy_id")) or clean_text(row.get("chunk_id")) or ""
    title = clean_text(row.get("policy_name")) or policy_id
    category = clean_text(row.get("category"))
    region = clean_text(row.get("region"))
    source_url = clean_text(row.get("source_url"))
    text = clean_text(row.get("text")) or ""
    source = clean_text(row.get("source")) or "processed"
    sections = parse_sections(text)

    support_target = sections.get("지원대상")
    benefit_text = first_present(sections.get("지원내용"), sections.get("서비스요약"))
    selection_text = sections.get("선정기준")
    qualification_text = "\n\n".join(
        item for item in [support_target, selection_text] if item
    ) or None
    description = "\n\n".join(
        item
        for item in [
            support_target and f"지원대상:\n{support_target}",
            benefit_text and f"지원내용:\n{benefit_text}",
            selection_text and f"선정기준:\n{selection_text}",
        ]
        if item
    ) or text
    summary = first_present(sections.get("서비스요약"), benefit_text, support_target, text)
    managing_agency = first_present(sections.get("소관기관"), sections.get("소관부처"))
    operating_agency = sections.get("소관조직")
    contact_text = first_present(sections.get("전화문의"), sections.get("대표문의"))
    application_method = sections.get("신청방법")
    application_period = sections.get("신청기한")
    online_apply = infer_online_apply(application_method, source_url)
    amount = extract_amount_value(benefit_text)
    age_min, age_max = infer_age_range(f"{support_target or ''}\n{selection_text or ''}")
    inferred = infer_json_codes(text, region)
    income_code = infer_income_code(text)
    period_type = infer_period_type(application_period)

    master = PolicyMaster(
        policy_id=policy_id,
        source=source,
        source_policy_id=policy_id,
        title=title,
        summary=shorten(summary, 1000),
        description=shorten(description, 5000),
        category_large=category,
        category_medium=region if region and region != "전국" else None,
        source_url=source_url,
        application_url=source_url if online_apply else None,
        managing_agency=managing_agency,
        operating_agency=operating_agency,
        contact_text=contact_text,
        support_cycle=None,
        provision_type=None,
        online_apply_yn=online_apply,
        status_active_yn=True,
        normalized_at=now,
    )
    condition = PolicyCondition(
        policy_id=policy_id,
        age_min=age_min,
        age_max=age_max,
        age_limit_yn=bool(age_min is not None or age_max is not None),
        gender_male_yn=None,
        gender_female_yn=None,
        income_code=income_code,
        income_text=shorten(selection_text or support_target, 2000),
        household_type_codes_json=inferred["household"],
        employment_codes_json=inferred["employment"],
        housing_codes_json=inferred["housing"],
        life_cycle_codes_json=inferred["life_cycle"],
        school_codes_json=None,
        major_codes_json=None,
        marriage_codes_json=None,
        region_codes_json=inferred["region"],
        special_target_codes_json=inferred["special"],
        additional_qualification_text=shorten(qualification_text, 4000),
        restricted_target_text=extract_restricted_text(text),
        condition_source_confidence=0.65,
        normalized_at=now,
    )
    benefit = PolicyBenefit(
        policy_id=policy_id,
        benefit_detail_text=shorten(benefit_text, 4000),
        benefit_amount_raw_text=shorten(benefit_text, 2000),
        benefit_amount_value=amount,
        currency="KRW" if amount else None,
        benefit_period_label=shorten(benefit_text, 200),
        support_scale_limit_yn=True if contains_any(text, ["예산", "선착순", "소진"]) else None,
        first_come_first_served_yn=contains_any(text, ["선착순", "예산 소진", "예산소진"]),
        normalized_at=now,
    )
    application = PolicyApplication(
        policy_id=policy_id,
        application_method_text=shorten(application_method, 3000),
        application_period_text=shorten(application_period, 1000),
        application_period_type_code=period_type,
        business_period_etc_text=shorten(application_period, 1000),
        screening_method_text=shorten(selection_text, 2000),
        application_url=source_url if online_apply else None,
        online_apply_yn=online_apply,
        receiving_org_name=managing_agency,
        processing_note_text=shorten(application_method, 1500),
        normalized_at=now,
    )

    links = []
    if source_url:
        links.append(
            PolicyRelatedLink(
                policy_id=policy_id,
                link_type="detail",
                link_name=f"{title} 상세",
                link_url=source_url,
                sort_order=1,
            )
        )

    tags = build_tags(policy_id, source, category, region, inferred)
    documents = build_documents(policy_id, source, sections)
    laws = build_laws(policy_id, source, sections.get("관련법령"))

    return {
        "master": master,
        "condition": condition,
        "benefit": benefit,
        "application": application,
        "links": links,
        "tags": tags,
        "documents": documents,
        "laws": laws,
    }


def build_tags(
    policy_id: str,
    source: str,
    category: str | None,
    region: str | None,
    inferred: dict[str, list[str] | None],
) -> list[PolicyTag]:
    raw_tags: list[tuple[str, str, str]] = [("source", source, source.upper())]
    if category:
        raw_tags.append(("category", category, category))
    if region:
        raw_tags.append(("region", region, region))

    for tag_type, key in [
        ("life_cycle", "life_cycle"),
        ("household", "household"),
        ("employment", "employment"),
        ("housing", "housing"),
        ("special_target", "special"),
    ]:
        for code in inferred.get(key) or []:
            raw_tags.append((tag_type, code, TAG_LABELS.get(code, code)))

    tags: list[PolicyTag] = []
    seen: set[tuple[str, str]] = set()
    for tag_type, code, label in raw_tags:
        if (tag_type, code) in seen:
            continue
        seen.add((tag_type, code))
        tags.append(
            PolicyTag(
                policy_id=policy_id,
                tag_type=tag_type,
                tag_code=code,
                tag_label=label,
            )
        )
    return tags


def build_documents(policy_id: str, source: str, sections: dict[str, str]) -> list[PolicyDocument]:
    documents: list[PolicyDocument] = []
    for label in ["구비서류", "제출서류", "신청서류"]:
        for item in split_items(sections.get(label)):
            documents.append(
                PolicyDocument(
                    policy_id=policy_id,
                    document_type="required",
                    document_name=item,
                    document_description=None,
                    is_required=True,
                    source=source,
                    document_group="application",
                )
            )
    return documents


def build_laws(policy_id: str, source: str, value: str | None) -> list[PolicyLaw]:
    return [
        PolicyLaw(policy_id=policy_id, law_name=item, law_type=None, source=source)
        for item in split_items(value)
    ]


def clear_policy_tables(db: Session) -> None:
    for model in [
        AnalysisResultState,
        AnalysisProfileState,
        PolicyDocument,
        PolicyRelatedLink,
        PolicyLaw,
        PolicyTag,
        PolicyApplication,
        PolicyBenefit,
        PolicyCondition,
        PolicyMaster,
    ]:
        db.execute(delete(model))
    db.commit()


def replace_child_rows(db: Session, policy_id: str) -> None:
    for model in [PolicyDocument, PolicyRelatedLink, PolicyLaw, PolicyTag]:
        db.execute(delete(model).where(model.policy_id == policy_id))


def seed_database(args: argparse.Namespace, df: pd.DataFrame) -> None:
    from app.db import models  # noqa: F401
    from app.db.base import Base
    from app.db.session import SessionLocal, engine

    if args.init_tables:
        Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_count = db.execute(select(func.count()).select_from(PolicyMaster)).scalar_one()
        if args.skip_if_populated and existing_count:
            print(f"[seed] skipped: policy_master already has {existing_count} rows")
            return

        if args.clear_existing:
            print("[seed] clearing normalized policy tables")
            clear_policy_tables(db)

        total = len(df)
        inserted = 0
        for index, (_, row) in enumerate(df.iterrows(), start=1):
            records = build_records(row)
            master = records["master"]
            if not isinstance(master, PolicyMaster) or not master.policy_id:
                continue

            replace_child_rows(db, master.policy_id)
            db.merge(master)
            db.merge(records["condition"])
            db.merge(records["benefit"])
            db.merge(records["application"])
            for collection_name in ["links", "tags", "documents", "laws"]:
                for child in records[collection_name]:
                    db.add(child)

            inserted += 1
            if inserted % args.commit_every == 0:
                db.commit()
                print(f"[seed] committed {inserted}/{total}")

        db.commit()
        final_count = db.execute(select(func.count()).select_from(PolicyMaster)).scalar_one()
        print(f"[seed] complete: processed={inserted}, policy_master={final_count}")
    finally:
        db.close()


def main() -> None:
    args = parse_args()
    df = load_rows(args)
    print(f"[seed] loaded unique policies={len(df)}")

    if args.dry_run:
        sample = df.head(3)
        for _, row in sample.iterrows():
            records = build_records(row)
            master = records["master"]
            condition = records["condition"]
            benefit = records["benefit"]
            if isinstance(master, PolicyMaster) and isinstance(condition, PolicyCondition) and isinstance(benefit, PolicyBenefit):
                print(
                    "[dry-run]",
                    master.policy_id,
                    master.source,
                    master.title,
                    f"region={condition.region_codes_json}",
                    f"amount={benefit.benefit_amount_value}",
                )
        return

    seed_database(args, df)


if __name__ == "__main__":
    main()
