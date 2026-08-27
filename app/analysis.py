from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

# Standard English stopwords for NLP processing
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
    "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves", "also", "just", "like", "get", "go", "going", "know",
    "see", "well", "one", "even", "really", "actually", "make", "take", "think",
    "say", "said", "look", "come", "could", "would", "way", "much", "many", "back"
}

# Discourse cues indicating significance or topic transitions
CUE_PATTERNS = {
    "key_takeaway": [
        r"\b(?:key takeaway|main takeaway|takeaway|bottom line|remember that|crucial to understand|the key is|most important(?:ly)?|in conclusion|to conclude|to sum up|in summary)\b",
        r"\b(?:keep in mind|don't forget|vital point|golden rule|pro tip|rule of thumb)\b"
    ],
    "action_item": [
        r"\b(?:step (?:one|two|three|\d+)|first(?:ly)?,?\s+you|next,?\s+you|finally,?\s+you|how to|action item|to implement|recommended practice|make sure to|you should)\b",
        r"\b(?:best practice|checklist|start by|procedure|instruction)\b"
    ],
    "core_concept": [
        r"\b(?:what is|defined as|definition|concept of|principle of|architecture of|core mechanism|fundamentally|in essence|means that|specifically|introduced as)\b",
        r"\b(?:theoretical|framework|foundation|overview of|component of)\b"
    ],
    "highlight": [
        r"\b(?:huge|remarkable|breakthrough|critical|fascinating|game changer|surprising|notably|significant(?:ly)?|major advantage|dramatic|essential)\b"
    ]
}


def split_sentences(text: str) -> list[str]:
    """Split text into sentences cleanly."""
    if not text:
        return []
    cleaned = re.sub(r"\s+", " ", text.strip())
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
    return sentences if sentences else [cleaned]


def format_timestamp(seconds: float) -> str:
    """Format seconds into HH:MM:SS or MM:SS format."""
    total_seconds = max(0, int(seconds))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def extract_or_generate_segments(text: str, duration_seconds: float | None = None) -> list[dict[str, Any]]:
    """
    Ensure we have timestamped segments. If explicit timestamps exist in text ([01:23] ...),
    parse them. Otherwise, intelligently divide sentences across duration or default pace.
    """
    if not text or not text.strip():
        return []

    # Check for explicit timestamp markers like [00:15] or 01:20:
    explicit_matches = list(re.finditer(r"\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+?)(?=\[?\d{1,2}:\d{2}|$)", text, re.DOTALL))
    if len(explicit_matches) >= 2:
        segments = []
        for i, match in enumerate(explicit_matches):
            time_str = match.group(1)
            parts = [float(p) for p in time_str.split(":")]
            if len(parts) == 3:
                start_sec = parts[0] * 3600 + parts[1] * 60 + parts[2]
            else:
                start_sec = parts[0] * 60 + parts[1]
            content = match.group(2).strip()
            if not content:
                continue
            # End time from next match or estimated
            if i + 1 < len(explicit_matches):
                next_parts = [float(p) for p in explicit_matches[i+1].group(1).split(":")]
                next_sec = next_parts[0] * 3600 + next_parts[1] * 60 + next_parts[2] if len(next_parts) == 3 else next_parts[0] * 60 + next_parts[1]
                end_sec = max(start_sec + 2.0, next_sec)
            else:
                end_sec = max(start_sec + 5.0, (duration_seconds or start_sec + 15.0))
            segments.append({
                "start": round(start_sec, 2),
                "end": round(end_sec, 2),
                "text": content
            })
        if segments:
            return segments

    sentences = split_sentences(text)
    if not sentences:
        return []

    total_words = sum(len(s.split()) for s in sentences)
    if total_words == 0:
        return []

    # If duration given, scale proportionally; else assume average speaking pace 140 WPM (~2.33 words/sec)
    effective_duration = duration_seconds if (duration_seconds and duration_seconds > 5) else max(10.0, (total_words / 140.0) * 60.0)

    segments = []
    current_time = 0.0
    for s in sentences:
        words_in_s = len(s.split())
        fraction = max(0.01, words_in_s / total_words)
        duration_s = max(2.0, fraction * effective_duration)
        end_time = min(effective_duration, current_time + duration_s)
        segments.append({
            "start": round(current_time, 2),
            "end": round(end_time, 2),
            "text": s
        })
        current_time = end_time

    return segments


