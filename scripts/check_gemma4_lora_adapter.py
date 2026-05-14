from __future__ import annotations

import json
import os
from pathlib import Path


def main() -> None:
    adapter_path = Path(
        os.getenv("GEMMA4_LORA_ADAPTER_PATH", "models/gemma4-e4b-unsloth-lora")
    )
    required = [
        "adapter_config.json",
        "adapter_model.safetensors",
        "processor_config.json",
        "tokenizer_config.json",
        "tokenizer.json",
    ]

    print("Gemma4 LoRA adapter path:", adapter_path.resolve())
    all_ok = True
    for filename in required:
        path = adapter_path / filename
        ok = path.exists()
        all_ok = all_ok and ok
        size = f"{path.stat().st_size / 1024 / 1024:.1f} MB" if ok else ""
        print(f"- {filename}: {'OK' if ok else 'MISSING'} {size}")

    config_path = adapter_path / "adapter_config.json"
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))
        print("base_model_name_or_path:", config.get("base_model_name_or_path"))
        print("peft_type:", config.get("peft_type"))
        print("task_type:", config.get("task_type"))
        print("r:", config.get("r"))
        print("lora_alpha:", config.get("lora_alpha"))

    if not all_ok:
        raise SystemExit(1)

    print("Gemma4 LoRA adapter files are ready.")


if __name__ == "__main__":
    main()
