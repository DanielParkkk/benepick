from __future__ import annotations

import argparse
import json
import os
import re
from typing import Dict

import torch
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


LANG_MAP = {
    "en": "English",
    "vi": "Vietnamese",
    "zh": "Simplified Chinese",
    "ja": "Japanese",
}


class TranslationRequest(BaseModel):
    text: str
    target_lang: str
    policy_context: str = ""
    glossary_text: str = ""


class TranslationResponse(BaseModel):
    translated_text: str
    translation_source: str = "qwen35_lora_v2"


def extract_json_object(text: str) -> Dict[str, str]:
    text = str(text or "").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise
        parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError(f"Expected JSON object, got: {parsed!r}")
    return parsed


def build_messages(request: TranslationRequest) -> list[dict[str, str]]:
    target_lang = request.target_lang.lower().strip()
    if target_lang not in LANG_MAP:
        raise ValueError(f"Unsupported target_lang: {request.target_lang}")

    glossary = request.glossary_text.strip() or "No glossary terms."
    context = request.policy_context.strip() or "No reference context."
    user = f"""You are a BenePick welfare-policy translation model.

Translate the Korean welfare-policy text into {LANG_MAP[target_lang]}.

Return only valid JSON with exactly this key:
{{"translated_text": "..."}}

Rules:
- Translate only [Source text].
- Use [Reference context] only to disambiguate policy terms.
- Preserve benefit amounts, ages, dates, URLs, and organization names.
- Use the glossary when it applies.
- Do not add explanations.
- Do not output markdown.

[Glossary]
{glossary}

[Reference context]
{context}

[Source text]
{request.text.strip()}
"""
    return [
        {"role": "system", "content": "Return only valid JSON. The only key is translated_text."},
        {"role": "user", "content": user},
    ]


def render_prompt(tokenizer, messages: list[dict[str, str]]) -> str:
    try:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
    except TypeError:
        no_think_messages = [dict(message) for message in messages]
        no_think_messages[-1]["content"] = no_think_messages[-1]["content"].rstrip() + "\n\n/no_think"
        return tokenizer.apply_chat_template(no_think_messages, tokenize=False, add_generation_prompt=True)


def create_app(model_id: str, adapter_dir: str, max_new_tokens: int, load_in_4bit: bool) -> FastAPI:
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    kwargs = {"trust_remote_code": True}
    if torch.cuda.is_available():
        kwargs["device_map"] = "auto"
        if load_in_4bit:
            kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_use_double_quant=True,
            )
        else:
            kwargs["torch_dtype"] = torch.bfloat16
    else:
        kwargs["torch_dtype"] = torch.float32

    base_model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
    model = PeftModel.from_pretrained(base_model, adapter_dir)
    model.eval()

    app = FastAPI(title="BenePick Qwen3.5 v2 LoRA Translation Server")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "model": model_id,
            "adapter": adapter_dir,
            "translation_source": "qwen35_lora_v2",
        }

    @app.post("/translate", response_model=TranslationResponse)
    def translate(request: TranslationRequest) -> TranslationResponse:
        messages = build_messages(request)
        prompt = render_prompt(tokenizer, messages)
        inputs = tokenizer(prompt, return_tensors="pt")
        inputs = {key: value.to(model.device) for key, value in inputs.items()}

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )

        generated = output_ids[0][inputs["input_ids"].shape[-1]:]
        content = tokenizer.decode(generated, skip_special_tokens=True).strip()
        parsed = extract_json_object(content)
        translated_text = str(parsed.get("translated_text", "")).strip()
        if not translated_text:
            raise ValueError(f"Missing translated_text in model output: {content}")
        return TranslationResponse(translated_text=translated_text)

    return app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=os.getenv("QWEN35_HF_MODEL", "Qwen/Qwen3.5-4B"))
    parser.add_argument(
        "--adapter",
        default=os.getenv("QWEN35_LORA_ADAPTER", "outputs/benepick-qwen35-translation-lora-v2"),
    )
    parser.add_argument("--host", default=os.getenv("QWEN35_LORA_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("QWEN35_LORA_PORT", "8008")))
    parser.add_argument("--max-new-tokens", type=int, default=int(os.getenv("QWEN35_LORA_MAX_NEW_TOKENS", "256")))
    parser.add_argument("--load-in-4bit", action="store_true", default=os.getenv("QWEN35_LORA_4BIT", "1") == "1")
    args = parser.parse_args()

    app = create_app(args.model, args.adapter, args.max_new_tokens, args.load_in_4bit)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
