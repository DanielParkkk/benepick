# BenePick AI Modules

이 폴더는 BenePick FastAPI 백엔드에 연결되는 은철 담당 AI 모듈입니다.

## 역할

- `summary_service.py`: 정책 원문 기반 핵심 요약 생성
- `translation_service.py`: 복지 용어 사전을 반영한 다국어 번역
- `qwen_reasoner.py`: 탈락 예상 사유와 보완 가이드 생성
- `prompt_builder.py`: 요약/번역/가이드 프롬프트와 JSON schema 조립
- `output_guard.py`: 원문 근거 범위 유지, 언어/출력 구조 검증
- `policy_heuristics.py`: 모델 실패 시 사용할 보수적 fallback 추출
- `text_preprocessor.py`: 정책 원문 정리

## 연결 위치

`app.services.ai_enricher.PolicyAIEnricher`가 위 모듈을 묶어서 호출합니다.
FastAPI에서는 `GET /api/v1/policies/{policy_id}/detail?lang=...` 응답을 만들 때
정책 원문과 사용자 조건을 넘겨 요약, 탈락 사유, 보완 가이드를 보강합니다.

## 실행 조건

`.env`에서 아래 값을 조정할 수 있습니다.

```text
QWEN_MODEL=qwen3.5:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT=300
```

Ollama 또는 모델 호출이 실패해도 API가 죽지 않도록, 정책 원문과 기존 판정 결과를
사용한 fallback 응답을 반환합니다.
