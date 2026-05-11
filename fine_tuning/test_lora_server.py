from __future__ import annotations

import json
import urllib.request


payload = {
    "text": "청년 월세 지원은 만 19~34세 무주택 청년에게 월 최대 20만원을 지원합니다.",
    "policy_context": "정책명: 청년 월세 한시 특별지원\n지원대상: 만 19~34세 무주택 청년",
    "target_lang": "en",
    "glossary_text": "- 청년 월세 한시 특별지원 -> Youth Temporary Rent Support\n- 무주택 청년 -> non-homeowning young adult",
}

request = urllib.request.Request(
    "http://127.0.0.1:8008/translate",
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(request, timeout=300) as response:
    print(response.read().decode("utf-8"))
