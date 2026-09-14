from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re

router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    transcript: str
    title: str = ""
    summary: str = ""
    metadata: dict = {}


STOP_WORDS = {
    "what", "when", "where", "which", "who",
    "whom", "whose", "why", "how",
    "does", "did", "do", "is", "are", "was",
    "were", "will", "would", "could", "should",
    "can", "may", "might",

    "the", "this", "that", "these", "those",
    "video", "videos", "speaker",
    "say", "says", "said",
    "tell", "tells", "telling",
    "talk", "talks", "talking",
    "mention", "mentions", "mentioned",
    "discuss", "discusses", "discussed",
    "about",

    "please",
    "you", "your", "they", "their",
    "them", "me", "my", "we", "our", "us",
    "it", "its",

    "give", "some", "more", "much", "many",
    "also", "really", "just", "like",
    "thing", "things",

    "main", "point", "points",
    "idea", "ideas",
    "important", "information",
    "content", "topic", "topics",
    "overview", "summary", "takeaway",
    "takeaways"
}


def normalize_word(word):

    word = re.sub(
        r"[^a-zA-Z0-9]",
        "",
        word.lower()
    )

    variations = {
        "confident": "confidence",
        "confidently": "confidence",

        "empowered": "empowerment",
        "empowering": "empowerment",
        "empowers": "empowerment",

        "fears": "fear",
        "fearful": "fear",
        "afraid": "fear",

        "believes": "believe",
        "believing": "believe",
        "believed": "believe",
        "belief": "believe",

        "stronger": "strong",
        "strongest": "strong",

        "goals": "goal",
        "lessons": "lesson",

        # Metadata-related variations
        "singers": "singer",
        "singing": "sing",
        "songs": "song",
        "artists": "artist",
        "creators": "creator",
        "albums": "album",
        "tracks": "track",
        "channels": "channel",
        "uploaders": "uploader"
    }

    if word in variations:
        return variations[word]

    suffixes = [
        "ingly",
        "edly",
        "ing",
        "ies",
        "ed",
        "es",
        "s"
    ]

    for suffix in suffixes:

        if (
            len(word) >
            len(suffix) + 3
            and word.endswith(suffix)
        ):

            word = word[:-len(suffix)]

            break

    return word


def get_question_words(question):

    words = set()

    for word in re.findall(
        r"[a-zA-Z0-9]+",
        question.lower()
    ):

        word = normalize_word(word)

        if (
            word
            and len(word) >= 4
            and word not in STOP_WORDS
        ):

            words.add(word)

    return words


def split_sentences(text):

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    if not text:
        return []

    sentences = re.split(
        r"(?<=[.!?])\s+",
        text
    )

    return [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]


def sentence_words(text):

    words = set()

    for word in re.findall(
        r"[a-zA-Z0-9]+",
        text.lower()
    ):

        word = normalize_word(word)

        if word:
            words.add(word)

    return words


def score_sentence(
    question_words,
    sentence
):

    if not question_words:
        return 0

    words = sentence_words(
        sentence
    )

    overlap = (
        question_words.intersection(words)
    )

    if not overlap:
        return 0

    score = len(overlap)

    for word in overlap:

        if len(word) >= 7:
            score += 1

    return score


def find_relevant_sentences(
    question,
    sentences,
    max_sentences=3
):

    question_words = get_question_words(
        question
    )

    if not question_words:
        return []

    scored = []

    for index, sentence in enumerate(
        sentences
    ):

        score = score_sentence(
            question_words,
            sentence
        )

        if score > 0:

            scored.append(
                (
                    score,
                    index,
                    sentence
                )
            )

    scored.sort(
        key=lambda item: (
            -item[0],
            item[1]
        )
    )

    selected = scored[
        :max_sentences
    ]

    # Keep transcript order
    selected.sort(
        key=lambda item: item[1]
    )

    return selected


def is_general_question(question):

    return len(
        get_question_words(question)
    ) == 0


# =========================================================
# METADATA SUPPORT
# =========================================================

METADATA_ALIASES = {

    "artist": {
        "artist",
        "singer",
        "vocalist",
        "performer",
        "musician"
    },

    "artists": {
        "artist",
        "singer",
        "vocalist",
        "performer",
        "musician"
    },

    "creator": {
        "creator",
        "producer"
    },

    "track": {
        "track",
        "song"
    },

    "album": {
        "album"
    },

    "channel": {
        "channel"
    },

    "uploader": {
        "uploader",
        "uploaded"
    },

    "description": {
        "description",
        "details"
    },

    "youtube_title": {
        "title",
        "name"
    }
}


