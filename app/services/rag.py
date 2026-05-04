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


def _build_fallback_answer(final_docs: list[dict[str, object]]) -> str | None:
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
        source_lines = ["- 공식 출처 링크를 확인하지 못했습니다."]

    return "\n".join(
        [
            "핵심 답변:",
            "- 상세 요약 생성이 지연되어 우선 추천 결과를 먼저 보여드립니다.",
            "",
            "근거 정책:",
            *policy_lines,
            "",
            "신청/확인 방법:",
            "- 각 정책의 공식 링크에서 지원 대상, 지원 내용, 신청 기간을 확인해 주세요.",
            "",
            "확인 필요:",
            "- 자동 요약이 지연된 상태이므로 최종 수급 여부는 공식 공고문 확인이 필요합니다.",
            "",
            "출처:",
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
            answer = _build_fallback_answer(final_docs)
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
    )
