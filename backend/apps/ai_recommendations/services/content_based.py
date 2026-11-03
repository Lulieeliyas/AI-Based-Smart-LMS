import logging
from typing import List, Dict, Any, Optional, Set
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from django.db.models import Q

from apps.books.models import Book, Rating
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from .model_store import model_store

logger = logging.getLogger(__name__)


def build_book_document(book_data: Dict[str, Any]) -> str:
    """
    Constructs a weighted composite document from book metadata.
    Informative fields (Title, Author, Category) receive higher weights
    through controlled repetition before TF-IDF vectorization.
    Safely handles missing or null fields.
    """
    title = (book_data.get("title") or "").strip()
    author = (book_data.get("author") or "").strip()
    category = (book_data.get("category_name") or "").strip()
    publisher = (book_data.get("publisher") or "").strip()
    description = (book_data.get("description") or "").strip()

    # Field weighting strategy:
    # Title x 3: Very informative for subject matter and keywords
    # Author x 2: High affinity for reader preferences
    # Category x 2: Essential classification signal
    # Publisher x 1, Description x 1
    tokens = []
    if title:
        tokens.extend([title] * 3)
    if author:
        tokens.extend([author] * 2)
    if category:
        tokens.extend([category] * 2)
    if publisher:
        tokens.append(publisher)
    if description:
        tokens.append(description)

    return " ".join(tokens)