def extract_keywords_rake(text: str, top_n: int = 15) -> list[dict[str, Any]]:
    """
    Extract key terms and multi-word phrases using RAKE + TF-IDF hybrid scoring.
    Categorizes terms into Concept, Technology, Action, or Topic.
    """
    if not text or not text.strip():
        return []

    # Tokenize words for vocabulary and frequency
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9_\-]{2,}\b", text.lower())
    if not words:
        return []

    total_words = len(words)
    word_freq = Counter(words)
    meaningful_words = {w: count for w, count in word_freq.items() if w not in STOPWORDS and len(w) > 2}

    # Extract candidate multi-word phrases (sequences between punctuation / stopwords)
    phrases = []
    clauses = re.split(r"[,.!?;:()\[\]\"'\n\t]+", text.lower())
    for clause in clauses:
        tokens = clause.strip().split()
        current_phrase = []
        for token in tokens:
            cleaned_token = re.sub(r"[^a-zA-Z0-9_\-]", "", token)
            if cleaned_token and cleaned_token not in STOPWORDS and len(cleaned_token) > 2:
                current_phrase.append(cleaned_token)
            else:
                if current_phrase:
                    if len(current_phrase) <= 4:
                        phrases.append(" ".join(current_phrase))
                    current_phrase = []
        if current_phrase and len(current_phrase) <= 4:
            phrases.append(" ".join(current_phrase))

    # Calculate word degree / co-occurrence
    word_degree: dict[str, int] = Counter()
    for phrase in phrases:
        p_words = phrase.split()
        p_len = len(p_words)
        for w in p_words:
            word_degree[w] += p_len

    # Word score = degree(w) / freq(w)
    word_scores = {}
    for w, freq in meaningful_words.items():
        deg = word_degree.get(w, freq)
        word_scores[w] = (deg / freq) * (1.0 + math.log(freq + 1))

    # Score phrases
    phrase_counts = Counter(phrases)
    scored_phrases: dict[str, float] = {}
    for phrase, count in phrase_counts.items():
        p_words = phrase.split()
        score = sum(word_scores.get(w, 1.0) for w in p_words)
        length_bonus = 1.2 if len(p_words) == 2 else (1.3 if len(p_words) == 3 else 1.0)
        scored_phrases[phrase] = score * length_bonus * (1.0 + math.log(count + 1))

    # Also include high scoring individual words if not already dominating
    for w, score in word_scores.items():
        if w not in scored_phrases:
            scored_phrases[w] = score * (1.0 + math.log(meaningful_words[w] + 1))

    if not scored_phrases:
        return []

    max_score = max(scored_phrases.values()) if scored_phrases else 1.0
    sorted_items = sorted(scored_phrases.items(), key=lambda x: x[1], reverse=True)

    tech_indicators = {"api", "sql", "ai", "model", "python", "video", "ffmpeg", "whisper", "database", "server", "code", "react", "app", "data", "cloud", "docker", "auth", "jwt"}
    action_indicators = {"build", "process", "deploy", "generate", "create", "test", "extract", "train", "optimize", "analyze", "detect", "manage", "upload"}

    results = []
    seen = set()
    for phrase, raw_score in sorted_items:
        if any(phrase in s or s in phrase for s in seen if len(phrase) > 3 and len(s) > 3 and phrase != s):
            continue

        normalized_score = round(min(1.0, max(0.2, raw_score / max_score)), 2)
        count = phrase_counts.get(phrase, meaningful_words.get(phrase, 1))

        # Categorize
        cat = "topic"
        p_words = phrase.split()
        if any(w in tech_indicators for w in p_words):
            cat = "technology"
        elif any(w in action_indicators for w in p_words):
            cat = "process"
        elif len(p_words) > 1:
            cat = "concept"
        else:
            cat = "topic"

        results.append({
            "keyword": phrase.title() if len(phrase) > 3 else phrase.upper(),
            "score": normalized_score,
            "frequency": count,
            "category": cat
        })
        seen.add(phrase)
        if len(results) >= top_n:
            break

    return results


