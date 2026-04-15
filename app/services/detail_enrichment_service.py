from __future__ import annotations

import hashlib
import json
import os
from collections import OrderedDict
from pathlib import Path
from threading import Lock

from app.services.ai_modules.output_guard import OutputGuard
from app.services.ai_modules.qwen_reasoner import QwenReasoner
from app.services.ai_modules.summary_service import PolicySummaryService
from app.services.ai_modules.text_preprocessor import clean_policy_text
from app.services.ai_modules.translation_service import PolicyTranslationService


SUPPORTED_LANGS = {"ko", "en", "zh", "ja", "vi"}
DETAIL_CACHE_SIZE = 256


class PolicyDetailEnrichmentService:
    def __init__(self) -> None:
        base_dir = Path(__file__).resolve().parent / "ai_modules"
        prompt_dir = base_dir / "prompts"
        csv_path = str(base_dir / "benepick_dict.csv")
        qwen_model = os.getenv("QWEN_MODEL", "qwen3.5:4b")

        self.guard = OutputGuard()
        self.enabled = True
        self.init_error: str | None = None
        self._detail_cache: OrderedDict[str, dict[str, object]] = OrderedDict()
        self._cache_lock = Lock()

        try:
            self.summary_service = PolicySummaryService(
                model_name=qwen_model,
                prompt_path=str(prompt_dir / "prompt_summary.txt"),
            )
            self.translation_service = PolicyTranslationService(
                csv_path=csv_path,
                model_name=qwen_model,
                prompt_path=str(prompt_dir / "prompt_translation.txt"),
            )
            self.reasoner = QwenReasoner(
                csv_path=csv_path,
                model_name=qwen_model,
                prompt_path=str(prompt_dir / "prompt_reject_guide.txt"),
            )
        except Exception as exc:
            self.enabled = False
            self.init_error = str(exc)

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
            try:
                result = self.translation_service.translate_text(
                    text=item,
                    policy_text=policy_text,
                    target_lang=target_lang,
                )
                translated_candidate = str(result.get("translated_text", "") or "").strip()
                guarded = self.guard.guard_translation(
                    result,
                    original_text=item,
                    target_lang=target_lang,
                )
                translated_text = guarded["translated_text"]
                if translated_text == item and translated_candidate and translated_candidate != item:
                    translated_text = translated_candidate
                translated.append(translated_text)
            except Exception:
                translated.append(item)
        return self._dedupe_keep_order(translated)

    @staticmethod
    def _make_detail_cache_key(
        *,
        policy_text: str,
        user_condition_text: str,
        target_lang: str,
        fallback_summary: str,
        fallback_reasons: list[str],
        fallback_actions: list[str],
    ) -> str:
        payload = json.dumps(
            {
                "policy_text": policy_text,
                "user_condition_text": user_condition_text,
                "target_lang": target_lang,
                "fallback_summary": fallback_summary,
                "fallback_reasons": fallback_reasons,
                "fallback_actions": fallback_actions,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        return hashlib.sha1(payload.encode("utf-8")).hexdigest()

    def _read_detail_cache(self, key: str) -> dict[str, object] | None:
        with self._cache_lock:
            cached = self._detail_cache.get(key)
            if cached is None:
                return None
            self._detail_cache.move_to_end(key)
            return {
                "eligibility_summary": cached.get("eligibility_summary"),
                "blocking_reasons": list(cached.get("blocking_reasons") or []),
                "recommended_actions": list(cached.get("recommended_actions") or []),
            }

    def _write_detail_cache(self, key: str, value: dict[str, object]) -> None:
        with self._cache_lock:
            self._detail_cache[key] = {
                "eligibility_summary": value.get("eligibility_summary"),
                "blocking_reasons": list(value.get("blocking_reasons") or []),
                "recommended_actions": list(value.get("recommended_actions") or []),
            }
            self._detail_cache.move_to_end(key)
            while len(self._detail_cache) > DETAIL_CACHE_SIZE:
                self._detail_cache.popitem(last=False)

    def enrich_detail(
        self,
        *,
        policy_text: str,
        user_condition_text: str = "",
        target_lang: str = "ko",
        fallback_summary: str | None = None,
        fallback_reasons: list[str] | None = None,
        fallback_actions: list[str] | None = None,
    ) -> dict:
        fallback_summary = str(fallback_summary or "").strip()
        fallback_reasons = self._dedupe_keep_order(fallback_reasons or [], limit=3)
        fallback_actions = self._dedupe_keep_order(fallback_actions or [], limit=3)
        target_lang = (target_lang or "ko").lower().strip()
        if target_lang not in SUPPORTED_LANGS:
            target_lang = "ko"

        policy_text = clean_policy_text(policy_text)
        user_condition_text = str(user_condition_text or "").strip()
        cache_key = self._make_detail_cache_key(
            policy_text=policy_text,
            user_condition_text=user_condition_text,
            target_lang=target_lang,
            fallback_summary=fallback_summary,
            fallback_reasons=fallback_reasons,
            fallback_actions=fallback_actions,
        )
        cached = self._read_detail_cache(cache_key)
        if cached is not None:
            return cached

        reasons = fallback_reasons[:]
        actions = fallback_actions[:]
        summary_text = fallback_summary

        if target_lang == "ko":
            summary_data: dict = {}
            if self.enabled:
                try:
                    summary_data = self.summary_service.summarize_policy(policy_text)
                except Exception:
                    summary_data = {}

            summary_guarded = self.guard.guard_summary(
                summary_data,
                fallback_text=fallback_summary or policy_text,
                expected_lang="ko",
            )
            summary_text = summary_guarded["summary"]

            if self.enabled and user_condition_text:
                try:
                    analyzed = self.reasoner.analyze_rejection_and_guide(
                        policy_text=policy_text,
                        user_condition=user_condition_text,
                        rule_result_text="\n".join(fallback_reasons),
                        target_lang="ko",
                    )
                    reasons = self._dedupe_keep_order(analyzed.get("rejection_reasons") or reasons, limit=3)
                    actions = self._dedupe_keep_order(analyzed.get("guides") or actions, limit=3)
                except Exception:
                    pass
        elif not summary_text:
            summary_data = {}
            if self.enabled:
                try:
                    summary_data = self.summary_service.summarize_policy(policy_text)
                except Exception:
                    summary_data = {}
            summary_text = self.guard.guard_summary(
                summary_data,
                fallback_text=policy_text,
                expected_lang="ko",
            )["summary"]

        if not reasons:
            reasons = ["판정 가능한 핵심 조건을 추가로 확인해야 합니다."]
        if not actions:
            actions = ["정책 원문에서 세부 자격 요건과 신청 조건을 다시 확인해 주세요."]

        if target_lang != "ko" and self.enabled:
            translation_context = summary_text or fallback_summary or policy_text
            try:
                source_summary = summary_text
                translated = self.translation_service.translate_text(
                    text=summary_text,
                    policy_text=translation_context,
                    target_lang=target_lang,
                )
                translated_candidate = str(translated.get("translated_text", "") or "").strip()
                guarded = self.guard.guard_translation(
                    translated,
                    original_text=summary_text,
                    target_lang=target_lang,
                )
                summary_text = guarded["translated_text"]
                if summary_text == source_summary and translated_candidate and translated_candidate != source_summary:
                    summary_text = translated_candidate
            except Exception:
                pass

            reasons = self._translate_list(reasons, translation_context, target_lang)
            actions = self._translate_list(actions, translation_context, target_lang)

        result = {
            "eligibility_summary": summary_text,
            "blocking_reasons": self._dedupe_keep_order(reasons, limit=3),
            "recommended_actions": self._dedupe_keep_order(actions, limit=3),
        }
        self._write_detail_cache(cache_key, result)
        return result


detail_enrichment_service = PolicyDetailEnrichmentService()
