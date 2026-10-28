import logging
from typing import List, Dict, Any
from .content_based import content_recommender
from .hybrid import hybrid_recommender
from apps.books.models import Book

logger = logging.getLogger(__name__)


class BookRecommender:
    """
    High-performance recommendation facade for backward compatibility.
    Uses precomputed TF-IDF matrix and cached model artifacts.
    """

    def __init__(self):
        content_recommender.ensure_ready()
        self.recommender = content_recommender

    def recommend(self, book_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Return books most similar to the selected book.
        """
        results = self.recommender.get_similar_books(book_id=book_id, top_n=limit)
        book_ids = [r["book_id"] for r in results]
        books_map = {b.id: b for b in Book.objects.filter(id__in=book_ids).select_related("category")}

        formatted = []
        for r in results:
            b = books_map.get(r["book_id"])
            if b:
                formatted.append({
                    "book": b,
                    "score": r["score"],
                    "reason": r["reason"],
                })
        return formatted