def detect_key_moments(transcript: str, segments: list[dict[str, Any]], duration_seconds: float = 0.0) -> list[dict[str, Any]]:
    """
    Detect important video segments and timestamps using lexical salience,
    discourse marker heuristics, and information density scoring.
    """
    if not segments:
        segments = extract_or_generate_segments(transcript, duration_seconds)
    if not segments:
        return []

    words = re.findall(r"\b[a-zA-Z]{3,}\b", transcript.lower())
    word_freq = Counter(w for w in words if w not in STOPWORDS)

    candidate_windows: list[dict[str, Any]] = []
    current_chunk: list[dict[str, Any]] = []
    current_start = segments[0]["start"]

    for seg in segments:
        current_chunk.append(seg)
        chunk_duration = seg["end"] - current_start
        if chunk_duration >= 25.0 or len(current_chunk) >= 4:
            text_block = " ".join(s["text"] for s in current_chunk).strip()
            candidate_windows.append({
                "start_time": current_start,
                "end_time": seg["end"],
                "text": text_block,
                "segments": current_chunk
            })
            current_chunk = []
            current_start = seg["end"]

    if current_chunk:
        text_block = " ".join(s["text"] for s in current_chunk).strip()
        candidate_windows.append({
            "start_time": current_start,
            "end_time": segments[-1]["end"],
            "text": text_block,
            "segments": current_chunk
        })

    if len(candidate_windows) <= 1 and len(segments) >= 2:
        candidate_windows = []
        mid = len(segments) // 2
        first_half = segments[:mid]
        second_half = segments[mid:]
        candidate_windows.append({
            "start_time": first_half[0]["start"],
            "end_time": first_half[-1]["end"],
            "text": " ".join(s["text"] for s in first_half),
            "segments": first_half
        })
        candidate_windows.append({
            "start_time": second_half[0]["start"],
            "end_time": second_half[-1]["end"],
            "text": " ".join(s["text"] for s in second_half),
            "segments": second_half
        })

    moments = []
    for idx, cand in enumerate(candidate_windows):
        text = cand["text"]
        text_lower = text.lower()
        cand_words = [w for w in re.findall(r"\b[a-zA-Z]{3,}\b", text_lower) if w not in STOPWORDS]

        salience_score = sum(word_freq.get(w, 1) for w in cand_words) / (len(cand_words) + 5) if cand_words else 0.5

        category = "highlight"
        cue_bonus = 0.0

        for cat, patterns in CUE_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, text_lower):
                    category = cat
                    cue_bonus += 1.5
                    break
            if cue_bonus > 0:
                break

        if idx == 0 and any(w in text_lower for w in ("welcome", "overview", "today", "start", "introduce", "first")):
            category = "core_concept"
            cue_bonus += 0.8
        elif idx == len(candidate_windows) - 1 and any(w in text_lower for w in ("summary", "conclusion", "thank", "wrap", "result")):
            category = "key_takeaway"
            cue_bonus += 1.0

        raw_importance = salience_score * 0.4 + cue_bonus * 1.5 + (len(cand_words) / 30.0) * 0.3
        cand["raw_score"] = raw_importance
        cand["category"] = category

    max_s = max((c["raw_score"] for c in candidate_windows), default=1.0)
    min_s = min((c["raw_score"] for c in candidate_windows), default=0.0)
    range_s = max(0.001, max_s - min_s)

    for idx, cand in enumerate(candidate_windows):
        norm_score = round(0.55 + 0.40 * ((cand["raw_score"] - min_s) / range_s), 2)
        norm_score = min(0.98, max(0.50, norm_score))

        text_sentences = split_sentences(cand["text"])
        summary = text_sentences[0] if text_sentences else cand["text"]
        if len(text_sentences) > 1 and len(summary) < 60:
            summary = f"{summary} {text_sentences[1]}"
        if len(summary) > 220:
            summary = summary[:217] + "..."

        first_words = [w.title() for w in cand["text"].split()[:5] if w.lower() not in STOPWORDS]
        label_topic = " ".join(first_words[:3]) if first_words else f"Segment {idx + 1}"

        category_titles = {
            "key_takeaway": "Key Takeaway",
            "action_item": "Action Item",
            "core_concept": "Core Concept",
            "highlight": "Notable Highlight",
            "discussion": "Topic Discussion"
        }
        clean_label = f"{category_titles.get(cand['category'], 'Moment')}: {label_topic}"

        moments.append({
            "start_time": round(cand["start_time"], 2),
            "end_time": round(cand["end_time"], 2),
            "label": clean_label[:70],
            "summary": summary,
            "importance_score": norm_score,
            "category": cand["category"],
            "formatted_time": f"{format_timestamp(cand['start_time'])} - {format_timestamp(cand['end_time'])}"
        })

    return sorted(moments, key=lambda m: m["start_time"])


