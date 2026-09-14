from collections import Counter
import re


def extract_keywords(text):
    if not text:
        return []

    # ---------------------------------------------------------
    # 1. Stopwords
    # ---------------------------------------------------------

    stopwords = {
        "this", "that", "have", "with", "from",
        "they", "will", "would", "there", "their",
        "about", "which", "could", "should", "your",
        "what", "when", "where", "been", "being",
        "into", "then", "than", "them", "also",
        "just", "very", "much", "only", "because",
        "after", "before", "while", "over", "under",
        "real", "time", "first", "second", "third",
        "term", "terms", "thing", "things",
        "using", "used", "like", "make", "made",
        "know", "want", "need", "good", "really",
        "currently", "going", "many", "some",
        "more", "most", "such", "here", "well",
        "still", "people", "person", "something",
        "become", "became", "success", "successful",
        "stop", "short", "long", "learn", "learning",
        "video", "speaker", "pursuing",
        "project", "projects",
        "skills", "technical",
        "have", "has", "had",
        "was", "were", "are", "is",
        "am", "been", "being",
        "the", "and", "for",
        "our", "their", "them",
        "you", "they", "we", "i",
        "me", "my", "he", "she",
        "it", "its", "of", "to",
        "in", "on", "at", "by",
        "as", "an", "a",
        "or", "but", "if",
        "so", "than", "then",
        "through", "where",
        "which", "who", "whom",
        "can", "could", "would",
        "should", "may", "might",
        "must", "do", "does", "did"
    }

    # ---------------------------------------------------------
    # 2. Technical terms receive a small bonus.
    #
    # These are NOT fixed keywords.
    # They only receive extra score if they actually
    # appear in the uploaded transcript.
    # ---------------------------------------------------------

    technical_terms = {
        "python",
        "java",
        "javascript",
        "typescript",
        "react",
        "django",
        "fastapi",
        "node",
        "sql",
        "mysql",
        "postgresql",
        "mongodb",
        "dbms",
        "database",
        "databases",
        "programming",
        "software",
        "algorithm",
        "algorithms",
        "artificial",
        "intelligence",
        "machine",
        "learning",
        "deep",
        "neural",
        "network",
        "networks",
        "cloud",
        "computing",
        "cybersecurity",
        "security",
        "blockchain",
        "analytics",
        "analysis",
        "technology",
        "engineering",
        "development",
        "developer",
        "research",
        "prediction",
        "classification",
        "automation",
        "backend",
        "frontend",
        "server",
        "testing",
        "framework",
        "frameworks",
        "abap",
        "sap",
        "api",
        "apis",
        "data",
        "market",
        "stock"
    }

    # ---------------------------------------------------------
    # 3. Keep the ORIGINAL word order.
    #
    # This is important because we only want phrases that
    # were actually spoken next to each other.
    # ---------------------------------------------------------

    tokens = re.findall(
        r"\b[A-Za-z][A-Za-z0-9-]*\b",
        text
    )

    if not tokens:
        return []

    # ---------------------------------------------------------
    # 4. Count meaningful individual words
    # ---------------------------------------------------------

    word_counts = Counter()

    for token in tokens:

        word = token.lower()

        if word in stopwords:
            continue

        if len(word) < 3 and word != "ai":
            continue

        word_counts[word] += 1

    if not word_counts:
        return []

    # ---------------------------------------------------------
    # 5. Score individual words
    # ---------------------------------------------------------

    word_scores = {}

    for word, count in word_counts.items():

        score = count

        # Technical/domain-specific words get a bonus.
        if word in technical_terms:
            score += 3

        # Slight preference for longer meaningful words.
        if len(word) >= 8:
            score += 0.5

        word_scores[word] = score

    # ---------------------------------------------------------
    # 6. Detect ONLY natural adjacent 2-word phrases
    #
    # We do NOT create 3-word or 4-word phrases.
    # We also never remove stopwords and join distant words.
    # ---------------------------------------------------------

    phrase_counts = Counter()

    for i in range(len(tokens) - 1):

        first = tokens[i].lower()
        second = tokens[i + 1].lower()

        # Both words must be meaningful.
        if first in stopwords or second in stopwords:
            continue

        if len(first) < 3 and first != "ai":
            continue

        if len(second) < 3 and second != "ai":
            continue

        phrase = f"{first} {second}"

        phrase_counts[phrase] += 1

    # ---------------------------------------------------------
    # 7. Score phrases
    # ---------------------------------------------------------

    phrase_scores = {}

    for phrase, count in phrase_counts.items():

        first, second = phrase.split()

        score = count * 2

        # Give phrases containing technical terms
        # a relevance bonus.
        if first in technical_terms:
            score += 2

        if second in technical_terms:
            score += 2

        # Two meaningful words together are generally
        # more informative than one generic word.
        score += 2

        phrase_scores[phrase] = score

    # ---------------------------------------------------------
    # 8. Create candidates
    # ---------------------------------------------------------

    phrase_candidates = [
        (phrase, score)
        for phrase, score in phrase_scores.items()
    ]

    word_candidates = [
        (word, score)
        for word, score in word_scores.items()
    ]

    phrase_candidates.sort(
        key=lambda item: item[1],
        reverse=True
    )

    word_candidates.sort(
        key=lambda item: item[1],
        reverse=True
    )

    # ---------------------------------------------------------
    # 9. Select keywords
    #
    # Maximum:
    # - 4 phrases
    # - remaining positions can be individual words
    #
    # This prevents the whole keyword list from becoming
    # long phrases.
    # ---------------------------------------------------------

    selected = []

    # First select the strongest natural phrases.
    for phrase, score in phrase_candidates:

        if phrase in selected:
            continue

        selected.append(phrase)

        if len(selected) >= 4:
            break

    # Then select useful individual words.
    for word, score in word_candidates:

        # Don't show a word separately if it already
        # appears inside a selected phrase.
        already_covered = any(
            word in phrase.split()
            for phrase in selected
            if " " in phrase
        )

        if already_covered:
            continue

        selected.append(word)

        if len(selected) >= 10:
            break

    # ---------------------------------------------------------
    # 10. Format keywords for display
    # ---------------------------------------------------------

    formatted_keywords = []

    for keyword in selected:

        words_in_keyword = keyword.split()

        formatted_words = []

        for word in words_in_keyword:

            if word.lower() in {
                "ai",
                "sql",
                "dbms",
                "sap",
                "abap",
                "api",
                "apis"
            }:
                formatted_words.append(
                    word.upper()
                )
            else:
                formatted_words.append(
                    word.capitalize()
                )

        formatted_keywords.append(
            " ".join(formatted_words)
        )

    return formatted_keywords[:10]