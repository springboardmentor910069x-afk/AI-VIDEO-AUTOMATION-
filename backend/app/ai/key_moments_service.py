"""Key moment detection built on the timestamped transcript segments.

Detection is deterministic and content-aware:
- segments are scored with TF-IDF-weighted term density plus cue phrases,
- chapters are placed at topic-appropriate boundaries derived from duration,
- highlights/important sections are picked greedily so they never overlap.

Descriptions are generated with the existing Groq-backed summarizer so we reuse
the project's AI infrastructure instead of adding a new model/API.
"""

import math
import re
from collections import Counter
from dataclasses import dataclass

from app.ai.summarization_service import generate_summary
from app.core.logging import logger
from app.models.key_moment import KeyMomentType
from app.models.summary import SummaryType


_SECONDS_PER_CHAPTER = 90.0
_SECONDS_PER_MOMENT = 60.0
_SECONDS_PER_HIGHLIGHT = 150.0

_MIN_CHAPTERS = 2
_MAX_CHAPTERS = 6
_MIN_MOMENTS = 4
_MAX_MOMENTS = 8

_MIN_GAP_SECONDS = 15.0

_MAX_DETECTION_CHARS = 600
_MAX_DESCRIPTION_CHARS = 1200

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+")
_WORD_RE = re.compile(r"[a-z]+'?[a-z]*")

_STOPWORDS = frozenset(
    """
    a an and are as at be by for from has have he her his i in is it its me my
    of on or our she so that the their them they this to too us was we were what
    when where which who why will with you your would can could did do does
    doing had how not but if than then there these those up down out into over
    also just very really about like get got let know going one two three
    something anything everything right yeah okay ok oh uh um mm hmm well so now
    actually gonna wanna maybe probably little lot see want thing things way go
    make make's make make's make make's said says say think thought come came
    back take took give gave put want won't don't didn't doesn't isn't aren't
    wasn't weren't been being am them him she's he's it's i'm we're they're
    you're that's there's don't can't won't here there
    """.split()
)

_CUE_PHRASES = (
    "important", "key", "crucial", "critical", "essential", "remember",
    "must", "never", "always", "note", "warning", "main", "major",
    "significant", "biggest", "best", "worst", "final", "conclusion",
    "summarize", "summary", "takeaway", "tip", "trick", "secret",
    "highlight", "focus", "goal", "purpose", "result", "impact",
    "benefit", "advantage", "example", "especially", "finally",
    "the most", "the best", "the worst", "in conclusion",
    "to summarize", "for example", "bottom line", "long story short",
)


@dataclass
class MomentCandidate:
    start: float
    end: float
    text: str
    kind: KeyMomentType = KeyMomentType.IMPORTANT
    title: str | None = None


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _cap_text(text: str, max_chars: int) -> str:
    text = _normalize_text(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0]


