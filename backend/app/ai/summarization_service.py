from dataclasses import dataclass

import groq
from groq import AsyncGroq

from app.core.config import get_settings
from app.core.logging import logger
from app.models.summary import SummaryType

GROQ_SUMMARIZATION_MODEL = "openai/gpt-oss-120b"
_GROQ_API_TIMEOUT_SECONDS = 60.0


class SummarizationError(RuntimeError):
    """Base exception for summarization service."""


@dataclass(frozen=True)
class SummaryResult:
    summary: str
    model_name: str


_client: AsyncGroq | None = None


async def get_client() -> AsyncGroq:
    """Create and cache the AsyncGroq client."""
    global _client

    if _client is not None:
        return _client

    settings = get_settings()
    api_key = settings.groq_api_key

    if not api_key:
        raise SummarizationError(
            "GROQ_API_KEY is not configured in the environment."
        )

    try:
        _client = AsyncGroq(
            api_key=api_key,
            timeout=_GROQ_API_TIMEOUT_SECONDS,
        )
        logger.info(
            "AsyncGroq summarization client initialized "
            "(timeout=%.1fs).",
            _GROQ_API_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.exception("Failed to initialize AsyncGroq client.")
        raise SummarizationError(
            "Unable to initialize AsyncGroq client."
        ) from exc

    return _client


def _build_prompt(text: str, summary_type: SummaryType) -> str:
    if summary_type == SummaryType.SHORT:
        instruction = (
            "Provide a concise 3-5 sentence summary of the following "
            "transcript. Focus on the main topic and key points."
        )
    else:
        instruction = (
            "Provide a detailed summary of the following transcript. "
            "Cover all main topics, key arguments, and important details "
            "in well-structured paragraphs."
        )

    return (
        f"{instruction}\n\n"
        f"Transcript:\n{text}"
    )


async def _call_groq(prompt: str) -> str:
    """Send a summarization prompt to Groq and return the response text."""
    client = await get_client()

    try:
        response = await client.chat.completions.create(
            model=GROQ_SUMMARIZATION_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant that produces "
                        "accurate, well-structured summaries of video "
                        "transcripts. Do not add information that is not "
                        "present in the transcript."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        content = (response.choices[0].message.content or "").strip()

        if not content:
            raise SummarizationError(
                "Groq returned an empty summary response."
            )

        return content

    except SummarizationError:
        raise

    except groq.APIConnectionError as exc:
        logger.error("Groq API connection error: %s", exc)
        raise SummarizationError(
            f"Cannot connect to Groq API: {exc}"
        ) from exc

    except groq.RateLimitError as exc:
        logger.error("Groq rate limit exceeded: %s", exc)
        raise SummarizationError(
            f"Groq rate limit exceeded. Please try again later: {exc}"
        ) from exc

    except groq.APIStatusError as exc:
        logger.error(
            "Groq API status error (HTTP %d): %s",
            exc.status_code,
            exc.message,
        )
        raise SummarizationError(
            f"Groq API error (HTTP {exc.status_code}): {exc.message}"
        ) from exc

    except Exception as exc:
        logger.exception("Groq summarization request failed.")
        raise SummarizationError(
            f"Groq summarization failed: {exc}"
        ) from exc


async def generate_summary(
    text: str,
    summary_type: SummaryType,
) -> SummaryResult:
    if not text or not text.strip():
        raise SummarizationError("Transcript is empty.")

    prompt = _build_prompt(text, summary_type)

    try:
        summary = await _call_groq(prompt)
    except SummarizationError:
        raise
    except Exception as exc:
        raise SummarizationError(str(exc)) from exc

    return SummaryResult(
        summary=summary,
        model_name=GROQ_SUMMARIZATION_MODEL,
    )
