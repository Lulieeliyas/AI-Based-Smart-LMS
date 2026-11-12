import os
import json
import logging
import urllib.request
from typing import Dict, Any, List, Optional
from sklearn.metrics.pairwise import cosine_similarity

from apps.books.models import Book
from apps.ai_recommendations.services.content_based import content_recommender
from apps.ai_recommendations.services.hybrid import get_accessible_book_ids

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


def is_ollama_online() -> bool:
    """Checks whether the local Ollama instance is reachable."""
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def get_ollama_status() -> Dict[str, Any]:
    """Returns local Ollama health status and available models."""
    online = False
    installed_models = []
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            installed_models = [m.get("name") for m in data.get("models", [])]
            online = True
    except Exception as e:
        logger.debug("Ollama status check failed: %s", e)

    return {
        "online": online,
        "host": OLLAMA_HOST,
        "default_model": OLLAMA_MODEL,
        "models": installed_models,
        "ready": online and (OLLAMA_MODEL in installed_models or any(OLLAMA_MODEL in m for m in installed_models)),
    }


def ask_ai_librarian(query: str, user: Any = None, limit: int = 3) -> Dict[str, Any]:
    """
    RAG (Retrieval-Augmented Generation) AI Librarian:
    1. Retrieval: Finds top matching candidate books from the library catalog using TF-IDF.
    2. Reasoning: Prompts Ollama (llama3.2) to evaluate the query against candidates.
    3. Output: Returns conversational librarian advice paired with exact book records.
    """
    query = (query or "").strip()
    if not query:
        return {
            "answer": "Please ask a question or tell me what topics and genres you are interested in!",
            "recommendations": [],
        }

    accessible_ids = get_accessible_book_ids(user)
    if not accessible_ids:
        return {
            "answer": "No accessible books found in the library catalog.",
            "recommendations": [],
        }

    # 1. Retrieval Stage: Select candidates via TF-IDF
    content_recommender.ensure_ready()
    candidates: List[Dict[str, Any]] = []

    vec = content_recommender.vectorizer
    matrix = content_recommender.tfidf_matrix
    book_ids = content_recommender.book_ids

    candidate_ids = []
    if vec is not None and matrix is not None and len(book_ids) > 0:
        query_vec = vec.transform([query])
        sims = cosine_similarity(query_vec, matrix).flatten()
        ranked_indices = sims.argsort()[::-1]

        for idx in ranked_indices:
            b_id = book_ids[idx]
            if b_id in accessible_ids:
                candidate_ids.append(b_id)
            if len(candidate_ids) >= 5:
                break

    if not candidate_ids:
        candidate_ids = list(
            Book.objects.filter(id__in=accessible_ids)
            .order_by("-created_at")
            .values_list("id", flat=True)[:5]
        )

    # Fetch candidate book objects with categories
    books_map = {
        b.id: b
        for b in Book.objects.filter(id__in=candidate_ids).select_related("category")
    }
    candidate_books = [books_map[b_id] for b_id in candidate_ids if b_id in books_map]

    # Format candidates for Ollama prompt
    catalog_context = "\n".join([
        f"- ID {b.id}: \"{b.title}\" by {b.author} ({b.category.name if b.category else 'General'}) - {b.description[:110]}"
        for b in candidate_books
    ])

    prompt = f"""You are an intelligent, friendly AI Librarian at a university smart library.
Library Catalog Candidates:
{catalog_context}

Patron Query: "{query}"

In 2 to 3 concise, encouraging sentences, recommend the 1 or 2 most suitable books from the catalog above and explain why they match the patron's request. Focus on real benefits for the reader.
"""

    answer_text = ""
    if is_ollama_online():
        try:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 120,
                },
            }
            req = urllib.request.Request(
                f"{OLLAMA_HOST}/api/generate",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                answer_text = (data.get("response") or "").strip()
        except Exception as e:
            logger.warning("Ollama librarian generation error: %s", e)

    # Fallback response if Ollama is offline or timed out
    if not answer_text:
        top_titles = [f"'{b.title}' by {b.author}" for b in candidate_books[:2]]
        answer_text = (
            f"Based on our library catalog and your interest in '{query}', we recommend exploring "
            f"{' and '.join(top_titles)}."
        )

    # Format recommended book cards
    from apps.books.serializers import BookSerializer
    from apps.ai_recommendations.serializers import RecommendedBookSerializer

    top_recs = []
    for b in candidate_books[:limit]:
        top_recs.append({
            "book_id": b.id,
            "book": b,
            "score": 0.95,
            "reason": f"Selected by AI Librarian for: {query[:40]}",
            "recommendation_type": "ai_librarian",
        })

    serialized_recs = RecommendedBookSerializer(top_recs, many=True).data

    return {
        "query": query,
        "answer": answer_text,
        "powered_by": f"Ollama ({OLLAMA_MODEL})",
        "results": serialized_recs,
    }
