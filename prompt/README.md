# BenePick Prompt Tuning Notes

This folder contains the prompt-tuning pieces used for BenePick AI quality
improvement.

## Files

- `prompts/prompt_summary.txt`
  - Korean welfare-policy summary prompt.
  - Focuses on core facts, no hallucination, exact numbers/dates, JSON-only.

- `prompts/prompt_translation.txt`
  - Korean welfare-policy translation prompt.
  - Preserves placeholders, numbers, percentages, money, dates, URLs, and policy terms.
  - Requires JSON output with one key: `translated_text`.

- `prompts/prompt_reject_guide.txt`
  - Eligibility rejection-reason and action-guide prompt.
  - Uses rule-engine notes as the first source of truth.
  - Requires 1-3 rejection reasons and 1-3 practical guides.

- `prompt_builder.py`
  - Loads the prompt files.
  - Adds system messages, schemas, target language, glossary, policy context,
    and examples.
  - Defines strict JSON schemas for summary, translation, and rejection guide.

## Main Tuning Ideas

1. JSON-only output
   - The frontend/backend can parse model results safely.

2. No hallucination
   - Prompts explicitly block invented facts, amounts, dates, agencies, and conditions.

3. Exact preservation
   - Numbers, age ranges, money amounts, dates, URLs, placeholders, and policy terms are preserved.

4. Rule-engine grounding
   - Rejection reasons and guides must use rule-engine results first.

5. Multilingual glossary support
   - Translation prompt includes target language, relevant glossary terms, source text,
     policy context, and short examples for en/zh/ja/vi.

6. Schema-constrained prompting
   - `PromptBuilder` provides JSON schemas for Ollama structured output.

## Related Runtime Files

The prompt output is consumed by:

- `summary_service.py`
- `translation_service.py`
- `qwen_reasoner.py`
- `output_guard.py`
