from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import threading
import time


logger = logging.getLogger(__name__)
DEFAULT_RAG_TIMEOUT_SECONDS = float(os.getenv("RAG_TIMEOUT_SECONDS", "45"))
RAG_COLD_START_TIMEOUT_SECONDS = float(os.getenv("RAG_COLD_START_TIMEOUT_SECONDS", "120"))
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
