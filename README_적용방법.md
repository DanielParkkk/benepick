# BenePick Qwen3.5 v2 LoRA 번역 모델 적용 방법

이 압축은 `찐benepick-main` 프로젝트에 2차 파인튜닝된 번역 모델을 연결하기 위한 적용 패키지입니다.

## 들어있는 것

- `outputs/benepick-qwen35-translation-lora-v2/`
  - 2차 파인튜닝 LoRA adapter
- `fine_tuning/serve_translation_lora.py`
  - Qwen/Qwen3.5-4B + v2 LoRA adapter를 HTTP 번역 서버로 실행
- `app/services/ai_modules/fine_tuned_translation_client.py`
  - 기존 앱에서 LoRA 번역 서버를 호출하는 클라이언트
- `app/services/ai_modules/translation_service.py`
  - 번역 시 LoRA 서버를 먼저 사용하고, 실패하면 기존 Ollama qwen3.5:4b로 fallback
- `start_all_with_qwen35_lora.ps1`
  - LoRA 번역 서버 + FastAPI + 프론트엔드를 함께 실행


1. 이 압축파일을 `찐benepick-main` 프로젝트 루트에 풉니다.
   - `app`, `fine_tuning`, `outputs` 폴더가 프로젝트 루트에 덮어써지면 됩니다.
2. PowerShell에서 프로젝트 루트로 이동합니다.
3. 아래 명령을 실행합니다.
