import asyncio
import threading
from dataclasses import dataclass

from app.models.summary import SummaryType

SUMMARIZER_MODEL_NAME = "facebook/bart-large-cnn"


class SummarizationError(RuntimeError):
    """Base exception for summarization service."""


class ModelLoadError(SummarizationError):
    pass


@dataclass(frozen=True)
class SummaryResult:
    summary: str
    model_name: str


_model = None
_model_lock = threading.Lock()


def get_summarizer():
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            try:
                from transformers import pipeline

                _model = pipeline(
                    "summarization",
                    model=SUMMARIZER_MODEL_NAME,
                    device=-1,
                )
            except Exception as exc:
                raise ModelLoadError(
                    f"Unable to load summarization model "
                    f"'{SUMMARIZER_MODEL_NAME}'"
                ) from exc

    return _model


async def generate_summary(
    text: str,
    summary_type: SummaryType,
) -> SummaryResult:
    if not text or not text.strip():
        raise SummarizationError("Transcript is empty.")

    model = get_summarizer()

    if summary_type == SummaryType.SHORT:
        max_length = 130
        min_length = 30
    else:
        max_length = 512
        min_length = 120

    try:
        result = await asyncio.to_thread(
            model,
            text,
            max_length=max_length,
            min_length=min_length,
            do_sample=False,
        )

        summary = result[0]["summary_text"].strip()

    except Exception as exc:
        raise SummarizationError(str(exc)) from exc

    return SummaryResult(
        summary=summary,
        model_name=SUMMARIZER_MODEL_NAME,
    )