class ContentBasedRecommender:
    """
    Content-Based Recommendation Engine using TF-IDF and Cosine Similarity.
    Builds and manages book representations, item-to-item similarity,
    and user-profile-based personalized recommendations.
    """

    def __init__(self):
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None
        self.similarity_matrix = None
        self.book_ids: List[int] = []
        self.book_index_map: Dict[int, int] = {}
        self.book_metadata: Dict[int, Dict[str, Any]] = {}
        self._load_from_store()

    def _load_from_store(self) -> bool:
        """Attempt to populate in-memory representations from saved artifacts."""
        artifacts = model_store.load_artifacts()
        content_artifact = artifacts.get("content")
        if content_artifact and isinstance(content_artifact, dict):
            self.vectorizer = content_artifact.get("vectorizer")
            self.tfidf_matrix = content_artifact.get("tfidf_matrix")
            self.similarity_matrix = content_artifact.get("similarity_matrix")
            self.book_ids = content_artifact.get("book_ids", [])
            self.book_index_map = {b_id: idx for idx, b_id in enumerate(self.book_ids)}
            self.book_metadata = content_artifact.get("book_metadata", {})
            return True
        return False

    def train(self, books_queryset=None) -> Dict[str, Any]:
        """
        Trains TF-IDF vectorizer and builds cosine similarity matrix
        over the current book catalog in the database.
        """
        if books_queryset is None:
            books_queryset = Book.objects.select_related("category").all()

        books_data = []
        for book in books_queryset:
            books_data.append({
                "id": book.id,
                "title": book.title,
                "author": book.author,
                "category_id": book.category_id,
                "category_name": book.category.name if book.category else "",
                "publisher": book.publisher or "",
                "published_year": book.published_year,
                "description": book.description or "",
                "access_type": book.access_type,
                "available_copies": book.available_copies,
            })

        if not books_data:
            logger.warning("No books available to train content-based recommender.")
            self.vectorizer = None
            self.tfidf_matrix = None
            self.similarity_matrix = None
            self.book_ids = []
            self.book_index_map = {}
            self.book_metadata = {}
            return {}

        self.book_ids = [b["id"] for b in books_data]
        self.book_index_map = {b["id"]: idx for idx, b in enumerate(books_data)}
        self.book_metadata = {b["id"]: b for b in books_data}

        documents = [build_book_document(b) for b in books_data]

        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(documents)
        self.similarity_matrix = cosine_similarity(self.tfidf_matrix)

        artifact = {
            "vectorizer": self.vectorizer,
            "tfidf_matrix": self.tfidf_matrix,
            "similarity_matrix": self.similarity_matrix,
            "book_ids": self.book_ids,
            "book_metadata": self.book_metadata,
        }
        return artifact

    def ensure_ready(self):
        """Ensure model is trained or loaded."""
        if self.similarity_matrix is None or not self.book_ids:
            if not self._load_from_store():
                self.train()

    def get_similar_books(
        self,
        book_id: int,
        top_n: int = 8,
        exclude_ids: Optional[Set[int]] = None,
        accessible_ids: Optional[Set[int]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Finds books most similar to a specific book using cosine similarity.
        Returns a list of dicts: {'book_id', 'score', 'reason'}.
        """
        self.ensure_ready()
        if self.similarity_matrix is None:
            return []

        # Support newly added books (cold-start books) not yet in precomputed index
        if book_id not in self.book_index_map:
            try:
                new_book = Book.objects.select_related("category").get(pk=book_id)
            except Book.DoesNotExist:
                return []
            target_meta = {
                "id": new_book.id,
                "title": new_book.title,
                "author": new_book.author,
                "category_name": new_book.category.name if new_book.category else "",
                "publisher": new_book.publisher or "",
                "description": new_book.description or "",
            }
            if self.vectorizer is None or self.tfidf_matrix is None:
                return []
            new_doc = build_book_document(target_meta)
            new_vec = self.vectorizer.transform([new_doc])
            sim_scores = cosine_similarity(new_vec, self.tfidf_matrix).flatten()
        else:
            idx = self.book_index_map[book_id]
            sim_scores = self.similarity_matrix[idx]
            target_meta = self.book_metadata.get(book_id, {})

        excluded = set(exclude_ids or [])
        excluded.add(book_id)

        candidates = []
        for i, score in enumerate(sim_scores):
            cand_id = self.book_ids[i]
            if cand_id in excluded:
                continue
            if accessible_ids is not None and cand_id not in accessible_ids:
                continue

            cand_meta = self.book_metadata.get(cand_id, {})
            # Determine reason
            reason_parts = []
            if target_meta.get("category_name") and target_meta.get("category_name") == cand_meta.get("category_name"):
                reason_parts.append(f"in {cand_meta['category_name']}")
            if target_meta.get("author") and target_meta.get("author").lower() == (cand_meta.get("author") or "").lower():
                reason_parts.append(f"by {cand_meta['author']}")

            if reason_parts:
                reason = f"Similar to '{target_meta.get('title', 'this book')}' (" + ", ".join(reason_parts) + ")"
            else:
                reason = f"Content similarity to '{target_meta.get('title', 'this book')}'"

            candidates.append({
                "book_id": cand_id,
                "score": float(np.clip(score, 0.0, 1.0)),
                "reason": reason,
                "model": "content_based",
            })

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:top_n]

    def recommend_for_user(
        self,
        user_id: Any,
        top_n: int = 10,
        exclude_consumed: bool = True,
        accessible_ids: Optional[Set[int]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Personalized content-based recommendations built from user's
        positive interactions (borrows, ratings >= 3, favorites, views).
        Constructs a weighted user interest profile in TF-IDF feature space.
        """
        self.ensure_ready()
        if self.tfidf_matrix is None or not self.book_ids:
            return []

        # Gather user's interactions and compute weights
        book_weights: Dict[int, float] = {}
        consumed_books: Set[int] = set()

        # 1. Borrow records (high positive affinity: 3.5)
        borrows = BorrowRecord.objects.filter(user_id=user_id).values_list("book_id", flat=True)
        for b_id in borrows:
            book_weights[b_id] = book_weights.get(b_id, 0.0) + 3.5
            consumed_books.add(b_id)

        # 2. Ratings (scaled by score, 1-5)
        ratings = Rating.objects.filter(user_id=user_id).values("book_id", "score")
        for r in ratings:
            b_id = r["book_id"]
            score = float(r["score"])
            consumed_books.add(b_id)
            if score >= 3.0:
                book_weights[b_id] = book_weights.get(b_id, 0.0) + (score - 2.0)  # 3->1, 4->2, 5->3
            else:
                # Slight negative penalty for low ratings
                book_weights[b_id] = max(0.0, book_weights.get(b_id, 0.0) - 1.0)

        # 3. Explicit interactions (favorites, reserves, views)
        interactions = UserBookInteraction.objects.filter(user_id=user_id).values("book_id", "interaction_type")
        for act in interactions:
            b_id = act["book_id"]
            itype = act["interaction_type"]
            if itype == "favorite":
                book_weights[b_id] = book_weights.get(b_id, 0.0) + 3.0
                consumed_books.add(b_id)
            elif itype == "reserve":
                book_weights[b_id] = book_weights.get(b_id, 0.0) + 2.5
                consumed_books.add(b_id)
            elif itype == "view":
                # Damped view weight: smaller signal
                book_weights[b_id] = book_weights.get(b_id, 0.0) + 0.5

        # Check if user has sufficient interaction history for personalized vector
        valid_interacted_indices = []
        weights_list = []
        interacted_categories = []
        for b_id, weight in book_weights.items():
            if b_id in self.book_index_map and weight > 0:
                valid_interacted_indices.append(self.book_index_map[b_id])
                weights_list.append(weight)
                cat = self.book_metadata.get(b_id, {}).get("category_name")
                if cat:
                    interacted_categories.append(cat)

        if not valid_interacted_indices:
            # Cold-start user: return catalog-level diverse/top recommendations
            return self.get_cold_start_recommendations(
                top_n=top_n,
                exclude_ids=consumed_books if exclude_consumed else None,
                accessible_ids=accessible_ids,
            )

        # Build user profile vector
        # Profile is weighted sum of TF-IDF vectors of interacted books
        user_vector = np.zeros((1, self.tfidf_matrix.shape[1]), dtype=np.float32)
        total_weight = sum(weights_list)
        for idx, w in zip(valid_interacted_indices, weights_list):
            user_vector += (w / total_weight) * self.tfidf_matrix[idx].toarray()

        # Compute cosine similarity between user profile and all books
        profile_similarities = cosine_similarity(user_vector, self.tfidf_matrix).flatten()

        # Dominant category for explanation
        dominant_category = ""
        if interacted_categories:
            from collections import Counter
            counts = Counter(interacted_categories)
            dominant_category = counts.most_common(1)[0][0]

        candidates = []
        for i, score in enumerate(profile_similarities):
            cand_id = self.book_ids[i]
            if exclude_consumed and cand_id in consumed_books:
                continue
            if accessible_ids is not None and cand_id not in accessible_ids:
                continue

            cand_meta = self.book_metadata.get(cand_id, {})
            cand_cat = cand_meta.get("category_name", "")
            if dominant_category and cand_cat.lower() == dominant_category.lower():
                reason = f"Based on your interest in {dominant_category}"
            elif cand_cat:
                reason = f"Matches your reading profile in {cand_cat}"
            else:
                reason = "Matches your reading preferences and topics"

            candidates.append({
                "book_id": cand_id,
                "score": float(np.clip(score, 0.0, 1.0)),
                "reason": reason,
                "model": "content_based",
            })

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:top_n]

    def get_cold_start_recommendations(
        self,
        top_n: int = 10,
        exclude_ids: Optional[Set[int]] = None,
        accessible_ids: Optional[Set[int]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Cold-start recommendations for users without interaction history.
        Selects representative books with high metadata richness across categories.
        """
        self.ensure_ready()
        excluded = set(exclude_ids or [])

        # Group by category to ensure diversity
        seen_categories = set()
        diverse_books = []
        remaining_books = []

        for b_id in self.book_ids:
            if b_id in excluded:
                continue
            if accessible_ids is not None and b_id not in accessible_ids:
                continue

            meta = self.book_metadata.get(b_id, {})
            cat = meta.get("category_name", "")
            if cat and cat not in seen_categories:
                seen_categories.add(cat)
                diverse_books.append(b_id)
            else:
                remaining_books.append(b_id)

        ordered_ids = (diverse_books + remaining_books)[:top_n]
        return [
            {
                "book_id": b_id,
                "score": 0.5,
                "reason": f"Popular introduction to {self.book_metadata.get(b_id, {}).get('category_name', 'our library')}",
                "model": "content_based_coldstart",
            }
            for b_id in ordered_ids
        ]


# Singleton instance
content_recommender = ContentBasedRecommender()


def get_similar(book_id: int, top_n: int = 8) -> List[int]:
    """Backward compatible wrapper returning list of book IDs."""
    results = content_recommender.get_similar_books(book_id, top_n=top_n)
    return [r["book_id"] for r in results]


def invalidate_cache():
    """Invalidate cached models."""
    global content_recommender
    model_store.invalidate()
    content_recommender = ContentBasedRecommender()
