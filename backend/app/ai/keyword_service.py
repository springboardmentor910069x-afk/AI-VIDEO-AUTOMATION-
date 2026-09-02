"""Deterministic, lightweight keyword extraction from transcripts.

The algorithm runs entirely locally — no network calls, no ML models, no torch.
It is TF-IDF over a transcript split into sentence "documents", combined with
contiguous multi-word phrase extraction:

  1. Normalise the transcript text (lowercase, collapse whitespace).
  2. Split it into sentences; each sentence becomes a document.
  3. Tokenise each sentence into significant words (drop punctuation,
     stopwords, and very short tokens).
  4. For every contiguous n-gram (1..3 significant words, never crossing a
     sentence boundary) count document frequency (df) and corpus frequency.
  5. Score = term_frequency * idf, where idf uses the sentence-as-document
     count.  This rewards distinctive terms/phrases while demoting filler.
  6. Rank, deduplicate, normalise scores to [0, 1], and return the top-N.

The output format matches the KeywordRead schema:
    [{"keyword": "machine learning", "score": 0.92}, ...]
"""

import math
import re

_MAX_PHRASE_WORDS = 3
_MIN_WORD_LEN = 3
DEFAULT_KEYWORD_LIMIT = 20

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+")
_WORD_RE = re.compile(r"[a-z0-9]+(?:['’-][a-z0-9]+)*")

_STOPWORDS = frozenset(
    """
    a an and are as at be by for from has have he her his i in is it its me my
    of on or our she so that the their them they this to too us was we were what
    when where which who why will with you your would can could did do does
    doing had how not but if than then there these those up down out into over
    also just very really about like get got let know going one two three
    something anything everything right yeah okay ok oh uh um mm hmm well so now
    actually gonna wanna maybe probably little lot see want thing things way go
    make makes said says say think thought come came back take took give gave
    put take took give gave want won't don't didn't doesn't isn't aren't
    wasn't weren't been being am them him she's he's it's i'm we're they're
    you're that's there's don't can't won't here there the that this
    """  # noqa: E501
    .split()
)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _split_sentences(text: str) -> list[str]:
    text = _normalize_text(text)
    if not text:
        return []
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]


def _significant_words(text: str) -> list[str]:
    """Lowercased tokens with stopwords, punctuation and short words removed."""
    words = _WORD_RE.findall(text.lower())
    return [
        word for word in words
        if word not in _STOPWORDS and len(word) >= _MIN_WORD_LEN
    ]


def _ngrams_from(words: list[str]) -> list[str]:
    """Contiguous 1..N phrases from a sentence's significant-word stream."""
    ngrams: list[str] = []
    length = len(words)
    for start in range(length):
        max_end = min(length, start + _MAX_PHRASE_WORDS)
        for end in range(start + 1, max_end + 1):
            ngrams.append(" ".join(words[start:end]))
    return ngrams


def _collect_counts(sentences: list[str]) -> tuple[dict[str, int], dict[str, int]]:
    """Return (term_frequency, document_frequency) over sentence documents."""
    term_freq: dict[str, int] = {}
    doc_freq: dict[str, int] = {}
    for sentence in sentences:
        phrases = _ngrams_from(_significant_words(sentence))
        if not phrases:
            continue
        seen: set[str] = set()
        for phrase in phrases:
            term_freq[phrase] = term_freq.get(phrase, 0) + 1
            seen.add(phrase)
        for phrase in seen:
            doc_freq[phrase] = doc_freq.get(phrase, 0) + 1
    return term_freq, doc_freq


def _idf(doc_freq: int, total_documents: int) -> float:
    return math.log((1 + total_documents) / (1 + doc_freq)) + 1


def extract_keywords(
    text: str,
    limit: int = DEFAULT_KEYWORD_LIMIT,
) -> list[dict]:
    """Extract and rank keywords/phrases from a transcript.

    Returns at most ``limit`` entries sorted by decreasing relevance, with
    scores normalised to [0, 1].  Returns an empty list for empty input.
    """
    if limit < 1:
        limit = 1
    limit = min(limit, 100)

    sentences = _split_sentences(text)
    if not sentences:
        return []

    term_freq, doc_freq = _collect_counts(sentences)
    if not term_freq:
        return []

    total_documents = len(sentences)
    scored = [
        (freq * _idf(doc_freq[phrase], total_documents), phrase)
        for phrase, freq in term_freq.items()
    ]
    scored.sort(key=lambda item: (-item[0], item[1]))

    top = scored[:limit]
    if not top or top[0][0] <= 0:
        return []

    max_score = top[0][0]
    keywords: list[dict] = []
    for pair in top:
        score = round(pair[0] / max_score, 4)
        keyword = " ".join(pair[1].split())
        if score <= 0:
            continue
        keywords.append({"keyword": keyword, "score": score})

    return keywords