def find_metadata_answer(
    question,
    metadata
):

    if not metadata:
        return None

    question_words = get_question_words(
        question
    )

    if not question_words:
        return None

    # Direct uploader intent detection
    question_lower = question.lower()

    if (
        "who uploaded" in question_lower
        or "uploaded by" in question_lower
        or "uploader" in question_lower
    ):
        uploader = metadata.get("uploader")

        if uploader:
            return (
                f"The YouTube video was uploaded by "
                f"{str(uploader).strip()}."
            ), 0.95

        channel = metadata.get("channel")

        if channel:
            return (
                f"The YouTube video is from the channel "
                f"{str(channel).strip()}."
            ), 0.85
    

    # -----------------------------------------------------
    # Direct metadata fields
    # -----------------------------------------------------

    matching_fields = []

    for field, aliases in METADATA_ALIASES.items():

        if question_words.intersection(
            aliases
        ):

            matching_fields.append(
                field
            )

    priority = [
        "artist",
        "artists",
        "creator",
        "track",
        "album",
        "channel",
        "uploader",
        "youtube_title",
        "description"
    ]

    matching_fields.sort(
        key=lambda field:
        priority.index(field)
        if field in priority
        else 999
    )

    # -----------------------------------------------------
    # Try directly matching metadata fields
    # -----------------------------------------------------

    for field in matching_fields:

        value = metadata.get(
            field
        )

        if value is None:
            continue

        if isinstance(
            value,
            list
        ):

            values = [
                str(item).strip()
                for item in value
                if str(item).strip()
            ]

            if values:

                return (
                    f"The available YouTube metadata "
                    f"lists the {field} as: "
                    f"{', '.join(values)}"
                ), 0.95

        else:

            value = str(
                value
            ).strip()

            if value:

                return (
                    f"The available YouTube metadata "
                    f"lists the {field} as: "
                    f"{value}"
                ), 0.95

    # -----------------------------------------------------
    # Singer / artist fallback
    #
    # If artist information is unavailable, use the
    # YouTube uploader/channel when the question asks
    # about a singer, artist, performer or musician.
    # -----------------------------------------------------

    singer_words = {
        "singer",
        "artist",
        "vocalist",
        "performer",
        "musician"
    }

    if question_words.intersection(
        singer_words
    ):

        artist_value = metadata.get(
            "artist"
        )

        artists_value = metadata.get(
            "artists"
        )

        if artist_value:

            return (
                f"The artist listed in the YouTube metadata "
                f"is: {artist_value}"
            ), 0.95

        if artists_value:

            if isinstance(
                artists_value,
                list
            ):

                artists_text = ", ".join(
                    str(item).strip()
                    for item in artists_value
                    if str(item).strip()
                )

            else:

                artists_text = str(
                    artists_value
                ).strip()

            if artists_text:

                return (
                    f"The artists listed in the YouTube metadata "
                    f"are: {artists_text}"
                ), 0.95

        # If no artist field exists, use uploader/channel
        # as the available YouTube identity.
        uploader = metadata.get(
            "uploader"
        )

        channel = metadata.get(
            "channel"
        )

        if uploader:

            return (
                f"The YouTube video is by "
                f"{str(uploader).strip()}. "
                f"The available metadata does not explicitly "
                f"list a separate singer field."
            ), 0.85

        if channel:

            return (
                f"The YouTube channel is "
                f"{str(channel).strip()}. "
                f"The available metadata does not explicitly "
                f"list a separate singer field."
            ), 0.80

    # -----------------------------------------------------
    # Search remaining metadata text
    # -----------------------------------------------------

    metadata_text_parts = []

    for field, value in metadata.items():

        if value is None:
            continue

        if isinstance(
            value,
            list
        ):

            value = ", ".join(
                str(item)
                for item in value
            )

        metadata_text_parts.append(
            str(value)
        )

    metadata_text = " ".join(
        metadata_text_parts
    )

    if not metadata_text:
        return None

    metadata_sentences = split_sentences(
        metadata_text
    )

    relevant = find_relevant_sentences(
        question,
        metadata_sentences,
        max_sentences=2
    )

    if relevant:

        answer = " ".join(
            item[2]
            for item in relevant
        )

        return answer, 0.80

    return None


# =========================================================
# MAIN ANSWER LOGIC
# =========================================================

def make_answer(
    question,
    transcript,
    summary,
    metadata
):

    sentences = split_sentences(
        transcript
    )

    # -----------------------------------------------------
    # 1. Check metadata first
    # -----------------------------------------------------

    metadata_result = find_metadata_answer(
        question,
        metadata
    )

    if metadata_result:

        return metadata_result

    # -----------------------------------------------------
    # 2. General question → existing summary
    # -----------------------------------------------------

    if is_general_question(
        question
    ):

        if summary:

            return (
                summary.strip(),
                1.0
            )

        if sentences:

            return (
                " ".join(
                    sentences[:3]
                ),
                0.8
            )

    # -----------------------------------------------------
    # 3. Transcript retrieval
    # -----------------------------------------------------

    if not sentences:

        return (
            "I couldn't find a reliable answer to that "
            "in this video's content.",
            0.0
        )

    relevant = find_relevant_sentences(
        question,
        sentences,
        max_sentences=3
    )

    if not relevant:

        return (
            "I couldn't find a reliable answer to that "
            "in this video's content.",
            0.0
        )

    answer_parts = [
        item[2]
        for item in relevant
    ]

    answer = " ".join(
        answer_parts
    )

    best_score = relevant[0][0]

    if best_score >= 4:

        confidence = 0.95

    elif best_score >= 2:

        confidence = 0.85

    else:

        confidence = 0.70

    return answer, confidence


# =========================================================
# CHAT ENDPOINT
# =========================================================

@router.post("/chat")
async def chat_with_video(
    request: ChatRequest
):

    question = request.question.strip()

    transcript = request.transcript.strip()

    summary = request.summary.strip()

    metadata = request.metadata or {}

    if not question:

        raise HTTPException(
            status_code=400,
            detail="Please enter a question."
        )

    if not transcript:

        raise HTTPException(
            status_code=400,
            detail=(
                "No transcript is available "
                "for the selected video."
            )
        )

    print(
        "CHATBOT QUESTION:",
        question
    )

    answer, confidence = make_answer(
        question=question,
        transcript=transcript,
        summary=summary,
        metadata=metadata
    )

    print(
        "CHATBOT RESPONSE READY"
    )

    return {
        "question": question,
        "answer": answer,
        "confidence": round(
            confidence,
            3
        )
    }