def analyze_content_insights(transcript: str, duration_seconds: float = 0.0) -> dict[str, Any]:
    """
    Perform multi-dimensional content analysis:
    - Word count, reading time
    - Speaking pace (WPM) & assessment
    - Lexical diversity (TTR) & complexity rating
    - Sentiment & tone classification
    """
    if not transcript or not transcript.strip():
        return {
            "word_count": 0,
            "reading_time_minutes": 0.0,
            "speaking_pace_wpm": 0,
            "pace_rating": "N/A",
            "lexical_diversity": 0.0,
            "complexity_level": "Foundational",
            "sentiment_tone": "Informative / Neutral",
            "sentiment_score": 0.0,
            "sentence_count": 0,
            "avg_sentence_length": 0.0
        }

    words = re.findall(r"\b[a-zA-Z0-9_\-]+\b", transcript)
    total_words = len(words)
    unique_words = len(set(w.lower() for w in words))
    sentences = split_sentences(transcript)
    total_sentences = max(1, len(sentences))

    reading_time = round(total_words / 200.0, 1)

    effective_duration_min = (duration_seconds / 60.0) if duration_seconds > 0 else (total_words / 140.0)
    effective_duration_min = max(0.1, effective_duration_min)
    speaking_wpm = int(round(total_words / effective_duration_min))

    if speaking_wpm < 115:
        pace_rating = "Deliberate / Measured"
    elif speaking_wpm <= 165:
        pace_rating = "Optimal / Conversational"
    else:
        pace_rating = "Fast / High Energy"

    lexical_diversity = round((unique_words / total_words) if total_words > 0 else 0.0, 3)

    avg_sentence_len = round(total_words / total_sentences, 1)
    long_words = sum(1 for w in words if len(w) >= 7)
    long_word_ratio = (long_words / total_words) if total_words > 0 else 0.0

    if avg_sentence_len > 18 or long_word_ratio > 0.28:
        complexity_level = "Advanced / Technical"
    elif avg_sentence_len > 12 or long_word_ratio > 0.18:
        complexity_level = "Intermediate"
    else:
        complexity_level = "Foundational / Accessible"

    positive_words = {"great", "excellent", "best", "effective", "benefit", "powerful", "success", "innovative", "fast", "easy", "perfect", "advantage", "improve", "helpful", "good"}
    analytical_words = {"analyze", "system", "architecture", "data", "process", "framework", "performance", "metric", "implement", "function", "scale", "method", "structure"}
    critical_words = {"problem", "issue", "error", "risk", "difficult", "challenge", "fail", "slow", "bottleneck", "flaw", "bug"}

    pos_count = sum(1 for w in words if w.lower() in positive_words)
    ana_count = sum(1 for w in words if w.lower() in analytical_words)
    crit_count = sum(1 for w in words if w.lower() in critical_words)

    polarity = (pos_count - crit_count) / max(1, (pos_count + crit_count + 2))
    sentiment_score = round(polarity, 2)

    if ana_count >= max(pos_count, crit_count) and ana_count >= 2:
        sentiment_tone = "Analytical / Technical"
    elif polarity > 0.2:
        sentiment_tone = "Positive & Inspiring"
    elif polarity < -0.2:
        sentiment_tone = "Critical & Problem-Solving"
    else:
        sentiment_tone = "Informative & Objective"

    return {
        "word_count": total_words,
        "reading_time_minutes": reading_time,
        "speaking_pace_wpm": speaking_wpm,
        "pace_rating": pace_rating,
        "lexical_diversity": lexical_diversity,
        "complexity_level": complexity_level,
        "sentiment_tone": sentiment_tone,
        "sentiment_score": sentiment_score,
        "sentence_count": total_sentences,
        "avg_sentence_length": avg_sentence_len
    }


