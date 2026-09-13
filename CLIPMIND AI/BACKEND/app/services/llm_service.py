import os
import json
import logging
from typing import Dict, Any, Optional, List
import httpx
from app.config import settings

logger = logging.getLogger("clipmind.llm")

import re

# Fast, active Groq chat models in priority order
CANDIDATE_GROQ_MODELS = [
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "groq/compound",
    "groq/compound-mini"
]

class LLMService:
    """
    High-Performance LLM Intelligence Service for ClipMind AI.
    Features sub-second structured JSON summarization via Groq Cloud LLMs and local fallbacks.
    """

    def __init__(self):
        self.whisper_model = settings.AI_MODEL_WHISPER
        self.summarizer_model = settings.AI_MODEL_SUMMARIZER
        self.api_key = getattr(settings, "GROQ_API_KEY", "") or getattr(settings, "GROK_API_KEY", "") or ""
        self.ollama_url = getattr(settings, "OLLAMA_URL", "http://localhost:11434")
        self.ollama_model = getattr(settings, "OLLAMA_MODEL", "llama3")
        self._working_groq_model = getattr(settings, "GROQ_MODEL", "openai/gpt-oss-20b")
        self._http_client = httpx.Client(timeout=20.0)

    def generate_chat_response(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        if self.api_key:
            res = self._query_groq_or_grok(system_prompt, user_prompt)
            if res:
                return res
        return self._query_ollama(system_prompt, user_prompt)

    def _query_groq_or_grok(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        if not self.api_key:
            return None

        is_groq = self.api_key.startswith("gsk_")
        url = "https://api.groq.com/openai/v1/chat/completions" if is_groq else "https://api.x.ai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        # Try active working model first, then candidates
        models_to_try = [self._working_groq_model] + [m for m in CANDIDATE_GROQ_MODELS if m != self._working_groq_model]

        for model_name in models_to_try:
            try:
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1024
                }

                resp = self._http_client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    self._working_groq_model = model_name
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    # Strip any <think> tags if model produces reasoning output
                    cleaned_content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                    return cleaned_content or content.strip()
                elif resp.status_code in (400, 404):
                    logger.debug(f"[LLM Service] Model '{model_name}' unavailable ({resp.status_code}), trying fallback.")
                    continue
                else:
                    logger.warning(f"[LLM Service] API error {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.debug(f"[LLM Service] Request exception with model '{model_name}': {e}")
                continue

        return None

    def _query_ollama(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        if getattr(self, "_ollama_available", None) is False:
            return None
        try:
            url = f"{self.ollama_url}/api/chat"
            payload = {
                "model": self.ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False
            }
            resp = self._http_client.post(url, json=payload, timeout=2.0)
            if resp.status_code == 200:
                self._ollama_available = True
                return resp.json()["message"]["content"]
        except Exception:
            self._ollama_available = False
        return None

    def summarize_transcript(self, text: str, depth: str = "Detailed Breakdown") -> Optional[Dict[str, Any]]:
        system_prompt = (
            "You are ClipMind AI, an elite video intelligence engine. "
            "Analyze the transcript and return ONLY valid JSON matching this structure exactly:\n"
            "{\n"
            '  "tldr": "2-3 concise summary sentences",\n'
            '  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],\n'
            '  "keywords": ["#Keyword1", "#Keyword2", "#Keyword3"]\n'
            "}"
        )
        user_prompt = f"Target Depth: {depth}\nTranscript snippet:\n{text[:4000]}"

        raw_resp = self.generate_chat_response(system_prompt, user_prompt)
        if raw_resp:
            try:
                cleaned = raw_resp.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                start = cleaned.find('{')
                end = cleaned.rfind('}')
                if start != -1 and end != -1:
                    json_str = cleaned[start:end+1]
                    parsed = json.loads(json_str)
                    if "tldr" in parsed:
                        # Ensure hashtags formatted cleanly
                        if "keywords" in parsed and isinstance(parsed["keywords"], list):
                            parsed["keywords"] = [k if k.startswith("#") else f"#{k.replace(' ', '')}" for k in parsed["keywords"]]
                        return parsed
            except Exception as e:
                logger.warning(f"[LLM Service] JSON parse notice: {e}")
        return None

llm_service = LLMService()
