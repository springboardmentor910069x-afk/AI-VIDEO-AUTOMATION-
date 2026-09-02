from __future__ import annotations

import re
from typing import Literal

from app.core.config import get_settings
from app.schemas.ai import SummaryRead, TranscriptRead, TutorChatResponse, VideoMetadata


class TutorService:
    async def answer(
        self,
        *,
        video_id: str,
        question: str,
        transcript: TranscriptRead | None,
        summary: SummaryRead | None,
        metadata: VideoMetadata | None = None,
        chat_history: list[dict[str, str]] | None = None,
    ) -> TutorChatResponse:
        clean_question = question.strip()
        language = self._detect_language(clean_question, transcript.full_text if transcript else "")
        provider = get_settings().ai_provider.lower()

        if provider == "groq" and get_settings().groq_api_key:
            result = await self._answer_with_groq(
                video_id=video_id,
                question=clean_question,
                transcript=transcript,
                summary=summary,
                metadata=metadata,
                chat_history=chat_history or [],
                language=language,
            )
            if result:
                return result

        if provider == "openai" and get_settings().openai_api_key:
            result = await self._answer_with_openai(
                video_id=video_id,
                question=clean_question,
                transcript=transcript,
                summary=summary,
                metadata=metadata,
                chat_history=chat_history or [],
                language=language,
            )
            if result:
                return result

        return self._fallback_answer(
            video_id=video_id,
            question=clean_question,
            transcript=transcript,
            summary=summary,
            metadata=metadata,
            language=language,
        )

    async def _answer_with_groq(
        self,
        *,
        video_id: str,
        question: str,
        transcript: TranscriptRead | None,
        summary: SummaryRead | None,
        metadata: VideoMetadata | None,
        chat_history: list[dict[str, str]],
        language: str,
    ) -> TutorChatResponse | None:
        try:
            from groq import Groq

            settings = get_settings()
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model=settings.groq_tutor_model,
                messages=self._messages(question, transcript, summary, metadata, chat_history, language),
                temperature=0.2,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                return None
            return TutorChatResponse(
                video_id=video_id,
                answer=text,
                detected_language=language,
                provider_used="groq",
                citations=self._citations(transcript, summary, metadata),
            )
        except Exception:
            return None

    async def _answer_with_openai(
        self,
        *,
        video_id: str,
        question: str,
        transcript: TranscriptRead | None,
        summary: SummaryRead | None,
        metadata: VideoMetadata | None,
        chat_history: list[dict[str, str]],
        language: str,
    ) -> TutorChatResponse | None:
        try:
            from openai import OpenAI

            settings = get_settings()
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model=settings.openai_tutor_model,
                messages=self._messages(question, transcript, summary, metadata, chat_history, language),
                temperature=0.2,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                return None
            return TutorChatResponse(
                video_id=video_id,
                answer=text,
                detected_language=language,
                provider_used="openai",
                citations=self._citations(transcript, summary, metadata),
            )
        except Exception:
            return None

    def _messages(
        self,
        question: str,
        transcript: TranscriptRead | None,
        summary: SummaryRead | None,
        metadata: VideoMetadata | None,
        chat_history: list[dict[str, str]],
        language: str,
    ) -> list[dict[str, str]]:
        transcript_text = (transcript.full_text if transcript else "")[:14000]
        metadata_text = self._metadata_text(metadata)
        summary_text = (
            f"Short summary:\n{summary.short_summary}\n\nDetailed summary:\n{summary.detailed_summary[:5000]}"
            if summary
            else "Summary not available."
        )
        messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are ClipMind AI Tutor. Give a direct, question-specific answer using only the supplied "
                    "video metadata, transcript, and summary. Never repeat the overall summary unless the user asks "
                    "for a summary. For singer, teacher, channel, uploader, title, or source questions, check VIDEO "
                    "METADATA first. If the user asks who the singer or teacher is, answer with the YouTube channel "
                    "name (or uploader when channel is unavailable), not an inferred artist or speaker. Use this exact "
                    "format: 'Teacher name is: <YouTube channel>.' for teacher questions and 'Singer name is: <YouTube channel>.' "
                    "for singer questions. Do not guess facts from a title. If the sources do not establish an answer, say "
                    "exactly what is missing rather than inventing it. "
                    "Always respond in the same language as the user's latest message. "
                    "Handle Hinglish, Hindi, English, and mixed-language input naturally. "
                    "Keep answers clear, helpful, and educational."
                ),
            },
            {
                "role": "system",
                "content": (
                    f"Detected user language: {language}\n\n"
                    f"VIDEO METADATA:\n{metadata_text}\n\n"
                    f"{summary_text}\n\n"
                    f"Transcript:\n{transcript_text if transcript_text else 'Transcript not available.'}"
                ),
            },
        ]
        for item in chat_history[-6:]:
            role = item.get("role", "")
            content = item.get("content", "").strip()
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content[:4000]})
        messages.append({"role": "user", "content": question[:4000]})
        return messages

    def _fallback_answer(
        self,
        *,
        video_id: str,
        question: str,
        transcript: TranscriptRead | None,
        summary: SummaryRead | None,
        metadata: VideoMetadata | None,
        language: str,
    ) -> TutorChatResponse:
        citations = self._citations(transcript, summary, metadata)
        metadata_answer = self._metadata_answer(question, metadata, language)
        if metadata_answer:
            answer = metadata_answer
        else:
            excerpt = self._best_excerpt(question, transcript)
            if excerpt is None:
                answer = self._not_found_answer(language)
            else:
                answer = excerpt
        return TutorChatResponse(
            video_id=video_id,
            answer=answer,
            detected_language=language,
            provider_used="fallback-nlp",
            citations=citations,
        )

    def _best_excerpt(self, question: str, transcript: TranscriptRead | None) -> str | None:
        if not transcript or not transcript.segments:
            return None
        stop_words = {"what", "which", "who", "when", "where", "why", "how", "is", "are", "the", "a", "an", "video", "tell", "me", "about", "ka", "ki", "ke", "kya", "hai", "kon", "kaun", "batao"}
        question_terms = {word for word in re.findall(r"\w+", question.lower()) if len(word) > 2 and word not in stop_words}
        if not question_terms:
            return None
        ranked = sorted(
            transcript.segments,
            key=lambda segment: sum(1 for word in question_terms if word and word in segment.text.lower()),
            reverse=True,
        )
        top = [segment for segment in ranked[:3] if segment.text.strip() and any(word in segment.text.lower() for word in question_terms)]
        if not top:
            return None
        prefix = "Video mein relevant part:" if self._detect_language(question, "") != "en" else "Relevant video evidence:"
        return prefix + "\n" + "\n".join(f"- {round(segment.start)}s: {segment.text}" for segment in top)

    def _citations(self, transcript: TranscriptRead | None, summary: SummaryRead | None, metadata: VideoMetadata | None) -> list[str]:
        citations: list[str] = []
        if transcript:
            citations.append("transcript")
        if summary:
            citations.append("summary")
        if metadata:
            citations.append("video metadata")
        return citations

    def _metadata_text(self, metadata: VideoMetadata | None) -> str:
        if not metadata:
            return "No source metadata was saved for this video."
        fields = {
            "Platform": metadata.platform,
            "Video title": metadata.title,
            "YouTube channel": metadata.channel_name,
            "Uploader": metadata.uploader,
            "Artist/singer": metadata.artist,
            "Track/song": metadata.track,
            "Description": metadata.description,
            "Source URL": metadata.webpage_url or metadata.source_url,
        }
        return "\n".join(f"{label}: {value}" for label, value in fields.items() if value) or "No usable source metadata."

    def _metadata_answer(self, question: str, metadata: VideoMetadata | None, language: str) -> str | None:
        if not metadata:
            return None
        query = question.lower()
        if re.search(r"\b(channel|uploader|creator|kis channel|kaunsa channel)\b", query):
            value = metadata.channel_name or metadata.uploader
            if value:
                return f"{'Is video ka channel' if language != 'en' else 'The channel for this video is'}: {value}."
        is_singer_question = bool(re.search(r"\b(singer|sing|artist|gaayak)\b", query))
        is_teacher_question = bool(re.search(r"\b(teacher|educator|instructor|professor|sir|maam|mam|kaun padhata|kon padhata)\b", query))
        if is_singer_question or is_teacher_question:
            value = metadata.channel_name or metadata.uploader
            if value:
                label = "Singer name" if is_singer_question else "Teacher name"
                return f"{label} is: {value}."
            return "Is video ka YouTube channel metadata mein available nahi hai." if language != "en" else "The YouTube channel is not available in this video's metadata."
        if re.search(r"\b(title|naam|name)\b", query) and metadata.title:
            return f"{'Video ka title' if language != 'en' else 'The video title is'}: {metadata.title}."
        return None

    def _not_found_answer(self, language: str) -> str:
        if language == "en":
            return "I couldn't find a source-backed answer to that specific question in this video's transcript, summary, or metadata."
        return "Mujhe is specific question ka reliable answer video ke transcript, summary, ya metadata mein nahi mila; main guess nahi karunga."

    def _detect_language(self, text: str, transcript_text: str) -> Literal["en", "hi", "hinglish"]:
        devanagari = len(re.findall(r"[\u0900-\u097F]", text))
        hindi_tokens = len(
            re.findall(
                r"\b(kya|kaise|kyun|hai|hain|mera|meri|mere|iske|isko|samjhao|batao|kr|kar|acha|thoda|poora)\b",
                text.lower(),
            )
        )
        english_tokens = len(re.findall(r"\b(the|what|how|why|explain|summary|video|notes|quiz|please)\b", text.lower()))
        if devanagari > 0:
            return "hi"
        if hindi_tokens > 0 and english_tokens > 0:
            return "hinglish"
        if hindi_tokens > 1:
            return "hinglish"
        transcript_devanagari = len(re.findall(r"[\u0900-\u097F]", transcript_text[:1000]))
        if not text.strip() and transcript_devanagari > 0:
            return "hi"
        return "en"
