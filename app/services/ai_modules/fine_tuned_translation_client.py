from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Dict, Optional


class FineTunedTranslationClient:
    """HTTP client for the BenePick Qwen3.5 v2 LoRA translation server."""

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None) -> None:
        self.base_url = (base_url or os.getenv("FINE_TUNED_TRANSLATION_URL", "")).rstrip("/")
        self.timeout = float(timeout or os.getenv("FINE_TUNED_TRANSLATION_TIMEOUT", "300"))

    @property
    def enabled(self) -> bool:
        return bool(self.base_url)

    def translate(
        self,
        *,
        text: str,
        policy_text: str,
        target_lang: str,
        glossary_text: str = "",
    ) -> Dict[str, str]:
        if not self.enabled:
            raise RuntimeError("Fine-tuned translation URL is not configured.")

        endpoint = self.base_url
        if not endpoint.endswith("/translate"):
            endpoint = endpoint + "/translate"

        payload = {
            "text": text,
            "policy_context": policy_text,
            "target_lang": target_lang,
            "glossary_text": glossary_text,
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            endpoint,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Fine-tuned translation HTTP error: {exc.code} / {body}") from exc
        except Exception as exc:
            raise RuntimeError(f"Failed to call fine-tuned translation server: {exc}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse fine-tuned translation response: {raw[:500]}") from exc

        if not isinstance(parsed, dict):
            raise RuntimeError(f"Unexpected fine-tuned translation response: {parsed}")

        translated_text = str(parsed.get("translated_text", "")).strip()
        if not translated_text:
            raise RuntimeError(f"Fine-tuned translation response has no translated_text: {parsed}")

        return {
            "translated_text": translated_text,
            "translation_source": str(parsed.get("translation_source") or "qwen35_lora_v2"),
        }