def _tokenize(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def _split_sentences(text: str) -> list[str]:
    text = _normalize_text(text)
    if not text:
        return []
    parts = _SENTENCE_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def _clean_segments(segments: list | None) -> list[dict]:
    cleaned: list[dict] = []
    for segment in segments or []:
        if not isinstance(segment, dict):
            continue
        text = _normalize_text(str(segment.get("text") or ""))
        if not text:
            continue
        try:
            start = float(segment.get("start") or 0.0)
            end = float(segment.get("end") or start)
        except (TypeError, ValueError):
            continue
        if end < start:
            end = start
        cleaned.append({"start": start, "end": end, "text": text})
    cleaned.sort(key=lambda s: s["start"])
    return cleaned


def _estimate_segments(text: str, duration: float) -> list[dict]:
    """Approximate timestamped segments from plain text (legacy transcripts).

    Each sentence is allocated a slice of the video duration proportional to
    its character length. Deterministic, never random.
    """
    sentences = _split_sentences(text)
    if not sentences:
        return []
    total_chars = sum(len(s) for s in sentences)
    if total_chars <= 0:
        return []
    segments: list[dict] = []
    pos = 0.0
    for sentence in sentences:
        frac = len(sentence) / total_chars
        start = pos
        pos += frac * duration
        segments.append({"start": start, "end": pos, "text": sentence})
    return segments


def _document_frequency(segments: list[dict]) -> dict[str, int]:
    df: dict[str, int] = {}
    for segment in segments:
        seen = set(_tokenize(segment["text"]))
        for word in seen:
            if word in _STOPWORDS or len(word) <= 2:
                continue
            df[word] = df.get(word, 0) + 1
    return df


def _score_segment(text: str, df: dict[str, int], total: int, is_first: bool) -> float:
    words = _tokenize(text)
    if not words:
        return 0.0

    counts = Counter(words)
    keyword_score = sum(
        freq * (math.log((1 + total) / (1 + df.get(word, 0))) + 1)
        for word, freq in counts.items()
        if word not in _STOPWORDS and len(word) > 2
    )
    density = keyword_score / (1 + math.log1p(len(words)))

    lower = text.lower()
    cue_count = min(sum(1 for phrase in _CUE_PHRASES if phrase in lower), 6)

    length_score = 1.0 if 8 <= len(words) <= 50 else max(0.2, min(1.0, len(words) / 8))

    position_bonus = 0.15 if is_first else 0.0

    return 0.5 * density + 0.35 * cue_count + 0.15 * length_score + position_bonus


def _extract_title(text: str, df: dict[str, int], total: int, fallback: str) -> str:
    words = _tokenize(text)
    if not words:
        return fallback
    counts = Counter(words)
    scored = [
        (freq * (math.log((1 + total) / (1 + df.get(word, 0))) + 1), word)
        for word, freq in counts.items()
        if word not in _STOPWORDS and len(word) > 2
    ]
    scored.sort(key=lambda item: (-item[0], item[1]))
    top = [word for _, word in scored[:3]]
    if top:
        return " ".join(word.capitalize() for word in top)
    title = " ".join(words[:5]).capitalize()
    return title[:60] or fallback


def _snap_to_segment_start(segments: list[dict], boundary: float) -> float:
    best = boundary
    best_distance = float("inf")
    for segment in segments:
        distance = abs(segment["start"] - boundary)
        if distance < best_distance:
            best_distance = distance
            best = segment["start"]
    return best


def _detect_chapters(
    segments: list[dict],
    duration: float,
    df: dict[str, int],
) -> list[MomentCandidate]:
    chapter_count = _clamp(
        round(duration / _SECONDS_PER_CHAPTER),
        _MIN_CHAPTERS,
        _MAX_CHAPTERS,
    )
    boundaries = [
        _snap_to_segment_start(segments, (i * duration) / chapter_count)
        for i in range(1, chapter_count)
    ]
    starts = [0.0, *boundaries]
    starts = sorted(set(starts))

    chapters: list[MomentCandidate] = []
    for index, start in enumerate(starts):
        end = (
            starts[index + 1]
            if index + 1 < len(starts)
            else max(segments[-1]["end"], duration)
        )
        text = " ".join(
            segment["text"]
            for segment in segments
            if segment["start"] >= start and segment["start"] < end
        )
        text = _cap_text(text, _MAX_DETECTION_CHARS)
        if index == 0:
            title = "Introduction"
        else:
            title = _extract_title(text, df, len(segments), f"Chapter {index + 1}")
        chapters.append(
            MomentCandidate(
                start=start,
                end=max(end, start + 0.1),
                text=text,
                kind=KeyMomentType.CHAPTER,
                title=title,
            )
        )
    return chapters


def _segments_overlap(a: dict, b: dict, min_gap: float) -> bool:
    if abs(a["start"] - b["start"]) < min_gap:
        return True
    return a["start"] < b["end"] and b["start"] < a["end"]


def _detect_highlights(
    segments: list[dict],
    duration: float,
    df: dict[str, int],
    budget: int,
    highlight_count: int,
) -> list[MomentCandidate]:
    total = len(segments)
    ranked = sorted(
        range(total),
        key=lambda i: _score_segment(segments[i]["text"], df, total, i == 0),
        reverse=True,
    )
    min_gap = max(_MIN_GAP_SECONDS, 0.05 * duration)

    picked: list[tuple[dict, KeyMomentType]] = []
    for index in ranked:
        if len(picked) >= budget:
            break
        segment = segments[index]
        if any(_segments_overlap(segment, existing, min_gap) for existing, _ in picked):
            continue
        kind = (
            KeyMomentType.HIGHLIGHT
            if len(picked) < highlight_count
            else KeyMomentType.IMPORTANT
        )
        picked.append((segment, kind))

    return [
        MomentCandidate(
            start=segment["start"],
            end=max(segment["end"], segment["start"] + 0.1),
            text=_cap_text(segment["text"], _MAX_DETECTION_CHARS),
            kind=kind,
        )
        for segment, kind in picked
    ]


async def _describe(text: str) -> str:
    text = _cap_text(text, _MAX_DESCRIPTION_CHARS)
    if not text:
        return "A notable moment in this video."
    result = await generate_summary(text, SummaryType.SHORT)
    return result.summary


async def detect_key_moments(
    transcript_text: str,
    transcript_segments: list | None,
    duration: float | None,
) -> list[dict]:
    """Detect key moments from a transcript.

    Returns a list of moment dicts:
    {start_time, end_time, title, description, type, position}
    """
    duration = float(duration or 0.0)
    segments = _clean_segments(transcript_segments)

    if not segments and transcript_text and duration > 0:
        segments = _estimate_segments(transcript_text, duration)

    if not segments or duration <= 0:
        logger.info(
            "Skipping key moments: no usable segments (duration=%s)",
            duration,
        )
        return []

    df = _document_frequency(segments)

    chapters = _detect_chapters(segments, duration, df)
    chapter_count = len(chapters)

    moment_target = _clamp(
        round(duration / _SECONDS_PER_MOMENT) + 2,
        _MIN_MOMENTS,
        _MAX_MOMENTS,
    )
    extra_budget = max(0, moment_target - chapter_count)

    highlights: list[MomentCandidate] = []
    if extra_budget:
        highlight_count = _clamp(
            round(duration / _SECONDS_PER_HIGHLIGHT),
            1,
            extra_budget,
        )
        highlights = _detect_highlights(
            segments,
            duration,
            df,
            extra_budget,
            highlight_count,
        )

    candidates = [*chapters, *highlights]
    candidates.sort(key=lambda m: (m.start, m.kind.value))

    total_segments = len(segments)
    moments: list[dict] = []
    for position, candidate in enumerate(candidates):
        title = candidate.title or _extract_title(
            candidate.text,
            df,
            total_segments,
            "Key moment",
        )
        description = await _describe(candidate.text)
        moments.append(
            {
                "start_time": round(candidate.start, 3),
                "end_time": round(max(candidate.end, candidate.start + 0.1), 3),
                "title": title,
                "description": description,
                "type": candidate.kind.value,
                "position": position,
            }
        )

    logger.info(
        "Detected %d key moments (chapters=%d, highlights=%d) for %.1fs video",
        len(moments),
        chapter_count,
        len(highlights),
        duration,
    )

    return moments
