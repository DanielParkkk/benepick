from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import threading
import time


logger = logging.getLogger(__name__)
DEFAULT_RAG_TIMEOUT_SECONDS = float(os.getenv("RAG_TIMEOUT_SECONDS", "30"))
RAG_COLD_START_TIMEOUT_SECONDS = float(os.getenv("RAG_COLD_START_TIMEOUT_SECONDS", "75"))
RAG_COLD_START_GRACE_SECONDS = float(os.getenv("RAG_COLD_START_GRACE_SECONDS", "180"))
RAG_COOLDOWN_SECONDS = float(os.getenv("RAG_COOLDOWN_SECONDS", "15"))
RAG_ANSWER_TIMEOUT_SECONDS = float(os.getenv("RAG_ANSWER_TIMEOUT_SECONDS", "15"))
_circuit_lock = threading.Lock()
_rag_circuit_open_until = 0.0
_service_started_at = time.monotonic()


@dataclass
class RagSearchResult:
    success: bool
    answer: str | None
    docs_used: list[str]
    confidence_level: str | None = None
    confidence_score: float | None = None
    confidence_reason: str | None = None
    top_policy_candidates: list[str] | None = None
    needs_confirmation: bool = False


_FALLBACK_HEADERS = {
    "ko": ["핵심 답변", "근거 정책", "신청/확인 방법", "확인 필요", "출처"],
    "en": ["Key Answer", "Supporting Policies", "How to Apply/Check", "Needs Confirmation", "Sources"],
    "ja": ["要点回答", "根拠となる政策", "申請・確認方法", "確認が必要", "出典"],
    "zh": ["核心回答", "依据政策", "申请/确认方法", "需要确认", "出处"],
    "vi": ["Câu trả lời chính", "Chính sách làm căn cứ", "Cách đăng ký/kiểm tra", "Cần xác nhận", "Nguồn"],
}

_FALLBACK_MESSAGES = {
    "ko": {
        "summary": "상세 요약 생성이 지연되어 우선 추천 결과를 먼저 보여드립니다.",
        "action": "각 정책의 공식 링크에서 지원 대상, 지원 내용, 신청 기간을 확인해 주세요.",
        "need": "자동 요약이 지연된 상태이므로 최종 수급 여부는 공식 공고문 확인이 필요합니다.",
        "no_source": "공식 출처 링크를 확인하지 못했습니다.",
    },
    "en": {
        "summary": "Detailed summary generation is delayed, so the recommended results are shown first.",
        "action": "Check each official link for eligibility, benefit details, and application dates.",
        "need": "Because automatic summarization is delayed, final eligibility must be verified in the official notice.",
        "no_source": "No official source link was available.",
    },
    "ja": {
        "summary": "詳細要約の生成が遅れているため、まずおすすめ結果を表示します。",
        "action": "各政策の公式リンクで、対象者、支援内容、申請期間を確認してください。",
        "need": "自動要約が遅れているため、最終的な受給可否は公式公告で確認してください。",
        "no_source": "公式出典リンクを確認できませんでした。",
    },
    "zh": {
        "summary": "详细摘要生成稍有延迟，因此先显示推荐结果。",
        "action": "请在各政策官方链接中确认支持对象、支持内容和申请期间。",
        "need": "由于自动摘要生成延迟，最终受益资格需要查看官方公告。",
        "no_source": "未能确认官方来源链接。",
    },
    "vi": {
        "summary": "Phần tóm tắt chi tiết đang bị trì hoãn nên kết quả đề xuất được hiển thị trước.",
        "action": "Hãy kiểm tra đối tượng hỗ trợ, nội dung hỗ trợ và thời gian đăng ký tại liên kết chính thức.",
        "need": "Vì phần tóm tắt tự động bị trì hoãn, điều kiện nhận hỗ trợ cuối cùng cần được xác minh trong thông báo chính thức.",
        "no_source": "Không xác nhận được liên kết nguồn chính thức.",
    },
}


def _normalize_lang_code(lang_code: str | None) -> str:
    normalized = str(lang_code or "ko").lower().strip()
    return normalized if normalized in _FALLBACK_HEADERS else "ko"


