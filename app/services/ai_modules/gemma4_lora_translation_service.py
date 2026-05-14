from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from typing import Any


class Gemma4LoraTranslationRuntime:
    """Lazy Gemma 4 E4B Unsloth LoRA runtime for BenePick translation.

    The server keeps the existing Ollama path as a fallback. This runtime is
    loaded only when the adapter exists and translation backend is enabled.
    """

    def __init__(
        self,
        *,
        adapter_path: str | os.PathLike[str],
        base_model: str = "unsloth/gemma-4-E4B-it-unsloth-bnb-4bit",
        max_length: int = 1536,
        max_new_tokens: int = 192,
    ) -> None:
        self.adapter_path = Path(adapter_path)
        self.base_model = base_model
        self.max_length = max_length
        self.max_new_tokens = max_new_tokens
        self._model = None
        self._processor = None
        self._lock = threading.Lock()

    def available(self) -> bool:
        return (
            self.adapter_path.exists()
            and (self.adapter_path / "adapter_config.json").exists()
            and (self.adapter_path / "adapter_model.safetensors").exists()
        )

    def _load(self) -> None:
        if self._model is not None and self._processor is not None:
            return
        if not self.available():
            raise FileNotFoundError(
                "Gemma4 LoRA adapter files are missing. Expected "
                f"{self.adapter_path / 'adapter_config.json'} and "
                f"{self.adapter_path / 'adapter_model.safetensors'}."
            )

        try:
            import torch  # noqa: F401
            import unsloth  # noqa: F401
            from unsloth import FastVisionModel
        except Exception as exc:  # pragma: no cover - depends on deployment GPU env
            raise RuntimeError(
                "Gemma4 LoRA runtime requires torch + unsloth. "
                "Install requirements-gemma4-lora.txt on a Linux/Colab GPU runtime."
            ) from exc

        model, processor = FastVisionModel.from_pretrained(
            model_name=str(self.adapter_path),
            max_seq_length=self.max_length,
            load_in_4bit=True,
            use_gradient_checkpointing="unsloth",
        )
        FastVisionModel.for_inference(model)
        self._model = model
        self._processor = processor

    @staticmethod
    def _as_gemma4_prompt(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        converted: list[dict[str, Any]] = []
        for message in messages:
            role = str(message.get("role") or "user")
            if role == "model":
                role = "assistant"
            converted.append(
                {
                    "role": role,
                    "content": [{"type": "text", "text": str(message.get("content") or "")}],
                }
            )
        return converted

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        text = str(text or "").strip()
        match = re.search(r"\{.*\}", text, flags=re.S)
        candidates = [match.group(0), text] if match else [text]
        last_error: Exception | None = None
        for candidate in candidates:
            try:
                payload = json.loads(candidate)
                if isinstance(payload, dict):
                    return payload
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"Gemma4 LoRA response is not valid JSON: {last_error}; raw={text[:300]}")

    def _render_inputs(self, messages: list[dict[str, Any]]):
        tokenizer = self._processor.tokenizer
        converted = self._as_gemma4_prompt(messages)
        try:
            return tokenizer.apply_chat_template(
                converted,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
            )
        except Exception:
            string_messages = [
                {"role": message.get("role", "user"), "content": str(message.get("content") or "")}
                for message in messages
            ]
            return tokenizer.apply_chat_template(
                string_messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
            )

    def translate_json(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        self._load()
        tokenizer = self._processor.tokenizer
        model = self._model
        with self._lock:
            input_ids = self._render_inputs(messages).to(model.device)
            import torch

            with torch.no_grad():
                output = model.generate(
                    input_ids=input_ids,
                    max_new_tokens=self.max_new_tokens,
                    do_sample=False,
                    pad_token_id=tokenizer.eos_token_id,
                )
            new_tokens = output[0][input_ids.shape[-1] :]
            raw = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        payload = self._extract_json(raw)
        translated = str(payload.get("translated_text", "") or "").strip()
        if not translated:
            for key in ("translation", "translated", "result", "text", "title"):
                candidate = str(payload.get(key, "") or "").strip()
                if candidate:
                    payload["translated_text"] = candidate
                    break
        payload["translation_source"] = "gemma4-e4b-unsloth-lora"
        return payload
