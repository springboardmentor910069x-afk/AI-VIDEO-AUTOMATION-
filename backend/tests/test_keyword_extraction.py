"""Unit tests for the lightweight keyword extraction pipeline."""

from app.ai.keyword_service import extract_keywords


def test_empty_text_returns_empty():
    assert extract_keywords("") == []
    assert extract_keywords("   ") == []
    assert extract_keywords("\n\n\t ") == []


def test_single_topic_surfaces_meaningful_phrases():
    text = (
        "In this video we explore machine learning and deep learning. "
        "Machine learning is a field of artificial intelligence. "
        "We look at neural networks and how deep learning uses neural "
        "networks. Software engineering is also important for machine "
        "learning systems."
    )
    keywords = extract_keywords(text)

    phrases = {item["keyword"] for item in keywords}
    assert "machine learning" in phrases
    assert "deep learning" in phrases
    assert "neural networks" in phrases
    assert "artificial intelligence" in phrases

    # Results should be ranked by descending score.
    scores = [item["score"] for item in keywords]
    assert scores == sorted(scores, reverse=True)

    # No duplicate keys (case is normalised for dedup).
    assert len(phrases) == len(keywords)


def test_stop_words_and_punctuation_are_removed():
    text = (
        "The quick brown fox jumps over the lazy dog. "
        "The fox, it seems, is quick indeed!"
    )
    keywords = extract_keywords(text)
    flattened = " ".join(item["keyword"] for item in keywords).lower()

    for filler in ("the", "is", "over", "and", "it"):
        assert filler not in flattened.split()


def test_case_normalization_dedupes():
    text = "Python a programming language. PYTHON is great for Python code."
    keywords = extract_keywords(text)
    count = sum(1 for item in keywords if item["keyword"] == "python")
    assert count == 1
    assert keywords[0]["score"] == 1.0


def test_limit_is_respected_and_bounded():
    text = ("alpha beta gamma delta epsilon zeta eta theta iota "
            "kappa lambda mu nu xi omicron pi " * 5)
    assert len(extract_keywords(text, limit=5)) <= 5
    assert len(extract_keywords(text, limit=5000)) <= 100
    assert extract_keywords(text, limit=0)  # clamps to 1


def test_scores_are_normalised():
    text = (
        "catalyst reaction catalyst reaction catalyst reaction "
        "catalyst reaction catalyst reaction catalyst reaction "
        "enzyme enzyme enzyme endotherm endotherm solo unique term"
    )
    keywords = extract_keywords(text)
    for item in keywords:
        assert 0.0 < item["score"] <= 1.0