def _build_fallback_answer(final_docs: list[dict[str, object]], lang_code: str = "ko") -> str | None:
    lang_code = _normalize_lang_code(lang_code)
    headers = _FALLBACK_HEADERS[lang_code]
    messages = _FALLBACK_MESSAGES[lang_code]
    policy_names: list[str] = []
    source_lines: list[str] = []
    seen_urls: set[str] = set()
    for item in final_docs[:3]:
        name = str(item.get("policy_name", "")).strip()
        if name and name not in policy_names:
            policy_names.append(name)
        source_url = str(item.get("source_url", "")).strip()
        if name and source_url and source_url not in seen_urls and len(source_lines) < 2:
            seen_urls.add(source_url)
            source_lines.append(f"- {name}: {source_url}")

    if not policy_names:
        return None

    policy_lines = [f"- {name}" for name in policy_names[:3]]
    if not source_lines:
        source_lines = [f"- {messages['no_source']}"]

    return "\n".join(
        [
            f"{headers[0]}:",
            f"- {messages['summary']}",
            "",
            f"{headers[1]}:",
            *policy_lines,
            "",
            f"{headers[2]}:",
            f"- {messages['action']}",
            "",
            f"{headers[3]}:",
            f"- {messages['need']}",
            "",
            f"{headers[4]}:",
            *source_lines,
        ]
    )


def normalize_reference(item: object) -> str | None:
    if isinstance(item, dict):
        for key in ("policy_id", "source_policy_id", "reference_id", "id"):
            value = item.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
        return None
    if item is None:
        return None
    value = str(item).strip()
    return value or None


def _invoke_retrieval_pipeline(
    *,
    query: str,
    user_condition: dict[str, object],
    out: dict[str, object],
) -> None:
    from rag.pipeline import retrieve_rag_documents

    out["payload"] = retrieve_rag_documents(
        user_query=query,
        user_condition=user_condition,
    )


def _invoke_answer_generation(
    *,
    query: str,
    lang_code: str,
    docs: list[dict[str, object]],
    out: dict[str, object],
) -> None:
    from rag.pipeline import generate_answer

    out["answer"] = generate_answer(query, docs, lang_code)


def _assess_confidence(query: str, docs: list[dict[str, object]]) -> dict[str, object]:
    from rag.pipeline import assess_answer_confidence

    return assess_answer_confidence(query, docs)


def _is_searcher_ready() -> bool:
    try:
        from rag.pipeline import is_searcher_ready

        return bool(is_searcher_ready())
    except Exception:
        return False


def _open_circuit() -> None:
    global _rag_circuit_open_until
    with _circuit_lock:
        _rag_circuit_open_until = time.monotonic() + max(5.0, RAG_COOLDOWN_SECONDS)


def _run_thread(target, *, timeout_seconds: float) -> tuple[bool, dict[str, object]]:
    holder: dict[str, object] = {}

    def _runner() -> None:
        try:
            target(holder)
        except Exception as exc:  # pragma: no cover
            holder["error"] = exc

    worker = threading.Thread(target=_runner, daemon=True)
    worker.start()
    worker.join(timeout=timeout_seconds)
    return worker.is_alive(), holder


