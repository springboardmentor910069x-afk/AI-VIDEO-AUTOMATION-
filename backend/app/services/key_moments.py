import re


def detect_key_moments(
    timestamps,
    keywords,
    max_moments=5
):
    """
    Detect meaningful key moments from timestamped transcript segments.

    Nearby Whisper segments are first combined into larger,
    more meaningful transcript chunks. The chunks are then
    scored based on:
    - keyword relevance
    - important technical/topic words
    - meaningful cue phrases
    - sentence length
    - career, education, project and certification information

    Very short, generic, incomplete, or duplicate moments
    are avoided.
    """

    if not timestamps:
        return []

    # ---------------------------------------------------------
    # 1. Prepare keyword set
    # ---------------------------------------------------------

    keyword_set = {
        keyword.strip().lower()
        for keyword in keywords
        if keyword and keyword.strip()
    }

    # ---------------------------------------------------------
    # 2. Important words
    # ---------------------------------------------------------

    important_words = {
        "project",
        "projects",
        "certification",
        "certified",
        "python",
        "sql",
        "dbms",
        "programming",
        "artificial",
        "intelligence",
        "machine",
        "learning",
        "sap",
        "abap",
        "database",
        "technical",
        "skills",
        "experience",
        "bachelor",
        "degree",
        "education",
        "career",
        "goal",
        "future",
        "developed",
        "developing",
        "designed",
        "created",
        "prediction",
        "analysis",
        "research",
        "internship",
        "application",
        "software",
        "system",
        "systems",
        "science",
        "technology",
        "data",
        "dictionary",
        "elements",
        "subroutines",
    }

    # ---------------------------------------------------------
    # 3. Important phrases
    # ---------------------------------------------------------

    cue_phrases = [
        "my project",
        "my first project",
        "my second project",
        "my project is",
        "my first project is",
        "my second project is",
        "i have completed",
        "i have also completed",
        "i am currently pursuing",
        "currently pursuing",
        "my experience",
        "my technical skills",
        "my certification",
        "my goal",
        "my future",
        "i developed",
        "i designed",
        "i worked on",
        "i created",
        "i built",
        "i completed",
        "my short term goal",
        "my long term goal",
        "short term goal",
        "long term goal",
    ]

    # ---------------------------------------------------------
    # 4. Clean timestamp segments
    # ---------------------------------------------------------

    clean_segments = []

    for index, segment in enumerate(timestamps):

        text = segment.get("text", "").strip()

        if not text:
            continue

        start = float(segment.get("start", 0))
        end = float(segment.get("end", start))

        clean_segments.append({
            "index": index,
            "start": start,
            "end": end,
            "text": text
        })

    if not clean_segments:
        return []

    # ---------------------------------------------------------
    # 5. Combine nearby Whisper segments
    # ---------------------------------------------------------

    chunks = []

    current_segments = []
    current_word_count = 0

    for segment in clean_segments:

        text = segment["text"]
        words = text.split()

        # Start a new chunk if this is the first segment.
        if not current_segments:
            current_segments.append(segment)
            current_word_count = len(words)
            continue

        previous = current_segments[-1]

        gap = segment["start"] - previous["end"]

        # Add the segment when:
        # - it is close to the previous segment
        # - the chunk is not already too long
        if gap <= 1.5 and current_word_count + len(words) <= 45:

            current_segments.append(segment)
            current_word_count += len(words)

            # If the current text appears to end a sentence,
            # finish the chunk.
            combined_text = " ".join(
                item["text"] for item in current_segments
            ).strip()

            if combined_text.endswith(
                (".", "!", "?")
            ):
                chunks.append(current_segments)
                current_segments = []
                current_word_count = 0

        else:
            chunks.append(current_segments)

            current_segments = [segment]
            current_word_count = len(words)

    # Add the final chunk.
    if current_segments:
        chunks.append(current_segments)

    # ---------------------------------------------------------
    # 6. Score each combined chunk
    # ---------------------------------------------------------

    scored_chunks = []

    for chunk_index, chunk in enumerate(chunks):

        text = " ".join(
            segment["text"].strip()
            for segment in chunk
        ).strip()

        if not text:
            continue

        lower_text = text.lower()

        words_list = re.findall(
            r"\b[a-zA-Z]{4,}\b",
            lower_text
        )

        words = set(words_list)

        word_count = len(words_list)

        # Ignore extremely short chunks.
        if word_count < 6:
            continue

        score = 0

        # -----------------------------------------------------
        # Keyword relevance
        # -----------------------------------------------------

        for keyword in keyword_set:

            # Multi-word keyword
            if " " in keyword:

                if keyword in lower_text:
                    score += 5

            # Individual keyword
            elif keyword in words:

                score += 2

        # -----------------------------------------------------
        # Important topic words
        # -----------------------------------------------------

        important_matches = words.intersection(
            important_words
        )

        score += len(important_matches) * 2

        # -----------------------------------------------------
        # Cue phrases
        # -----------------------------------------------------

        for phrase in cue_phrases:

            if phrase in lower_text:
                score += 5

        # -----------------------------------------------------
        # Prefer complete meaningful chunks
        # -----------------------------------------------------

        if word_count >= 25:
            score += 4

        elif word_count >= 18:
            score += 3

        elif word_count >= 12:
            score += 2

        elif word_count >= 8:
            score += 1

        # -----------------------------------------------------
        # Penalize weak/generic content
        # -----------------------------------------------------

        weak_phrases = [
            "skills offered",
            "things like",
            "and etc",
            "etc etc",
            "something like",
            "and so on",
            "i want",
            "i would like",
            "thank you",
            "thank you for",
        ]

        for phrase in weak_phrases:

            if phrase in lower_text:
                score -= 4

        # -----------------------------------------------------
        # Penalize incomplete endings
        # -----------------------------------------------------

        incomplete_endings = {
            "and",
            "or",
            "but",
            "because",
            "with",
            "for",
            "to",
            "of",
            "in",
            "on",
            "is",
            "are",
            "was",
            "were",
            "the",
        }

        if words_list:

            last_word = words_list[-1]

            if last_word in incomplete_endings:
                score -= 3

        # -----------------------------------------------------
        # Store scored chunk
        # -----------------------------------------------------

        scored_chunks.append({
            "index": chunk_index,
            "start": chunk[0]["start"],
            "end": chunk[-1]["end"],
            "text": text,
            "score": score,
        })

    if not scored_chunks:
        return []

    # ---------------------------------------------------------
    # 7. Sort chunks by importance
    # ---------------------------------------------------------

    scored_chunks.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    # ---------------------------------------------------------
    # 8. Select best moments
    # ---------------------------------------------------------

    selected = []

    for chunk in scored_chunks:

        # Avoid selecting overlapping or very close moments.
        too_close = any(
            abs(
                float(existing["start"])
                - float(chunk["start"])
            ) < 6
            for existing in selected
        )

        if too_close:
            continue

        selected.append(chunk)

        if len(selected) >= max_moments:
            break

    # ---------------------------------------------------------
    # 9. Return moments chronologically
    # ---------------------------------------------------------

    selected.sort(
        key=lambda item: float(item["start"])
    )

    return [
        {
            "start": round(
                float(item["start"]),
                2
            ),
            "end": round(
                float(item["end"]),
                2
            ),
            "text": item["text"],
            "score": item["score"]
        }
        for item in selected
    ]