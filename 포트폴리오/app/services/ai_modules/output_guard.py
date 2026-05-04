from __future__ import annotations

import re
from typing import Dict, Optional


class OutputGuard:
    GROUNDING_STOPWORDS = {
        "정책",
        "원문",
        "사용자",
        "조건",
        "기준",
        "지원",
        "신청",
        "확인",
        "필요",
        "가능",
        "경우",
        "방법",
        "안내",
        "공식",
        "공고",
        "해당",
        "세부",
        "자격",
        "요건",
        "다시",
        "먼저",
        "현재",
        "있습니다",
        "합니다",
        "하세요",
    }
    EXTERNAL_ADVICE_PATTERNS = (
        r"\b대신\b",
        r"\b대체\b",
        r"다른\s+\S*정책",
        r"추천",
        r"바우처",
        r"적금",
        r"\bISA\b",
        r"개인종합자산관리",
        r"회사",
        r"은행",
        r"인터넷\s*등기소",
        r"주민센터",
        r"복지로",
        r"고용24",
        r"정부24",
        r"워크넷",
    )
    VI_MARKERS = (
        " ho tro ",
        " dieu kien ",
        " dang ky ",
        " nguoi ",
        " thoi han ",
        " khong ",
        " duoc ",
        " thanh ",
    )
    EN_MARKERS = (
        " the ",
        " and ",
        " for ",
        " with ",
        " support ",
        " apply ",
        " eligible ",
    )
    JA_MARKERS = ("\u3067\u3059", "\u307E\u3059", "\u306E", "\u3092", "\u306B", "\u7533\u8ACB")

    @staticmethod
    def _count(pattern: str, text: str) -> int:
        return len(re.findall(pattern, str(text or "")))

    @staticmethod
    def _normalize_marker_text(text: str) -> str:
        lowered = str(text or "").lower()
        lowered = re.sub(r"[^a-z\u00C0-\u024F]+", " ", lowered)
        return f" {lowered.strip()} "

    @classmethod
    def _grounding_tokens(cls, text: str) -> set[str]:
        tokens = re.findall(r"[0-9]+(?:\.[0-9]+)?%?|[A-Za-z]{2,}|[\uAC00-\uD7A3]{2,}", str(text or "").lower())
        return {token for token in tokens if token not in cls.GROUNDING_STOPWORDS and len(token) >= 2}

    @classmethod
    def _has_grounding_overlap(cls, output_text: str, evidence_bundle: str) -> bool:
        output_tokens = cls._grounding_tokens(output_text)
        if not output_tokens:
            return False
        evidence_tokens = cls._grounding_tokens(evidence_bundle)
        return bool(output_tokens & evidence_tokens)

    @classmethod
    def _contains_external_advice(cls, output_text: str, evidence_bundle: str) -> bool:
        output_text = str(output_text or "")
        evidence_bundle = str(evidence_bundle or "")
        for pattern in cls.EXTERNAL_ADVICE_PATTERNS:
            if re.search(pattern, output_text, flags=re.IGNORECASE) and not re.search(pattern, evidence_bundle, flags=re.IGNORECASE):
                return True
        return False

    @staticmethod
    def _split_evidence_sentences(evidence_bundle: str) -> list[str]:
        normalized = re.sub(r"\s+", " ", str(evidence_bundle or "")).strip()
        if not normalized:
            return []
        parts = re.split(r"(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+", normalized)
        return [part.strip() for part in parts if part.strip()]

    @classmethod
    def _select_evidence_quotes(cls, evidence_bundle: str, outputs: list[str], *, limit: int = 3) -> list[str]:
        sentences = cls._split_evidence_sentences(evidence_bundle)
        if not sentences:
            return []
        output_tokens = cls._grounding_tokens(" ".join(outputs))
        scored: list[tuple[int, int, str]] = []
        for index, sentence in enumerate(sentences):
            score = len(output_tokens & cls._grounding_tokens(sentence))
            if score:
                scored.append((score, -index, sentence))
        if not scored:
            return sentences[:limit]
        scored.sort(reverse=True)
        quotes: list[str] = []
        for _, _, sentence in scored:
            if sentence not in quotes:
                quotes.append(sentence[:180])
            if len(quotes) >= limit:
                break
        return quotes

    @staticmethod
    def _guide_from_reason(reason: str) -> str:
        reason = str(reason or "")
        if re.search(r"소득|중위소득|월소득|연봉|income|median", reason, flags=re.IGNORECASE):
            return "소득 기준과 가구원 수 산정 방식이 정책 원문과 일치하는지 공식 공고에서 다시 확인해 주세요."
        if re.search(r"연령|나이|만\s*\d+|age", reason, flags=re.IGNORECASE):
            return "신청일 기준 나이와 정책의 연령 조건이 일치하는지 공식 공고에서 다시 확인해 주세요."
        if re.search(r"지역|거주|주민등록|전입|주소|region|residence", reason, flags=re.IGNORECASE):
            return "거주지와 주민등록 기준일이 정책 원문 조건과 일치하는지 공식 공고에서 다시 확인해 주세요."
        if re.search(r"확정일자|계약서|서류|document", reason, flags=re.IGNORECASE):
            return "원문에 나온 제출서류와 확인 항목을 기준으로 누락된 서류를 보완해 주세요."
        if re.search(r"월세|임대료|보증금|임대차|rent", reason, flags=re.IGNORECASE):
            return "월세, 보증금, 임대차 계약 조건이 원문 기준과 맞는지 다시 확인해 주세요."
        if re.search(r"고용|재직|실업|구직|근로|employment", reason, flags=re.IGNORECASE):
            return "고용 상태와 가입 기간 조건이 원문 기준과 일치하는지 공식 공고에서 다시 확인해 주세요."
        if re.search(r"금융소득|주식|배당|이자", reason, flags=re.IGNORECASE):
            return "금융소득 제한 조건과 본인 신고 내역이 정책 원문 기준에 해당하는지 다시 확인해 주세요."
        return "정책 원문에서 확인되는 세부 자격 요건과 제출 조건을 기준으로 다시 점검해 주세요."

    def guard_grounded_analysis(
        self,
        data: Optional[Dict],
        *,
        evidence_text: str,
        user_condition: str = "",
        rule_result_text: str = "",
        fallback_data: Optional[Dict] = None,
        source_if_valid: str = "qwen_grounded",
        source_if_fallback: str = "guard_grounded_fallback",
    ) -> Dict[str, object]:
        data = data or {}
        fallback_data = fallback_data or {}
        evidence_bundle = "\n".join(
            value
            for value in [
                str(evidence_text or "").strip(),
                str(user_condition or "").strip(),
                str(rule_result_text or "").strip(),
            ]
            if value
        )
        quote_bundle = "\n".join(
            value
            for value in [
                str(evidence_text or "").strip(),
                str(rule_result_text or "").strip(),
            ]
            if value
        )

        raw_reasons = [str(x).strip() for x in (data.get("rejection_reasons") or []) if str(x).strip()]
        raw_guides = [str(x).strip() for x in (data.get("guides") or []) if str(x).strip()]
        if not raw_reasons and data.get("rejection_reason"):
            raw_reasons = [str(data.get("rejection_reason")).strip()]
        if not raw_guides and data.get("guide"):
            raw_guides = [str(data.get("guide")).strip()]

        reasons = [
            reason
            for reason in raw_reasons
            if self.looks_like_target_language(reason, "ko")
            and self._has_grounding_overlap(reason, evidence_bundle)
            and not self._contains_external_advice(reason, evidence_bundle)
        ][:3]
        used_fallback = False
        if not reasons:
            reasons = [str(x).strip() for x in (fallback_data.get("rejection_reasons") or []) if str(x).strip()][:3]
            used_fallback = True
        if not reasons:
            reasons = ["판정 가능한 핵심 조건을 추가로 확인해야 합니다."]
            used_fallback = True

        guides: list[str] = []
        for guide in raw_guides:
            if not self.looks_like_target_language(guide, "ko"):
                continue
            if self._contains_external_advice(guide, evidence_bundle):
                continue
            if self._has_grounding_overlap(guide, evidence_bundle) or "공식 공고" in guide:
                guides.append(guide)
            if len(guides) >= 3:
                break
        if not guides:
            used_fallback = True
            fallback_guides = [
                str(x).strip()
                for x in (fallback_data.get("guides") or [])
                if str(x).strip() and self.looks_like_target_language(str(x), "ko")
            ]
            guides = fallback_guides or [self._guide_from_reason(reason) for reason in reasons]
        guides = guides[:3]

        raw_quotes = [str(x).strip() for x in (data.get("evidence_quotes") or []) if str(x).strip()]
        fallback_quotes = [str(x).strip() for x in (fallback_data.get("evidence_quotes") or []) if str(x).strip()]
        exact_quotes = [quote for quote in raw_quotes if quote in quote_bundle][:3]
        fallback_exact_quotes = [quote for quote in fallback_quotes if quote in quote_bundle][:3]
        evidence_quotes = exact_quotes or fallback_exact_quotes or self._select_evidence_quotes(quote_bundle, reasons + guides, limit=3)

        grounded = bool(not used_fallback and reasons and guides and evidence_quotes)
        confidence = str(data.get("confidence") or "medium") if grounded else str(fallback_data.get("confidence") or "low")
        return {
            "language": "ko",
            "rejection_reasons": reasons,
            "guides": guides,
            "rejection_reason": reasons[0] if reasons else "",
            "guide": guides[0] if guides else "",
            "evidence_quotes": evidence_quotes,
            "confidence": confidence,
            "analysis_source": source_if_valid if grounded else source_if_fallback,
        }

    def _looks_like_english(self, text: str) -> bool:
        markers = self._normalize_marker_text(text)
        latin = self._count(r"[A-Za-z]", text)
        accented = self._count(r"[\u00C0-\u024F]", text)
        return latin >= 3 and accented == 0 and any(marker in markers for marker in self.EN_MARKERS)

    def _looks_like_vietnamese(self, text: str) -> bool:
        markers = self._normalize_marker_text(text)
        latin = self._count(r"[A-Za-z]", text)
        accented = self._count(r"[\u00C0-\u024F]", text)
        return latin >= 3 and (accented >= 1 or any(marker in markers for marker in self.VI_MARKERS))

    def looks_like_target_language(self, text: str, target_lang: str) -> bool:
        text = str(text or "").strip()
        if not text:
            return False

        hangul = self._count(r"[\uAC00-\uD7A3]", text)
        han = self._count(r"[\u4E00-\u9FFF]", text)
        kana = self._count(r"[\u3040-\u30FF]", text)
        latin = self._count(r"[A-Za-z]", text)

        if target_lang == "ko":
            return hangul >= 2
        if target_lang == "en":
            return hangul <= 6 and han == 0 and kana == 0 and self._looks_like_english(text)
        if target_lang == "zh":
            return han >= 6 and hangul <= 6 and kana == 0
        if target_lang == "ja":
            return hangul <= 40 and (kana >= 2 or any(marker in text for marker in self.JA_MARKERS)) and (kana + han) >= 8
        if target_lang == "vi":
            return hangul <= 6 and han == 0 and kana == 0 and self._looks_like_vietnamese(text)
        return latin > 0 or hangul > 0 or han > 0 or kana > 0

    def guard_summary(
        self,
        data: Optional[Dict],
        *,
        fallback_text: str,
        expected_lang: str = "ko",
        source_if_valid: str = "qwen",
        source_if_fallback: str = "guard_fallback",
        max_fallback_len: int = 180,
    ) -> Dict[str, object]:
        data = data or {}
        summary = str(data.get("summary", "") or "").strip()
        if summary and self.looks_like_target_language(summary, expected_lang):
            guarded = {
                "language": expected_lang,
                "summary": summary,
                "summary_source": str(data.get("summary_source", "") or source_if_valid),
            }
            for key in (
                "benefit_estimate",
                "unit_amount",
                "period_months",
                "annual_amount",
                "annual_amount_label",
                "calculation_type",
                "calculation_basis",
                "benefit_confidence",
                "benefit_evidence_text",
                "is_cash_equivalent",
            ):
                if key in data:
                    guarded[key] = data[key]
            return guarded

        fallback_text = str(fallback_text or "").strip()
        fallback_summary = fallback_text[:max_fallback_len] + "..." if len(fallback_text) > max_fallback_len else fallback_text
        guarded = {
            "language": expected_lang,
            "summary": fallback_summary,
            "summary_source": source_if_fallback,
        }
        for key in (
            "benefit_estimate",
            "unit_amount",
            "period_months",
            "annual_amount",
            "annual_amount_label",
            "calculation_type",
            "calculation_basis",
            "benefit_confidence",
            "benefit_evidence_text",
            "is_cash_equivalent",
        ):
            if key in data:
                guarded[key] = data[key]
        return guarded

    def guard_translation(
        self,
        data: Optional[Dict],
        *,
        original_text: str,
        target_lang: str,
        source_if_valid: str = "qwen",
        source_if_fallback: str = "guard_fallback",
    ) -> Dict[str, str]:
        data = data or {}
        target_lang = str(target_lang or "ko").strip().lower() or "ko"
        translated_text = str(data.get("translated_text", "") or "").strip()

        if target_lang == "ko":
            return {
                "language": "ko",
                "translated_text": translated_text or str(original_text or "").strip(),
                "translation_source": str(data.get("translation_source", "") or "original"),
                "is_fallback": False,
            }

        if translated_text and self.looks_like_target_language(translated_text, target_lang):
            return {
                "language": target_lang,
                "translated_text": translated_text,
                "translation_source": str(data.get("translation_source", "") or source_if_valid),
                "is_fallback": False,
            }

        return {
            "language": target_lang,
            "translated_text": str(original_text or "").strip(),
            "translation_source": source_if_fallback,
            "is_fallback": True,
        }

    def guard_analysis(
        self,
        data: Optional[Dict],
        *,
        target_lang: str = "ko",
        fallback_reason: str = "\uC608\uC815 \uAC00\uB2A5\uD55C \uBCF4\uC644 \uC870\uAC74\uC744 \uCD94\uAC00\uB85C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.",
        fallback_guide: str = "\uC815\uCC45 \uC6D0\uBB38\uC5D0\uC11C \uC138\uBD80 \uC790\uACA9 \uC694\uAC74\uACFC \uC2E0\uCCAD \uC870\uAC74\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
        source_if_valid: str = "qwen",
        source_if_fallback: str = "guard_fallback",
    ) -> Dict[str, object]:
        data = data or {}
        target_lang = str(target_lang or "ko").strip().lower() or "ko"

        reasons = [str(x).strip() for x in (data.get("rejection_reasons") or []) if str(x).strip()]
        guides = [str(x).strip() for x in (data.get("guides") or []) if str(x).strip()]

        if not reasons and data.get("rejection_reason"):
            reasons = [str(data.get("rejection_reason")).strip()]
        if not guides and data.get("guide"):
            guides = [str(data.get("guide")).strip()]

        combined = " ".join(reasons + guides).strip()
        if reasons and guides and self.looks_like_target_language(combined, target_lang):
            return {
                "language": target_lang,
                "rejection_reasons": reasons[:3],
                "guides": guides[:3],
                "rejection_reason": reasons[0],
                "guide": guides[0],
                "analysis_source": str(data.get("analysis_source", "") or source_if_valid),
            }

        return {
            "language": target_lang,
            "rejection_reasons": [fallback_reason],
            "guides": [fallback_guide],
            "rejection_reason": fallback_reason,
            "guide": fallback_guide,
            "analysis_source": source_if_fallback,
        }

    def guard_pipeline_result(self, data: Optional[Dict], *, target_lang: str, fallback_summary_text: str) -> Dict[str, object]:
        data = data or {}
        guarded_analysis = self.guard_analysis(
            data,
            target_lang=target_lang,
            fallback_reason=str(data.get("rejection_reason", "") or "\uC608\uC815 \uAC00\uB2A5\uD55C \uBCF4\uC644 \uC870\uAC74\uC744 \uCD94\uAC00\uB85C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4."),
            fallback_guide=str(data.get("guide", "") or "\uC815\uCC45 \uC6D0\uBB38\uC5D0\uC11C \uC138\uBD80 \uC790\uACA9 \uC694\uAC74\uACFC \uC2E0\uCCAD \uC870\uAC74\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."),
            source_if_valid=str(data.get("analysis_source", "") or "qwen"),
        )
        guarded_translation = self.guard_translation(
            {"translated_text": data.get("summary", ""), "translation_source": data.get("translation_source", "")},
            original_text=fallback_summary_text,
            target_lang=target_lang,
        )
        return {
            "language": guarded_analysis["language"],
            "rule_eligible": data.get("rule_eligible"),
            "rule_status": data.get("rule_status", "unknown"),
            "analysis_source": guarded_analysis["analysis_source"],
            "summary_source": data.get("summary_source", "unknown"),
            "translation_source": guarded_translation["translation_source"],
            "summary": guarded_translation["translated_text"],
            "rejection_reasons": guarded_analysis["rejection_reasons"],
            "guides": guarded_analysis["guides"],
            "rejection_reason": guarded_analysis["rejection_reason"],
            "guide": guarded_analysis["guide"],
        }
