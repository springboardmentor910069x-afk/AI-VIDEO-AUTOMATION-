from datetime import datetime
import json
import re

from app.core.config import get_settings
from app.schemas.ai import SummaryRead


class SummarizationService:
    async def summarize(self, video_id: str, transcript: str) -> SummaryRead:
        settings = get_settings()
        provider_failed = "transcription was configured but could not run" in transcript
        if not provider_failed and settings.ai_provider.lower() == "groq" and settings.groq_api_key:
            ai_summary = await self._summarize_with_groq(video_id, transcript)
            if ai_summary:
                return ai_summary
        if not provider_failed and settings.ai_provider.lower() == "openai" and settings.openai_api_key:
            ai_summary = await self._summarize_with_openai(video_id, transcript)
            if ai_summary:
                return ai_summary
        sentences = self._sentences(transcript)
        important = self._rank_sentences(sentences)
        short = self._fallback_brief(important, transcript)
        keywords = self._keywords(transcript)
        concepts = self._concepts(transcript, keywords, sentences)
        takeaways = self._takeaways(important, transcript)
        detailed = (
            "Detailed Summary\n\n"
            f"{self._fallback_detailed(important, transcript)}\n\n"
            "Key Takeaways\n"
            + "\n".join(f"- {item}" for item in takeaways)
            + "\n\nKey Concepts\n"
            + "\n".join(f"- {concept}" for concept in concepts)
            + "\n\nSuggested Actions\n"
            "- Rewatch the key moments and verify the exact wording from the transcript.\n"
            "- Use transcript search to find important names, topics, or claims.\n"
            "- Ask AI Tutor follow-up questions from the selected video."
        )
        return SummaryRead(video_id=video_id, short_summary=short, detailed_summary=detailed, generated_at=datetime.utcnow())

    async def translate_summary(self, summary: SummaryRead, language: str) -> SummaryRead:
        target = self._target_language(language)
        settings = get_settings()
        if settings.ai_provider.lower() == "groq" and settings.groq_api_key:
            translated = await self._translate_with_groq(summary, target)
            if translated:
                return translated
        if settings.ai_provider.lower() == "openai" and settings.openai_api_key:
            translated = await self._translate_with_openai(summary, target)
            if translated:
                return translated
        return SummaryRead(
            video_id=summary.video_id,
            short_summary=summary.short_summary,
            detailed_summary=summary.detailed_summary,
            generated_at=datetime.utcnow(),
        )

    async def _summarize_with_groq(self, video_id: str, transcript: str) -> SummaryRead | None:
        try:
            from groq import Groq

            client = Groq(api_key=get_settings().groq_api_key)
            response = client.chat.completions.create(
                model=get_settings().groq_summary_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are ClipMind AI, a careful video-analysis assistant. "
                            "Summarize only from the transcript. Do not invent scenes, names, facts, or conclusions. "
                            "If the transcript is very short, still explain what can be inferred from the exact dialogue and clearly mention that context is limited. "
                            "Return valid JSON only with these keys: brief_summary, detailed_summary, key_takeaways, key_concepts, important_moments, keywords, suggested_actions. "
                            "brief_summary must be 2-4 sentences. detailed_summary must be 2-5 paragraphs. "
                            "key_concepts must be an array of objects with name and explanation, and each explanation must be specific to the transcript."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Create both a brief and detailed summary for this video transcript. "
                            "Make the output useful for a student or creator. Include exact transcript-based meaning, "
                            "key takeaways, important moments, key concepts, keywords, and suggested actions.\n\n"
                            f"Transcript:\n{transcript[:18000]}"
                        ),
                    },
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            text = response.choices[0].message.content or ""
            parsed = json.loads(text)
            return SummaryRead(
                video_id=video_id,
                short_summary=str(parsed.get("brief_summary") or "").strip() or self._fallback_brief(self._rank_sentences(self._sentences(transcript)), transcript),
                detailed_summary=self._format_ai_summary(parsed),
                generated_at=datetime.utcnow(),
            )
        except Exception:
            return None

    async def _summarize_with_openai(self, video_id: str, transcript: str) -> SummaryRead | None:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=get_settings().openai_api_key)
            response = client.chat.completions.create(
                model=get_settings().openai_summary_model,
                messages=[
                    {"role": "system", "content": "You create accurate video summaries from transcripts. Be specific, structured, and do not invent details."},
                    {"role": "user", "content": f"Create a brief summary plus a detailed structured summary with key takeaways, key concepts, important moments, keywords, and suggested actions for this transcript:\n\n{transcript[:12000]}"},
                ],
                temperature=0.2,
            )
            text = response.choices[0].message.content or ""
            sentences = self._sentences(text)
            short = " ".join(sentences[:2]) if sentences else text[:260]
            return SummaryRead(video_id=video_id, short_summary=short, detailed_summary=text, generated_at=datetime.utcnow())
        except Exception:
            return None

    async def _translate_with_groq(self, summary: SummaryRead, language: str) -> SummaryRead | None:
        try:
            from groq import Groq

            client = Groq(api_key=get_settings().groq_api_key)
            response = client.chat.completions.create(
                model=get_settings().groq_summary_model,
                messages=[
                    {"role": "system", "content": self._translation_system_prompt(language)},
                    {
                        "role": "user",
                        "content": (
                            "Translate/rewrite this ClipMind summary. Preserve structure, meaning, facts, timestamps, names, and bullet points. "
                            "Return valid JSON only with keys brief_summary and detailed_summary.\n\n"
                            f"Brief Summary:\n{summary.short_summary}\n\nDetailed Summary:\n{summary.detailed_summary[:14000]}"
                        ),
                    },
                ],
                temperature=0.15,
                response_format={"type": "json_object"},
            )
            data = json.loads(response.choices[0].message.content or "{}")
            return SummaryRead(
                video_id=summary.video_id,
                short_summary=str(data.get("brief_summary") or summary.short_summary).strip(),
                detailed_summary=str(data.get("detailed_summary") or summary.detailed_summary).strip(),
                generated_at=datetime.utcnow(),
            )
        except Exception:
            return None

    async def _translate_with_openai(self, summary: SummaryRead, language: str) -> SummaryRead | None:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=get_settings().openai_api_key)
            response = client.chat.completions.create(
                model=get_settings().openai_summary_model,
                messages=[
                    {"role": "system", "content": self._translation_system_prompt(language)},
                    {
                        "role": "user",
                        "content": (
                            "Return JSON with brief_summary and detailed_summary.\n\n"
                            f"Brief Summary:\n{summary.short_summary}\n\nDetailed Summary:\n{summary.detailed_summary[:12000]}"
                        ),
                    },
                ],
                temperature=0.15,
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            return SummaryRead(
                video_id=summary.video_id,
                short_summary=str(data.get("brief_summary") or summary.short_summary).strip(),
                detailed_summary=str(data.get("detailed_summary") or summary.detailed_summary).strip(),
                generated_at=datetime.utcnow(),
            )
        except Exception:
            return None

    def _sentences(self, text: str) -> list[str]:
        return [item.strip() for item in re.split(r"(?<=[.!?])\s+", text) if item.strip()]

    def _target_language(self, language: str) -> str:
        normalized = language.strip().lower()
        if normalized in {"hindi", "hi"}:
            return "hindi"
        if normalized in {"hinglish", "roman hindi", "roman-hindi"}:
            return "hinglish"
        return "english"

    def _translation_system_prompt(self, language: str) -> str:
        if language == "hindi":
            target = "natural Hindi in Devanagari script"
        elif language == "hinglish":
            target = "natural Hinglish written in Roman script, mixing simple Hindi and English as Indian students speak"
        else:
            target = "clear English"
        return (
            "You are ClipMind AI's summary localization engine. "
            f"Rewrite the summary into {target}. "
            "Do not add new facts. Do not remove important details. Preserve headings, bullet structure, names, code words, and timestamps. "
            "Keep the result easy to read and useful. Return valid JSON only."
        )

    def _keywords(self, text: str) -> list[str]:
        stopwords = {
            "this", "that", "with", "from", "into", "about", "video", "uploaded", "summary", "the", "and", "for", "you", "are",
            "have", "will", "been", "they", "their", "there", "what", "when", "where", "your", "could", "would", "should",
            "read", "hear", "like", "just", "some", "only", "than", "then", "tends", "back"
        }
        words = re.findall(r"[A-Za-z][A-Za-z0-9'-]{3,}", text.lower())
        scores: dict[str, int] = {}
        for word in words:
            if word not in stopwords:
                scores[word] = scores.get(word, 0) + 1
        return [word for word, _ in sorted(scores.items(), key=lambda item: item[1], reverse=True)]

    def _rank_sentences(self, sentences: list[str]) -> list[str]:
        if not sentences:
            return []
        keywords = set(self._keywords(" ".join(sentences))[:12])
        return sorted(sentences, key=lambda sentence: sum(1 for word in keywords if word in sentence.lower()) + min(len(sentence), 180) / 180, reverse=True)

    def _fallback_brief(self, important: list[str], transcript: str) -> str:
        if important:
            return " ".join(important[:3])
        return transcript[:420].strip() or "The transcript is too short to summarize confidently."

    def _fallback_detailed(self, important: list[str], transcript: str) -> str:
        if important:
            return " ".join(important[:8])
        if transcript.strip():
            return (
                "The available transcript is limited, so the summary is based only on the exact spoken text. "
                f"The video includes this core content: {transcript[:900].strip()}"
            )
        return "No usable transcript text was available for detailed summarization."

    def _takeaways(self, important: list[str], transcript: str) -> list[str]:
        source = important or self._sentences(transcript)
        takeaways = [self._clean_sentence(sentence) for sentence in source[:5] if self._clean_sentence(sentence)]
        if takeaways:
            return takeaways
        return ["The transcript is too short to extract strong takeaways."]

    def _concepts(self, transcript: str, keywords: list[str], sentences: list[str]) -> list[str]:
        concepts: list[str] = []
        for keyword in keywords[:6]:
            evidence = next((sentence for sentence in sentences if keyword in sentence.lower()), "")
            if evidence:
                concepts.append(f"{keyword.title()}: Important because the transcript says, \"{self._clean_sentence(evidence)[:160]}\"")
            else:
                concepts.append(f"{keyword.title()}: Appears as an important term in the transcript.")
        if concepts:
            return concepts
        return ["Limited Context: The transcript is too short to identify strong key concepts."]

    def _format_ai_summary(self, data: dict) -> str:
        def text(value: object) -> str:
            return str(value or "").strip()

        def bullet_items(items: object) -> str:
            if not isinstance(items, list) or not items:
                return "- Not enough transcript detail available."
            lines: list[str] = []
            for item in items[:8]:
                if isinstance(item, dict):
                    name = text(item.get("name") or item.get("title") or item.get("timestamp") or "Point")
                    explanation = text(item.get("explanation") or item.get("description") or item.get("detail") or item.get("text"))
                    lines.append(f"- {name}: {explanation}" if explanation else f"- {name}")
                else:
                    lines.append(f"- {text(item)}")
            return "\n".join(line for line in lines if line.strip() != "-")

        sections = [
            ("Detailed Summary", text(data.get("detailed_summary"))),
            ("Key Takeaways", bullet_items(data.get("key_takeaways"))),
            ("Key Concepts", bullet_items(data.get("key_concepts"))),
            ("Important Moments", bullet_items(data.get("important_moments"))),
            ("Keywords", ", ".join(text(item) for item in data.get("keywords", [])[:12]) if isinstance(data.get("keywords"), list) else text(data.get("keywords"))),
            ("Suggested Actions", bullet_items(data.get("suggested_actions"))),
        ]
        return "\n\n".join(f"{title}\n\n{body}" for title, body in sections if body)

    def _clean_sentence(self, sentence: str) -> str:
        return " ".join(sentence.split()).strip(" -")
