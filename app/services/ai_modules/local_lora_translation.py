from __future__ import annotations

import hashlib
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List


class LocalLoraTranslationModel:
    def __init__(self, adapter_path: str, base_model: str = "unsloth/Qwen3.5-4B") -> None:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.adapter_path = adapter_path
        self.base_model = base_model
        self.torch = torch
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        adapter_dir = self._resolve_adapter_dir(adapter_path)
        self.adapter_dir = adapter_dir
        tokenizer_source = str(adapter_dir if (adapter_dir / "tokenizer_config.json").exists() else base_model)

        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_source,
            trust_remote_code=True,
        )
        if self.tokenizer.pad_token is None and self.tokenizer.eos_token is not None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        base = AutoModelForCausalLM.from_pretrained(
            base_model,
            torch_dtype=dtype,
            trust_remote_code=True,
            device_map="auto" if torch.cuda.is_available() else None,
        )
        if not torch.cuda.is_available():
            base.to(self.device)

        self.model = PeftModel.from_pretrained(base, str(adapter_dir))
        self.model.eval()
        if not torch.cuda.is_available():
            self.model.to(self.device)

    @staticmethod
    def _resolve_adapter_dir(adapter_path: str) -> Path:
        path = Path(adapter_path)
        if path.is_dir():
            return path

        if path.is_file() and path.suffix.lower() == ".zip":
            signature = f"{path.resolve()}::{path.stat().st_size}::{path.stat().st_mtime_ns}"
            cache_key = hashlib.sha1(signature.encode("utf-8")).hexdigest()[:16]
            cache_root = Path(tempfile.gettempdir()) / "benepick_local_lora"
            extract_root = cache_root / cache_key
            ready_marker = extract_root / ".ready"

            if not ready_marker.exists():
                if extract_root.exists():
                    shutil.rmtree(extract_root, ignore_errors=True)
                extract_root.mkdir(parents=True, exist_ok=True)
                with zipfile.ZipFile(path, "r") as zf:
                    zf.extractall(extract_root)
                ready_marker.write_text("ok", encoding="utf-8")

            adapter_configs = list(extract_root.rglob("adapter_config.json"))
            if not adapter_configs:
                raise FileNotFoundError(f"adapter_config.json not found after extracting {path}")
            return adapter_configs[0].parent

        raise FileNotFoundError(f"Local LoRA adapter path not found: {path}")

    @staticmethod
    def _strip_code_fence(text: str) -> str:
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return text.strip()

    def generate(self, messages: List[Dict[str, str]], max_new_tokens: int = 256) -> str:
        with self.torch.inference_mode():
            prompt = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            inputs = self.tokenizer(prompt, return_tensors="pt", padding=True)
            inputs = {key: value.to(self.device) for key, value in inputs.items()}

            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                temperature=0.0,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )
            generated_tokens = outputs[0][inputs["input_ids"].shape[1] :]
            return self.tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()

    def translate(self, messages: List[Dict[str, str]]) -> Dict[str, str]:
        raw = self._strip_code_fence(self.generate(messages))

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                translated = str(parsed.get("translated_text", "")).strip()
                if translated:
                    return {"translated_text": translated}
                for key in ("translation", "translated", "result", "text", "title"):
                    candidate = str(parsed.get(key, "")).strip()
                    if candidate:
                        return {"translated_text": candidate}
        except Exception:
            pass

        return {"translated_text": raw}
