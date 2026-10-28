import os
import logging
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
    Optional external AI integration (e.g. Gemini / OpenAI) to generate
    an enriched, grounded explanation for why a book is recommended.
    
    If API keys are not provided or API calls fail/timeout, returns None
    so local truthful template explanations are used. Core engine NEVER breaks.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if not gemini_key and not openai_key:
        return None

    # If Gemini is configured
    if gemini_key:
        try:
            import urllib.request
            import json

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
