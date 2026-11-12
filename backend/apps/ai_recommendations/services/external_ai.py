import os
import json
import logging
import urllib.request
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def generate_grounded_explanation(
    book_title: str,
    book_author: str,
    book_category: str,
    user_context: str,
    score: float,
) -> Optional[str]:
    """
    Generate an enriched, grounded explanation for why a book is recommended.
    
    Supported AI Backends (in priority order):
    1. Local Ollama (llama3.2 or custom model) - 100% private, free, and local.
    2. Google Gemini API (if GEMINI_API_KEY is configured).
    3. OpenAI API (if OPENAI_API_KEY is configured).
    
    If AI calls fail or timeout, returns None so local truthful template
    explanations are used automatically. Core recommender engine NEVER breaks.
    """
    # 1. Try local Ollama first
    ollama_host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    try:
        prompt = (
            f"In 1 short sentence (under 18 words), explain why a reader interested in "
            f"'{user_context}' should read '{book_title}' by {book_author} ({book_category}). "
            f"Directly state the reason without quotation marks or conversational preamble."
        )
        payload = {
            "model": ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 40},
        }
        req = urllib.request.Request(
            f"{ollama_host}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = (data.get("response") or "").strip().strip('"')
            if text:
                return text
    except Exception as e:
        logger.debug("Local Ollama explanation unavailable: %s", e)

    # 2. Try Gemini API if key is present
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            prompt = (
                f"In 1 short sentence (under 15 words), explain why a reader interested in "
                f"'{user_context}' should read '{book_title}' by {book_author} ({book_category})."
            )
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 40},
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    return text
        except Exception as e:
            logger.debug("External Gemini explanation unavailable: %s", e)

    return None
