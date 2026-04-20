from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional


class PromptBuilder:
    LANG_MAP = {
        "ko": "Korean",
        "en": "English",
        "vi": "Vietnamese",
        "zh": "Simplified Chinese",
        "ja": "Japanese",
    }

    DEFAULT_ANALYSIS_PROMPT = """
You are a production eligibility-explanation module for a Korean welfare-policy service.

Task:
- Read the user condition, policy text, and rule-engine notes.
- Return short Korean reasons and action guides for conditions that may block or require verification.

Output schema:
{
  "rejection_reasons": ["string"],
  "guides": ["string"]
}

Rules:
1. Treat the rule-engine notes as the primary source of truth.
2. Use only facts supported by the policy text or the rule-engine notes.
3. Never invent missing amounts, dates, agencies, documents, or eligibility conditions.
4. If there is no confirmed hard fail, use a "검토 필요:" style reason instead of a definitive rejection.
5. Each reason must explain one possible fail point or one condition that still needs verification.
6. Each guide must tell the user what to check, prepare, or confirm next.
7. Keep each item to one short Korean sentence.
8. Return 1 to 3 rejection reasons and 1 to 3 guides.
9. Output one JSON object only. No Markdown and no extra text.
""".strip()

    DEFAULT_SUMMARY_PROMPT = """
You are a production summarization module for a Korean welfare-policy service.

Task:
- Read the policy text and extract only the core facts needed by end users.
- Ignore repeated agency names, contact lists, navigation text, and duplicated sentences.

Output schema:
{
  "policy_name": "string",
  "target": "string",
  "benefit": "string",
  "conditions": "string",
  "how_to_apply": "string"
}

Rules:
1. Use only facts explicitly supported by the policy text.
2. Keep policy_name as the official Korean policy name when present.
3. target must describe who can apply.
4. benefit must describe what support is provided.
5. conditions must capture key eligibility conditions only.
6. how_to_apply must capture application method, period, or key required process when supported.
7. Preserve exact numbers, age ranges, dates, income thresholds, and benefit amounts.
8. If a field is not supported, return an empty string.
9. Write concise Korean factual phrases, not promotional copy.
10. Output one JSON object only. No Markdown and no extra text.
""".strip()

    DEFAULT_TRANSLATION_PROMPT = """
You are a production translation module for a Korean welfare-policy service.

Task:
- Translate the source text into the requested target language accurately and naturally.
- Keep the result useful for foreign residents reading Korean welfare information.

Rules:
1. Do not add, omit, or reinterpret facts.
2. Keep placeholders such as [[PRESERVE_1]] exactly unchanged.
3. Preserve numbers, percentages, money amounts, dates, URLs, law/article numbers, and policy codes exactly.
4. Follow the glossary when it is provided. If the glossary conflicts with a general translation, prefer the glossary.
5. Use only the requested target language in translated_text, except one official Korean policy name may remain in parentheses when needed.
6. Do not omit eligibility conditions, exclusions, deadlines, warnings, or document names.
7. If a term has no natural equivalent, keep the Korean term and add a short target-language gloss only once.
8. Do not output explanations, Markdown, citations, or extra keys.
9. Output one JSON object only.
10. The JSON object must contain exactly one key named translated_text.
""".strip()

    def __init__(
        self,
        prompt_dir: str = "prompts",
        reject_guide_filename: str = "prompt_reject_guide.txt",
        summary_filename: str = "prompt_summary.txt",
        translation_filename: str = "prompt_translation.txt",
    ) -> None:
        self.prompt_dir = Path(prompt_dir)
        self.analysis_prompt_base = self._load_prompt(
            self.prompt_dir / reject_guide_filename,
            self.DEFAULT_ANALYSIS_PROMPT,
        )
        self.summary_prompt_base = self._load_prompt(
            self.prompt_dir / summary_filename,
            self.DEFAULT_SUMMARY_PROMPT,
        )
        self.translation_prompt_base = self._load_prompt(
            self.prompt_dir / translation_filename,
            self.DEFAULT_TRANSLATION_PROMPT,
        )

    def _load_prompt(self, path: Path, default: str) -> str:
        try:
            text = path.read_text(encoding="utf-8").strip()
            return text or default
        except Exception:
            return default

    def get_lang_name(self, lang_code: str) -> str:
        normalized = str(lang_code or "ko").strip().lower()
        if normalized not in self.LANG_MAP:
            raise ValueError(f"Unsupported language: {lang_code}")
        return self.LANG_MAP[normalized]

    def _get_translation_examples(self, target_lang: str) -> str:
        examples = {
            "en": (
                "- \uAE30\uC900 \uC911\uC704\uC18C\uB4DD -> standard median income\n"
                "- \uBB34\uC8FC\uD0DD \uCCAD\uB144 -> non-homeowning young adults\n"
                "- \uC804\uC785\uC2E0\uACE0 -> move-in registration"
            ),
            "zh": (
                "- \uAE30\uC900 \uC911\uC704\uC18C\uB4DD -> \u6807\u51C6\u4E2D\u4F4D\u6570\u6536\u5165\n"
                "- \uBB34\uC8FC\uD0DD \uCCAD\uB144 -> \u65E0\u623F\u9752\u5E74\n"
                "- \uC804\uC785\uC2E0\uACE0 -> \u8FC1\u5165\u7533\u62A5"
            ),
            "ja": (
                "- \uAE30\uC900 \uC911\uC704\uC18C\uB4DD -> \u57FA\u6E96\u4E2D\u4F4D\u6240\u5F97\n"
                "- \uBB34\uC8FC\uD0DD \uCCAD\uB144 -> \u7121\u4F4F\u5B85\u306E\u9752\u5E74\n"
                "- \uC804\uC785\uC2E0\uACE0 -> \u8EE2\u5165\u5C4A"
            ),
            "vi": (
                "- \uAE30\uC900 \uC911\uC704\uC18C\uB4DD -> thu nhap trung vi tieu chuan\n"
                "- \uBB34\uC8FC\uD0DD \uCCAD\uB144 -> thanh nien khong so huu nha\n"
                "- \uC804\uC785\uC2E0\uACE0 -> dang ky chuyen den"
            ),
        }
        return examples.get(target_lang, "")

    def build_analysis_context(self, policy_text: str, user_condition: str, rule_result_text: str = "") -> str:
        return (
            "[User condition]\n"
            f"{str(user_condition or '').strip()}\n\n"
            "[Policy text]\n"
            f"{str(policy_text or '').strip()}\n\n"
            "[Rule engine notes]\n"
            f"{str(rule_result_text or '').strip() or 'None'}"
        )

    def build_analysis_messages(
        self,
        policy_text: str,
        user_condition: str,
        rule_result_text: str = "",
    ) -> list[Dict[str, str]]:
        context = self.build_analysis_context(policy_text, user_condition, rule_result_text)
        return [
            {
                "role": "system",
                "content": (
                    "Return only valid JSON matching the schema. "
                    "Use Korean only. "
                    "Allowed keys: rejection_reasons, guides. "
                    "If there is no confirmed hard fail, use a 검토 필요 style reason."
                ),
            },
            {
                "role": "user",
                "content": f"{self.analysis_prompt_base}\n\n{context}",
            },
        ]

    def build_summary_messages(self, policy_text: str) -> list[Dict[str, str]]:
        user_prompt = (
            f"{self.summary_prompt_base}\n\n"
            "[Policy text]\n"
            f"{str(policy_text or '').strip()}"
        )
        return [
            {
                "role": "system",
                "content": (
                    "Return only valid JSON matching the schema. "
                    "Use Korean only. "
                    "Allowed keys: policy_name, target, benefit, conditions, how_to_apply. "
                    "Unknown or unsupported fields must be empty strings."
                ),
            },
            {"role": "user", "content": user_prompt},
        ]

    def build_translation_messages(
        self,
        text: str,
        target_lang: str,
        glossary_text: Optional[str] = None,
        policy_context: Optional[str] = None,
    ) -> list[Dict[str, str]]:
        lang_name = self.get_lang_name(target_lang)
        glossary = str(glossary_text or "").strip() or "No glossary matches."
        context = str(policy_context or "").strip() or "No extra policy context."
        examples = self._get_translation_examples(target_lang) or "No examples."
        user_prompt = (
            f"{self.translation_prompt_base}\n\n"
            f"[Target language]\n{lang_name}\n\n"
            f"[Glossary]\n{glossary}\n\n"
            f"[Reference context]\n{context}\n\n"
            f"[Examples]\n{examples}\n\n"
            f"[Source text]\n{str(text or '').strip()}"
        )
        return [
            {
                "role": "system",
                "content": (
                    f"Return only valid JSON matching the schema. "
                    f"Use {lang_name} as the output language. "
                    f"Do not mix in Korean except official policy names in parentheses. "
                    f"Keep placeholders unchanged. "
                    f"The only allowed JSON key is translated_text. "
                    f"If uncertain, keep the original policy term rather than inventing a new meaning."
                ),
            },
            {"role": "user", "content": user_prompt},
        ]

    @staticmethod
    def get_analysis_schema() -> Dict:
        return {
            "type": "object",
            "properties": {
                "rejection_reasons": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 3,
                },
                "guides": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 3,
                },
            },
            "required": ["rejection_reasons", "guides"],
            "additionalProperties": False,
        }

    @staticmethod
    def get_summary_schema() -> Dict:
        return {
            "type": "object",
            "properties": {
                "policy_name": {"type": "string"},
                "target": {"type": "string"},
                "benefit": {"type": "string"},
                "conditions": {"type": "string"},
                "how_to_apply": {"type": "string"},
            },
            "required": ["policy_name", "target", "benefit", "conditions", "how_to_apply"],
            "additionalProperties": False,
        }

    @staticmethod
    def get_translation_schema() -> Dict:
        return {
            "type": "object",
            "properties": {
                "translated_text": {"type": "string"},
            },
            "required": ["translated_text"],
            "additionalProperties": False,
        }
