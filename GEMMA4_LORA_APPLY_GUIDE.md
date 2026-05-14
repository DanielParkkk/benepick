# BenePick Gemma4 E4B LoRA 적용 가이드

## 들어있는 것

이 패키지는 기존 BenePick 프로젝트에 Gemma4 E4B 번역 LoRA adapter를 붙이기 위한 파일만 포함합니다.

- `models/gemma4-e4b-unsloth-lora/`
  - 학습된 LoRA adapter
  - `adapter_model.safetensors`
  - `adapter_config.json`
  - tokenizer/processor 설정
  - 학습 로그와 loss 그래프
- `app/services/ai_modules/gemma4_lora_translation_service.py`
  - Gemma4 Unsloth LoRA adapter를 실제 번역 호출에 사용하는 런타임
- `app/services/ai_modules/translation_service.py`
  - 기존 번역 서비스에 LoRA 우선 사용 + Ollama fallback 연결
- `requirements-gemma4-lora.txt`
  - LoRA 런타임용 추가 패키지
- `.env.gemma4_lora.example`
  - 적용할 환경변수 예시

## 적용 방식

서버가 번역을 요청하면 다음 순서로 동작합니다.

1. `models/gemma4-e4b-unsloth-lora`에 adapter가 있는지 확인
2. `BENEPICK_TRANSLATION_BACKEND=auto` 또는 `gemma4_lora`이면 LoRA 런타임을 우선 사용
3. LoRA 런타임이 설치되어 있지 않거나 GPU 환경이 맞지 않으면 기존 Ollama Gemma4 번역으로 fallback
4. `BENEPICK_TRANSLATION_STRICT_LORA=1`이면 fallback하지 않고 오류를 냅니다.

## 설치

Linux/Colab GPU 런타임 기준:

```bash
pip install -r requirements-gemma4-lora.txt
```

그 다음 `.env.gemma4_lora.example`의 값을 `.env`에 복사합니다.

```env
BENEPICK_TRANSLATION_BACKEND=auto
GEMMA4_LORA_ADAPTER_PATH=models/gemma4-e4b-unsloth-lora
GEMMA4_LORA_BASE_MODEL=unsloth/gemma-4-E4B-it-unsloth-bnb-4bit
```

## 주의

- 이 adapter는 Gemma4 E4B 기준으로 학습되었습니다.
- Qwen3.5 adapter가 아니며, Ollama `gemma4:latest` 모델 자체에 자동으로 합쳐진 파일도 아닙니다.
- Ollama의 `ADAPTER` 기능은 공식 문서상 Gemma 1/2 계열 중심으로 안내되어 있고, 이번 Gemma4 Unsloth QLoRA adapter는 Unsloth 런타임으로 사용하는 방식을 기본으로 잡았습니다.
- GPU/Unsloth 런타임이 없는 팀장님 로컬 환경에서는 서버가 기존 Ollama Gemma4로 fallback되어 계속 실행됩니다.

## 적용 확인

```bash
python scripts/check_gemma4_lora_adapter.py
```

확인해야 할 핵심 파일:

```text
models/gemma4-e4b-unsloth-lora/adapter_config.json
models/gemma4-e4b-unsloth-lora/adapter_model.safetensors
```

## 학습 요약

- Base model: `unsloth/gemma-4-E4B-it-unsloth-bnb-4bit`
- Method: Unsloth FastVisionModel + LoRA/SFT
- Train rows: 2,864건
- Eval rows: 400건
- Epoch: 1.0
- Global step: 358/358
- Train loss: 약 0.066
