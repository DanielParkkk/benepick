# BenePick RAG 정렬 순서 평가 Colab 가이드

## 목적

AI 분석 이후 추천 정책의 정렬 순서가 맞는지 라벨 기반으로 평가합니다.

## 평가 지표

- Hit@1: 기대 정책이 1위에 있는 비율
- Hit@3: 기대 정책이 Top-3 안에 있는 비율
- Hit@5: 기대 정책이 Top-5 안에 있는 비율
- MRR: 기대 정책이 앞순위에 있을수록 높아지는 평균 역순위 점수
- Avg Rank Score: 1위 1.0점, 2위 0.8점, 3위 0.6점, 4위 0.4점, 5위 0.2점, 미포함 0점

## 중요

이 평가는 LLM-as-a-Judge가 아니라 사람이 지정한 expected_policy_ids 또는 expected_policy_names 기준입니다.
라벨이 비어 있는 문항은 최종 점수에서 제외됩니다.

## 권장 실행 순서

1. `eval_labels_template_100.csv`의 라벨 커버리지를 확인합니다.
2. 먼저 `--limit 3` smoke test를 돌립니다.
3. 문제가 없으면 100문항 평가를 돌립니다.
4. 결과 Excel의 `detail` 시트에서 `in_topk_not_rank1`, `miss_topk`를 우선 분석합니다.
5. 최종 보고에는 라벨 수, Hit@1, Hit@3, Hit@5, MRR, Avg Rank Score를 함께 적습니다.
