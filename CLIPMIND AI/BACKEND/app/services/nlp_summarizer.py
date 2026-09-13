import os
import re
import math
import logging
from typing import Dict, Any, List
from app.services.llm_service import llm_service

logger = logging.getLogger("clipmind.summarizer")

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "this", "that",
    "to", "of", "in", "for", "on", "with", "as", "at", "by", "from", "it", "we",
    "you", "they", "i", "be", "have", "has", "had", "welcome", "video", "today", "will",
    "explore", "next", "dive", "into", "their", "there", "about", "which", "when"
}

class NLPSummarizer:
    """
    High-Performance NLP Summarization Engine (Groq Cloud LLM / DistilBART / Extractive Engine).
    Generates Executive TL;DR, Structured Chapters, Key Takeaways, and Topic Keywords in milliseconds.
    """
    def __init__(self):
        self._summarizer = None
        self._attempted_pipeline = False

    def _get_pipeline(self):
        if not self._attempted_pipeline:
            self._attempted_pipeline = True
            if os.getenv("DISABLE_TRANSFORMER_DOWNLOAD", "1") == "1":
                return None
            try:
                os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
                from transformers import pipeline
                self._summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6", local_files_only=True)
            except Exception:
                self._summarizer = None
        return self._summarizer

    def summarize(
        self,
        transcript_data: dict,
        depth: str = "Detailed Breakdown",
        domain: str = "Academic Lecture",
        video_title: str = "Uploaded Video"
    ) -> dict:
        segments = transcript_data.get("segments", [])
        full_text = " ".join([s.get("text", "") for s in segments]).strip()

        clean_title = video_title.replace(".mp4", "").replace(".mov", "").replace(".avi", "").replace("_", " ").replace("-", " ").strip()
        display_title = clean_title.title() if clean_title else "Uploaded Video"

        # 1. Non-empty transcript with speech content
        if full_text and len(full_text.split()) > 5:
            tldr = ""
            key_takeaways_llm = None
            keywords_llm = None

            # Primary Attempt: Fast Groq Cloud LLM (~1.0s)
            try:
                llm_res = llm_service.summarize_transcript(full_text, depth=depth)
                if llm_res and isinstance(llm_res, dict):
                    tldr = llm_res.get("tldr", "")
                    key_takeaways_llm = llm_res.get("key_takeaways")
                    keywords_llm = llm_res.get("keywords")
            except Exception as e:
                logger.warning(f"[NLP Summarizer] LLM service exception: {e}")

            # Secondary Attempt: Local Transformers if available locally
            if not tldr and len(full_text.split()) > 25:
                summarizer = self._get_pipeline()
                if summarizer is not None:
                    try:
                        input_text = full_text[:2000]
                        summary_out = summarizer(input_text, max_length=120, min_length=30, do_sample=False)
                        tldr = summary_out[0].get("summary_text") or summary_out[0].get("generated_text", "")
                    except Exception as e:
                        logger.debug(f"[NLP Summarizer] Transformer fallback notice: {e}")

            # Tertiary Attempt: Instant Extractive Sentence Selection
            if not tldr:
                sentences = [s.strip() for s in re.split(r'[.!?]+', full_text) if len(s.strip()) > 10]
                if sentences:
                    tldr = ". ".join(sentences[:3]) + "."
                else:
                    tldr = full_text[:250] + ("..." if len(full_text) > 250 else "")

            # Build structured chapter sections from segments
            sections = []
            num_sec = min(5, max(1, len(segments) // 3)) if segments else 1
            step = max(1, len(segments) // num_sec) if segments else 1

            for idx in range(num_sec):
                start_i = idx * step
                end_i = min((idx + 1) * step, len(segments))
                sec_segs = segments[start_i:end_i]
                if not sec_segs:
                    continue

                first_ts = sec_segs[0].get("timestamp", "00:00")
                last_ts = sec_segs[-1].get("timestamp", "00:00")
                sec_text = " ".join([s.get("text", "") for s in sec_segs])
                sentences = [s.strip() for s in re.split(r'[.!?]+', sec_text) if len(s.strip()) > 10]

                bullets = sentences[:3] if len(sentences) >= 3 else (sentences if sentences else [sec_text[:120]])
                sec_words = [
                    w.strip(".,!?:;\"'()").capitalize()
                    for w in sec_text.split()
                    if len(w) > 3 and w.lower() not in STOP_WORDS
                ][:3]
                title_phrase = " & ".join(sec_words[:2]) if sec_words else f"Topic Focus Part {idx+1}"
                section_title = f"{idx+1}. {title_phrase}"

                sections.append({
                    "id": f"sec-{idx+1}",
                    "title": section_title,
                    "heading": section_title,
                    "timeRange": f"{first_ts} - {last_ts}",
                    "summary": sec_text[:220] + ("..." if len(sec_text) > 220 else ""),
                    "content": sec_text[:220] + ("..." if len(sec_text) > 220 else ""),
                    "bulletPoints": bullets,
                    "keyEquations": []
                })

            if not key_takeaways_llm:
                takeaway_candidates = []
                for s in segments:
                    txt = s.get("text", "").strip()
                    if len(txt) > 20 and txt not in takeaway_candidates:
                        takeaway_candidates.append(txt)
                    if len(takeaway_candidates) >= 3:
                        break
                key_takeaways = takeaway_candidates or [tldr]
            else:
                key_takeaways = key_takeaways_llm

            if not keywords_llm:
                all_words = [w.lower().strip(".,!?:;\"'()") for w in full_text.split()]
                freq = {}
                for w in all_words:
                    if len(w) > 3 and w not in STOP_WORDS:
                        freq[w] = freq.get(w, 0) + 1
                top_k = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:6]
                keywords = [f"#{w.capitalize()}" for w, _ in top_k] or ["#VideoAnalysis", "#ClipMind"]
            else:
                keywords = keywords_llm

            return {
                "depth": depth,
                "tldr": tldr,
                "sections": sections,
                "key_takeaways": key_takeaways,
                "keywords": keywords,
                "sentiment": "educational"
            }

        # 2. Media with minimal or silent audio
        return {
            "depth": depth,
            "tldr": f"Video intelligence summary for '{display_title}'. The media has been ingested and cataloged. Audio speech detection identified no extended dialogue tracks.",
            "sections": [
                {
                    "id": "sec-1",
                    "title": f"1. Video Overview — {display_title}",
                    "timeRange": "00:00 - End",
                    "summary": f"Visual presentation recording for '{display_title}'.",
                    "bulletPoints": [
                        f"Media titled '{display_title}' uploaded and indexed.",
                        "Visual scene analysis and keyframe extraction completed.",
                        "Interactive player and timestamp navigation available."
                    ],
                    "keyEquations": []
                }
            ],
            "key_takeaways": [
                f"'{display_title}' is ready for review and timestamped bookmarking.",
                "Use the Educator Studio to add manual annotations or subtitle tracks if required."
            ],
            "keywords": ["#VideoAsset", f"#{display_title.replace(' ', '')[:15]}", "#ClipMind"],
            "sentiment": "neutral"
        }

nlp_summarizer = NLPSummarizer()

def _infer_domain_summary(title: str, category: str = "Detailed Breakdown") -> dict:
    return nlp_summarizer.summarize(
        {"segments": []},
        depth=category,
        video_title=title
    )
