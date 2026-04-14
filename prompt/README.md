## 포함 파일

- `prompts/prompt_summary.txt`
  - 한국 복지 정책 요약 프롬프트
  - 핵심 사실 추출, 환각 방지, 숫자/연령/금액/날짜 보존, JSON-only 출력

- `prompts/prompt_translation.txt`
  - 한국 복지 정책 번역 프롬프트
  - placeholder, 숫자, 백분율, 금액, 날짜, URL, 정책 용어 보존
  - `translated_text` 키 하나만 가진 JSON 출력

- `prompts/prompt_reject_guide.txt`
  - 자격 조건 탈락 사유와 해결 가이드 생성 프롬프트
  - 룰 엔진 판단 결과를 우선 근거로 사용
  - 탈락 사유 1~3개, 행동 가이드 1~3개 JSON 출력

- `prompt_builder.py`
  - 프롬프트 파일을 불러와 실제 모델 입력 메시지로 조립
  - system message, JSON schema, 대상 언어, 용어집, 정책 문맥, 예시 추가
  - 요약/번역/탈락 사유 가이드의 JSON schema 정의

## 실제 프롬프트 원문

### 1. 정책 요약

```text
You are an assistant that extracts the core facts of a Korean welfare policy.

Goal:
- Read the policy text.
- Ignore contact spam, long phone lists, and duplicate agency listings.
- Return only the core facts needed for a user-facing summary.

Rules:
1. Do not invent missing facts.
2. Keep numbers, age ranges, amounts, and dates exact.
3. Each field should be short and factual.
4. Output JSON only.
```

### 2. 다국어 번역

```text
You are an assistant that translates Korean welfare-policy text.

Goal:
- Translate the source text into the target language accurately and naturally.

Rules:
1. Do not add or remove facts.
2. Keep placeholders such as [[PRESERVE_1]] exactly unchanged.
3. Keep numbers, percentages, money amounts, dates, URLs, and policy terms exact.
4. Follow the glossary when it is provided.
5. Output JSON only.
6. The JSON object must contain exactly one key named translated_text.
```

지원 언어:

- 영어 `en`
- 중국어 `zh`
- 일본어 `ja`
- 베트남어 `vi`

### 3. 탈락 사유 / 해결 가이드

```text
You are an assistant that explains welfare-policy eligibility issues.

Goal:
- Read the user condition, the policy text, and the rule-engine notes.
- Return short Korean rejection reasons and practical guides.

Rules:
1. Use the rule-engine result as the first source of truth.
2. Do not invent amounts, dates, agencies, or conditions that are not in the source.
3. Return 1 to 3 rejection reasons.
4. Return 1 to 3 practical guides.
5. Output JSON only.
```

## 튜닝 방향

- 모델 응답을 JSON-only로 제한해 백엔드에서 안정적으로 파싱할 수 있게 했습니다.
- 없는 사실, 금액, 날짜, 기관명, 조건을 만들지 않도록 명시했습니다.
- 숫자, 연령대, 금액, 날짜, URL, placeholder, 정책 용어를 보존하도록 했습니다.
- 탈락 사유와 해결 가이드는 룰 엔진 판단 결과를 우선 근거로 사용하도록 했습니다.
- 번역에는 대상 언어, 용어집, 정책 문맥, 언어별 예시를 함께 넣도록 구성했습니다.

## 관련 런타임 파일

- `summary_service.py`
- `translation_service.py`
- `qwen_reasoner.py`
- `output_guard.py`