def generate_highlight_report(
    video_title: str,
    duration_seconds: float,
    transcript: str,
    summaries: list[dict[str, str]],
    key_moments: list[dict[str, Any]],
    keywords: list[dict[str, Any]],
    insights: dict[str, Any]
) -> dict[str, Any]:
    """
    Synthesize an executive highlight report combining key moments,
    abstractive summaries, keywords, and speech analytics.
    """
    short_summary = next((s["content"] for s in summaries if s.get("summary_type") == "short"), "")
    detailed_summary = next((s["content"] for s in summaries if s.get("summary_type") == "detailed"), "")

    top_takeaways = [m["summary"] for m in key_moments if m["category"] in {"key_takeaway", "action_item"}][:4]
    if not top_takeaways:
        top_takeaways = [m["summary"] for m in key_moments[:3]]

    top_highlights = sorted(key_moments, key=lambda m: m["importance_score"], reverse=True)[:5]
    top_keywords_list = [k["keyword"] for k in keywords[:8]]

    formatted_duration = format_timestamp(duration_seconds)

    report_markdown = f"""# ClipMind AI Highlight Report: {video_title}

**Duration:** {formatted_duration} | **Word Count:** {insights.get('word_count', 0)} | **Speaking Pace:** {insights.get('speaking_pace_wpm', 0)} WPM ({insights.get('pace_rating', 'Optimal')})

---

## 📌 Executive Summary
{detailed_summary or short_summary or 'Summary not generated yet.'}

---

## 💡 Key Takeaways & Action Items
{chr(10).join(f"- {t}" for t in top_takeaways) if top_takeaways else '- No explicit takeaways identified.'}

---

## ⏱️ Top Key Moments & Highlights
| Timestamp | Category | Highlight & Importance |
| :--- | :--- | :--- |
"""
    for h in top_highlights:
        score_pct = int(h['importance_score'] * 100)
        report_markdown += f"| `{h['formatted_time']}` | **{h['label']}** | {h['summary']} (*Score: {score_pct}%*) |\n"

    report_markdown += f"""
---

## 🏷️ Key Concepts & Topics
{", ".join(f"**{kw}**" for kw in top_keywords_list) if top_keywords_list else 'None extracted.'}

---

## 📊 Content & Speech Intelligence
- **Reading Time:** ~{insights.get('reading_time_minutes', 0)} minutes
- **Vocabulary Diversity:** {int(insights.get('lexical_diversity', 0) * 100)}% unique terms
- **Complexity Level:** {insights.get('complexity_level', 'Intermediate')}
- **Tone & Style:** {insights.get('sentiment_tone', 'Informative & Objective')}
"""

    return {
        "title": f"Highlight Report: {video_title}",
        "video_title": video_title,
        "duration_seconds": duration_seconds,
        "formatted_duration": formatted_duration,
        "executive_summary": detailed_summary or short_summary,
        "takeaways": top_takeaways,
        "top_highlights": top_highlights,
        "keywords": top_keywords_list,
        "insights": insights,
        "markdown": report_markdown.strip()
    }


def export_transcript_srt(segments: list[dict[str, Any]]) -> str:
    """Export segments in SubRip (.srt) subtitle format."""
    lines = []
    for i, seg in enumerate(segments, 1):
        start_ts = format_srt_timestamp(seg["start"])
        end_ts = format_srt_timestamp(seg["end"])
        lines.append(f"{i}\n{start_ts} --> {end_ts}\n{seg['text']}\n")
    return "\n".join(lines)


def export_transcript_vtt(segments: list[dict[str, Any]]) -> str:
    """Export segments in WebVTT (.vtt) format."""
    lines = ["WEBVTT\n"]
    for i, seg in enumerate(segments, 1):
        start_ts = format_vtt_timestamp(seg["start"])
        end_ts = format_vtt_timestamp(seg["end"])
        lines.append(f"{start_ts} --> {end_ts}\n{seg['text']}\n")
    return "\n".join(lines)


def format_srt_timestamp(seconds: float) -> str:
    sec_int = int(seconds)
    millis = int((seconds - sec_int) * 1000)
    hours = sec_int // 3600
    minutes = (sec_int % 3600) // 60
    secs = sec_int % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_vtt_timestamp(seconds: float) -> str:
    sec_int = int(seconds)
    millis = int((seconds - sec_int) * 1000)
    hours = sec_int // 3600
    minutes = (sec_int % 3600) // 60
    secs = sec_int % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
