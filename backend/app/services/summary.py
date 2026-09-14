from transformers import pipeline
import re


summarizer = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6"
)


def summarize_text(text):
    if not text or not text.strip():
        return ""

    # Clean transcript
    text = re.sub(r"\s+", " ", text).strip()

    # Very short transcript
    if len(text) < 30:
        return text

    # Generate the actual summary
    summary = summarizer(
        text,
        max_length=80,
        min_length=25,
        do_sample=False
    )[0]["summary_text"].strip()

    # --------------------------------------------------
    # Detect whether the transcript is a self-introduction
    # --------------------------------------------------

    lower_text = text.lower()

    self_intro_indicators = [
        "i am",
        "i'm",
        "my name",
        "i have",
        "i am currently",
        "currently pursuing",
        "my project",
        "my projects",
        "my goal",
        "my technical skills",
        "my certification",
        "my experience"
    ]

    is_self_introduction = any(
        phrase in lower_text
        for phrase in self_intro_indicators
    )

    # --------------------------------------------------
    # Convert first-person summary into a cleaner
    # third-person description
    # --------------------------------------------------

    if is_self_introduction:

        summary = re.sub(
            r"\bI am\b",
            "the speaker is",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI'm\b",
            "the speaker is",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI have\b",
            "the speaker has",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI also have\b",
            "the speaker also has",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI am currently\b",
            "the speaker is currently",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI worked\b",
            "the speaker worked",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI developed\b",
            "the speaker developed",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI designed\b",
            "the speaker designed",
            summary,
            flags=re.IGNORECASE
        )

        summary = re.sub(
            r"\bI completed\b",
            "the speaker completed",
            summary,
            flags=re.IGNORECASE
        )

        # Add proper context to the summary
        summary = (
            "This video is a self-introduction in which "
            + summary[0].lower()
            + summary[1:]
        )

    return summary