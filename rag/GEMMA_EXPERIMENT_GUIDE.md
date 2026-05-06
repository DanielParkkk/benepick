# Gemma 4 / EmbeddingGemma Experiment Guide

This guide keeps the Gemma hackathon experiment reproducible without removing
the current BGE-M3 baseline.

## 1. Use Gemma 4 for answer generation

Set the runtime environment:

```bash
BENEPICK_LLM_PROVIDER=gemma
GEMMA_MODEL=gemma4:latest
OLLAMA_MODEL=gemma4:latest
SUMMARY_MODEL=gemma4:latest
TRANSLATION_MODEL=gemma4:latest
REASONER_MODEL=gemma4:latest
```

`BENEPICK_LLM_PROVIDER=gemma` maps to the Ollama provider and uses `GEMMA_MODEL`
or `OLLAMA_MODEL`. If the runtime uses a different model name, only change the
environment variable.

## 2. Build EmbeddingGemma vectors

The current baseline vectors are BGE-M3:

```bash
BENEPICK_EMBED_MODEL=BAAI/bge-m3
```

To test Gemma-family embeddings, build new vector files:

```bash
HF_TOKEN=your_huggingface_token
python rag/build_embedding_variants.py --model google/embeddinggemma-300m --device cuda --batch-size 32
```

If running on CPU, use a smaller batch:

```bash
python rag/build_embedding_variants.py --model google/embeddinggemma-300m --device cpu --batch-size 8
```

The script writes:

```text
processed/embeddings_google_embeddinggemma-300m.npy
processed/gov24/embeddings_google_embeddinggemma-300m.npy
```

Note: `google/embeddinggemma-300m` may be gated on Hugging Face. Accept the
model terms and set `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN`.

## 3. Compare BGE-M3 vs EmbeddingGemma with Hit@K/MRR

Use the 97-labeled rank-order set:

```bash
python rag/compare_embedding_rank_order.py \
  --labels rag/eval_labels_template_100_filled.csv \
  --expected-min-labels 90
```

Outputs:

```text
rag/rank_order_embedding_compare/embedding_rank_order_compare_summary.csv
rag/rank_order_embedding_compare/embedding_rank_order_compare_summary.xlsx
```

Decision rule:

- Keep BGE-M3 if it has higher Hit@1/MRR or is more stable by category.
- Switch to EmbeddingGemma if it improves Hit@1/MRR without lowering Hit@5.
- If EmbeddingGemma improves only recall but not Top-1, keep BGE-M3 and focus on
  rank weighting/selective reranking.