def search_rag(*, query: str, user_condition: dict[str, object], lang_code: str = "ko") -> RagSearchResult:
    global _rag_circuit_open_until

    started_at = time.perf_counter()
    now = time.monotonic()
    searcher_ready = _is_searcher_ready()
    cold_start_mode = not searcher_ready and (now - _service_started_at) <= max(1.0, RAG_COLD_START_GRACE_SECONDS)
    timeout_seconds = max(1.0, DEFAULT_RAG_TIMEOUT_SECONDS)
    if cold_start_mode:
        timeout_seconds = max(timeout_seconds, RAG_COLD_START_TIMEOUT_SECONDS)

    with _circuit_lock:
        circuit_open_until = _rag_circuit_open_until
    if now < circuit_open_until:
        if cold_start_mode:
            logger.info("RAG circuit bypass during cold start grace period.")
        else:
            remaining = circuit_open_until - now
            logger.warning("RAG circuit open (%.1fs remaining); skip and fallback.", remaining)
            return RagSearchResult(success=False, answer=None, docs_used=[])

    logger.info("RAG mode: cold_start=%s timeout=%.1fs", cold_start_mode, timeout_seconds)

    try:
        retrieval_alive, retrieval_holder = _run_thread(
            lambda out: _invoke_retrieval_pipeline(
                query=query,
                user_condition=user_condition,
                out=out,
            ),
            timeout_seconds=timeout_seconds,
        )
        if retrieval_alive:
            logger.warning("RAG retrieval timed out after %.1fs; falling back.", timeout_seconds)
            if not cold_start_mode:
                _open_circuit()
            return RagSearchResult(success=False, answer=None, docs_used=[])

        retrieval_error = retrieval_holder.get("error")
        if isinstance(retrieval_error, Exception):
            logger.error(
                "RAG retrieval failed",
                exc_info=(type(retrieval_error), retrieval_error, retrieval_error.__traceback__),
            )
            if not cold_start_mode:
                _open_circuit()
            return RagSearchResult(success=False, answer=None, docs_used=[])

        retrieval_payload = retrieval_holder.get("payload")
        if not isinstance(retrieval_payload, dict) or not retrieval_payload.get("success"):
            logger.warning("RAG retrieval returned empty or invalid payload; falling back.")
            if not cold_start_mode:
                _open_circuit()
            return RagSearchResult(success=False, answer=None, docs_used=[])

        retrieval_data = retrieval_payload.get("data") or {}
        docs_used: list[str] = []
        for item in retrieval_data.get("docs_used") or []:
            reference = normalize_reference(item)
            if reference:
                docs_used.append(reference)

        final_docs = retrieval_data.get("final_docs") or []
        confidence_meta = _assess_confidence(query, final_docs)
        retrieval_elapsed = time.perf_counter() - started_at
        remaining_time = max(0.0, timeout_seconds - retrieval_elapsed)
        answer_timeout_seconds = max(1.0, min(RAG_ANSWER_TIMEOUT_SECONDS, remaining_time))

        answer_alive, answer_holder = _run_thread(
            lambda out: _invoke_answer_generation(
                query=query,
                lang_code=lang_code,
                docs=final_docs,
                out=out,
            ),
            timeout_seconds=answer_timeout_seconds,
        )

        answer: str | None = None
        answer_error = answer_holder.get("error")
        if answer_alive:
            logger.warning(
                "RAG answer generation timed out after %.1fs; return docs without answer.",
                answer_timeout_seconds,
            )
        elif isinstance(answer_error, Exception):
            logger.error(
                "RAG answer generation failed",
                exc_info=(type(answer_error), answer_error, answer_error.__traceback__),
            )
        else:
            candidate = answer_holder.get("answer")
            if isinstance(candidate, str) and candidate.strip():
                answer = candidate

        if not answer:
            answer = _build_fallback_answer(final_docs, lang_code)
    except Exception as exc:
        logger.exception("RAG function call failed: %s", exc)
        if not cold_start_mode:
            _open_circuit()
        return RagSearchResult(success=False, answer=None, docs_used=[])

    with _circuit_lock:
        _rag_circuit_open_until = 0.0
    elapsed = time.perf_counter() - started_at
    logger.info("RAG completed in %.2fs (docs=%d, answer=%s)", elapsed, len(docs_used), bool(answer))
    return RagSearchResult(
        success=bool(docs_used),
        answer=answer,
        docs_used=docs_used,
        confidence_level=str(confidence_meta.get("level") or "") or None,
        confidence_score=float(confidence_meta.get("confidence_score")) if confidence_meta.get("confidence_score") is not None else None,
        confidence_reason=str(confidence_meta.get("reason") or "") or None,
        top_policy_candidates=list(confidence_meta.get("candidate_policy_names") or []),
        needs_confirmation=bool(confidence_meta.get("needs_confirmation")),
    )
