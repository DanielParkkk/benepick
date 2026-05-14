from __future__ import annotations

import copy
import hashlib
import os
from collections import OrderedDict
from pathlib import Path
from typing import Any

from app.services.ai_modules.output_guard import OutputGuard
from app.services.ai_modules.gemma_reasoner import GemmaReasoner
from app.services.ai_modules.summary_service import PolicySummaryService
from app.services.ai_modules.text_preprocessor import clean_policy_text
from app.services.ai_modules.translation_service import PolicyTranslationService


SUPPORTED_LANGS = {"ko", "en", "zh", "ja", "vi"}


class PolicyAIEnricher:
    DEFAULT_CACHE_LIMIT = 128
    FALLBACK_TRANSLATIONS = {
        "판정 가능한 핵심 조건을 추가로 확인해야 합니다.": {
            "en": "Additional core eligibility conditions need to be checked.",
            "zh": "需要进一步确认可判定的核心条件。",
            "ja": "判定に必要な主要条件を追加で確認する必要があります。",
            "vi": "Cần kiểm tra thêm các điều kiện cốt lõi có thể xác định.",
        },
        "정책 원문에서 세부 자격 요건과 신청 조건을 다시 확인해 주세요.": {
            "en": "Please review the detailed eligibility criteria and application conditions in the original policy document.",
            "zh": "请再次确认政策原文中的具体资格条件和申请要求。",
            "ja": "政策原文で詳細な資格要件と申請条件を再確認してください。",
            "vi": "Vui lòng kiểm tra lại điều kiện đủ tư cách và điều kiện đăng ký trong văn bản chính sách gốc.",
        },
    }
    GENERIC_TRANSLATION_FALLBACKS = {
        "en": "Translation is temporarily unavailable. Please check the Korean original.",
        "zh": "暂时无法提供翻译。请确认韩文原文。",
        "ja": "翻訳を一時的に提供できません。韓国語原文を確認してください。",
        "vi": "Tạm thời chưa thể cung cấp bản dịch. Vui lòng kiểm tra bản gốc tiếng Hàn.",
    }

    def __init__(self) -> None:
        base_dir = Path(__file__).resolve().parent / "ai_modules"
        prompt_dir = base_dir / "prompts"
        csv_path = str(base_dir / "benepick_dict.csv")

        self.guard = OutputGuard()
        self.enabled = True
        self.init_error: str | None = None
        self.cache_limit = self._read_cache_limit()
        self._summary_cache: OrderedDict[str, dict] = OrderedDict()
        self._translation_cache: OrderedDict[str, dict] = OrderedDict()
        self._analysis_cache: OrderedDict[str, dict] = OrderedDict()
        self._cache_hits = 0
        self._cache_misses = 0

        try:
            default_model = os.getenv("GEMMA_MODEL", "gemma4:latest")
            self.summary_service = PolicySummaryService(
                model_name=os.getenv("SUMMARY_MODEL", default_model),
                prompt_path=str(prompt_dir / "prompt_summary.txt"),
            )
            self.translation_service = PolicyTranslationService(
                csv_path=csv_path,
                model_name=os.getenv("TRANSLATION_MODEL", default_model),
                prompt_path=str(prompt_dir / "prompt_translation.txt"),
            )
            self.reasoner = GemmaReasoner(
                csv_path=csv_path,
                model_name=os.getenv("REASONER_MODEL", default_model),
                prompt_path=str(prompt_dir / "prompt_reject_guide.txt"),
            )
        except Exception as exc:
            self.enabled = False
            self.init_error = str(exc)

    @classmethod
    def _read_cache_limit(cls) -> int:
        try:
            return max(0, int(os.getenv("BENEPICK_AI_CACHE_LIMIT", str(cls.DEFAULT_CACHE_LIMIT))))
        except ValueError:
            return cls.DEFAULT_CACHE_LIMIT

    @staticmethod
    def _cache_key(*parts: object) -> str:
        raw = "\n---\n".join(str(part or "") for part in parts)
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _clone(value: Any) -> Any:
        return copy.deepcopy(value)

    def _cache_get(self, cache: OrderedDict[str, Any], key: str) -> Any | None:
        if self.cache_limit <= 0:
            return None
        if key not in cache:
            self._cache_misses += 1
            return None
        cache.move_to_end(key)
        self._cache_hits += 1
        return self._clone(cache[key])

    def _cache_set(self, cache: OrderedDict[str, Any], key: str, value: Any) -> None:
        if self.cache_limit <= 0:
            return
        cache[key] = self._clone(value)
        cache.move_to_end(key)
        while len(cache) > self.cache_limit:
            cache.popitem(last=False)

    def status(self) -> dict[str, object]:
        return {
            "enabled": self.enabled,
            "init_error": self.init_error,
            "supported_langs": sorted(SUPPORTED_LANGS),
            "models": {
                "summary": getattr(getattr(self, "summary_service", None), "model_name", None),
                "translation": getattr(getattr(self, "translation_service", None), "model_name", None),
                "reasoner": getattr(getattr(self, "reasoner", None), "model_name", None),
            },
            "cache": {
                "limit": self.cache_limit,
                "summary_size": len(self._summary_cache),
                "translation_size": len(self._translation_cache),
                "analysis_size": len(self._analysis_cache),
                "hits": self._cache_hits,
                "misses": self._cache_misses,
            },
        }

    @staticmethod
    def _dedupe_keep_order(items: list[str], *, limit: int = 3) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for item in items:
            value = str(item or "").strip()
            if not value or value in seen:
                continue
            out.append(value)
            seen.add(value)
            if len(out) >= limit:
                break
        return out

    def _translate_list(self, items: list[str], policy_text: str, target_lang: str) -> list[str]:
        if target_lang == "ko" or not items or not self.enabled:
            return items

        translated: list[str] = []
        for item in items:
            preset = self.FALLBACK_TRANSLATIONS.get(str(item or "").strip(), {}).get(target_lang)
            if preset:
                translated.append(preset)
                continue
            try:
                translated.append(self._translate_text(item, policy_text, target_lang))
            except Exception:
                translated.append(self.GENERIC_TRANSLATION_FALLBACKS.get(target_lang, item))
        return self._dedupe_keep_order(translated)

    def _translate_text(self, text: str, policy_text: str, target_lang: str) -> str:
        return self.translate_text(text, policy_text, target_lang, generic_fallback=True)

    def translate_text(
        self,
        text: str | None,
        policy_text: str,
        target_lang: str,
        *,
        generic_fallback: bool = True,
    ) -> str:
        text = str(text or "").strip()
        target_lang = (target_lang or "ko").lower().strip()
        if not text or target_lang == "ko" or not self.enabled:
            return text
        if target_lang not in SUPPORTED_LANGS:
            return text

        fallback_mode = "generic" if generic_fallback else "original"
        cache_key = self._cache_key("translation", target_lang, fallback_mode, text, policy_text)
        cached = self._cache_get(self._translation_cache, cache_key)
        if cached is not None:
            return str(cached.get("translated_text", text))

        result = self.translation_service.translate_text(
            text=text,
            policy_text=policy_text,
            target_lang=target_lang,
        )
        guarded = self.guard.guard_translation(
            result,
            original_text=text,
            target_lang=target_lang,
        )
        if guarded.get("is_fallback") and generic_fallback:
            guarded["translated_text"] = self.GENERIC_TRANSLATION_FALLBACKS.get(target_lang, text)
        self._cache_set(self._translation_cache, cache_key, guarded)
        return str(guarded.get("translated_text", text))

    def _summarize_policy(self, policy_text: str) -> dict:
        cache_key = self._cache_key("summary", policy_text)
        cached = self._cache_get(self._summary_cache, cache_key)
        if cached is not None:
            return cached

        summary_data = self.summary_service.summarize_policy(policy_text)
        self._cache_set(self._summary_cache, cache_key, summary_data)
        return summary_data

    def _analyze_policy(self, policy_text: str, user_condition_text: str, fallback_reasons: list[str]) -> dict:
        cache_key = self._cache_key("analysis", policy_text, user_condition_text, "\n".join(fallback_reasons))
        cached = self._cache_get(self._analysis_cache, cache_key)
        if cached is not None:
            return cached

        analyzed = self.reasoner.analyze_rejection_and_guide(
            policy_text=policy_text,
            user_condition=user_condition_text,
            rule_result_text="\n".join(fallback_reasons),
            target_lang="ko",
        )
        self._cache_set(self._analysis_cache, cache_key, analyzed)
        return analyzed

    def enrich_detail(
        self,
        *,
        policy_text: str,
        user_condition_text: str = "",
        target_lang: str = "ko",
        fallback_reasons: list[str] | None = None,
        fallback_actions: list[str] | None = None,
    ) -> dict:
        fallback_reasons = self._dedupe_keep_order(fallback_reasons or [], limit=3)
        fallback_actions = self._dedupe_keep_order(fallback_actions or [], limit=3)
        target_lang = (target_lang or "ko").lower().strip()
        if target_lang not in SUPPORTED_LANGS:
            target_lang = "ko"

        policy_text = clean_policy_text(policy_text)
        user_condition_text = str(user_condition_text or "").strip()

        summary_data: dict = {}
        if self.enabled:
            try:
                summary_data = self._summarize_policy(policy_text)
            except Exception:
                summary_data = {}

        summary_guarded = self.guard.guard_summary(
            summary_data,
            fallback_text=policy_text,
            expected_lang="ko",
        )
        summary_text = summary_guarded["summary"]

        reasons = fallback_reasons[:]
        actions = fallback_actions[:]
        if self.enabled and user_condition_text:
            try:
                analyzed = self._analyze_policy(policy_text, user_condition_text, fallback_reasons)
                reasons = self._dedupe_keep_order(analyzed.get("rejection_reasons") or reasons, limit=3)
                actions = self._dedupe_keep_order(analyzed.get("guides") or actions, limit=3)
            except Exception:
                pass

        if not reasons:
            reasons = ["판정 가능한 핵심 조건을 추가로 확인해야 합니다."]
        if not actions:
            actions = ["정책 원문에서 세부 자격 요건과 신청 조건을 다시 확인해 주세요."]

        if target_lang != "ko" and self.enabled:
            try:
                summary_text = self._translate_text(summary_text, policy_text, target_lang)
            except Exception:
                summary_text = self.GENERIC_TRANSLATION_FALLBACKS.get(target_lang, summary_text)

            reasons = self._translate_list(reasons, policy_text, target_lang)
            actions = self._translate_list(actions, policy_text, target_lang)

        return {
            "eligibility_summary": summary_text,
            "blocking_reasons": self._dedupe_keep_order(reasons, limit=3),
            "recommended_actions": self._dedupe_keep_order(actions, limit=3),
        }


ai_enricher = PolicyAIEnricher()
