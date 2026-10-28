import logging
from typing import List, Dict, Any, Optional, Set
from datetime import timedelta
import numpy as np
from django.conf import settings
from django.utils import timezone
from django.db.models import Count, Avg, Q

from apps.books.models import Book, Rating
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from .content_based import content_recommender
from .collaborative import collaborative_recommender, popular_books
from .external_ai import generate_grounded_explanation

logger = logging.getLogger(__name__)

# Configurable baseline weights
DEFAULT_CONTENT_WEIGHT = getattr(settings, "AI_CONTENT_WEIGHT", 0.40)
DEFAULT_COLLAB_WEIGHT = getattr(settings, "AI_COLLAB_WEIGHT", 0.40)
DEFAULT_POPULARITY_WEIGHT = getattr(settings, "AI_POPULARITY_WEIGHT", 0.20)


def get_accessible_book_ids(user: Any = None) -> Set[int]:
    """
    Returns set of book IDs accessible to the current user.
    Only admin and librarian users can access private books.
    Guests and regular students/staff only access public books.
    """
    is_staff = False
    if user and getattr(user, "is_authenticated", False):
        if getattr(user, "is_superuser", False) or getattr(user, "role", "") in ("admin", "librarian"):
            is_staff = True

    if is_staff:
        return set(Book.objects.values_list("id", flat=True))
    else:
        return set(Book.objects.filter(access_type=Book.AccessType.PUBLIC).values_list("id", flat=True))


def compute_popularity_scores(accessible_ids: Optional[Set[int]] = None) -> Dict[int, float]:
    """
    Computes normalized popularity scores in range [0.0, 1.0] for books
    based on historical borrow frequency, recent borrows (last 30 days),
    and user ratings.
    """
    cutoff = timezone.now().date() - timedelta(days=30)
    qs = Book.objects.all()
    if accessible_ids is not None:
        qs = qs.filter(id__in=accessible_ids)

    annotated = qs.annotate(
        total_borrows=Count("borrows", distinct=True),
        recent_borrows=Count(
            "borrows",
            filter=Q(borrows__issue_date__gte=cutoff),
            distinct=True,
        ),
        avg_rating=Avg("ratings__score"),
        rating_count=Count("ratings", distinct=True),
        view_count=Count(
            "user_interactions",
            filter=Q(user_interactions__interaction_type="view"),
            distinct=True,
        ),
    )

    raw_scores = {}
    max_score = 1.0

    for b in annotated:
        total_b = b.total_borrows or 0
        recent_b = b.recent_borrows or 0
        avg_r = float(b.avg_rating or 0.0)
        views = b.view_count or 0

        # Weighted popularity metric:
        # total_borrows (2.0) + recent_borrows (3.0) + avg_rating (1.0) + log views (0.5)
        score = (
            (total_b * 2.0)
            + (recent_b * 3.0)
            + ((avg_r / 5.0) * 2.0 if avg_r > 0 else 0.0)
            + (np.log1p(views) * 0.5)
        )
        raw_scores[b.id] = score
        if score > max_score:
            max_score = score

    # Normalize to [0.0, 1.0]
    return {b_id: float(np.clip(s / max_score, 0.05, 1.0)) for b_id, s in raw_scores.items()}


def get_user_consumed_books(user_id: Any) -> Set[int]:
    """
    Returns set of book IDs the user has already consumed
    (borrowed, rated, or favorited).
    """
    if not user_id:
        return set()

    consumed = set()
    consumed.update(BorrowRecord.objects.filter(user_id=user_id).values_list("book_id", flat=True))
    consumed.update(Rating.objects.filter(user_id=user_id).values_list("book_id", flat=True))
    consumed.update(
        UserBookInteraction.objects.filter(
            user_id=user_id,
            interaction_type__in=["favorite", "borrow", "rate"],
        ).values_list("book_id", flat=True)
    )
    return consumed


class HybridRecommender:
    """
    Hybrid Recommendation Engine combining:
    1. Content-based similarity (default 40%)
    2. Collaborative filtering scores (default 40%)
    3. Book popularity and recent borrowing trends (default 20%)
    4. Optional external AI explanations

    Features:
    - Min-max score normalization to comparable [0.0, 1.0] ranges.
    - Dynamic weight redistribution when collaborative signals are sparse.
    - Strict access permissions (private books filtered for unauthorized users).
    - Deduplication and grounded explanation generation.
    """

    def __init__(
        self,
        content_weight: float = DEFAULT_CONTENT_WEIGHT,
        collab_weight: float = DEFAULT_COLLAB_WEIGHT,
        popularity_weight: float = DEFAULT_POPULARITY_WEIGHT,
    ):
        self.content_weight = content_weight
        self.collab_weight = collab_weight
        self.popularity_weight = popularity_weight

    def recommend(
        self,
        user: Any,
        top_n: int = 10,
        exclude_consumed: bool = True,
        available_only: bool = False,
        category_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate hybrid personalized recommendations for a user.
        """
        if top_n <= 0:
            return []

        accessible_ids = get_accessible_book_ids(user)
        if not accessible_ids:
            return []

        # If category filter is passed
        if category_id is not None:
            cat_book_ids = set(Book.objects.filter(category_id=category_id).values_list("id", flat=True))
            accessible_ids = accessible_ids.intersection(cat_book_ids)

        # If available_only is requested
        if available_only:
            avail_ids = set(Book.objects.filter(available_copies__gt=0).values_list("id", flat=True))
            accessible_ids = accessible_ids.intersection(avail_ids)

        if not accessible_ids:
            return []

        user_id = getattr(user, "id", None) if getattr(user, "is_authenticated", False) else None
        consumed_books = get_user_consumed_books(user_id) if (exclude_consumed and user_id) else set()

        candidate_pool: Set[int] = accessible_ids - consumed_books
        if not candidate_pool:
            # If all accessible books are consumed, relax consumption filter
            candidate_pool = accessible_ids
            consumed_books = set()

        # 1. Obtain Content-Based candidate scores
        content_scores: Dict[int, float] = {}
        content_reasons: Dict[int, str] = {}
        if user_id:
            cb_recs = content_recommender.recommend_for_user(
                user_id=user_id,
                top_n=len(candidate_pool),
                exclude_consumed=exclude_consumed,
                accessible_ids=candidate_pool,
            )
            for r in cb_recs:
                content_scores[r["book_id"]] = r["score"]
                content_reasons[r["book_id"]] = r["reason"]

        # 2. Obtain Collaborative Filtering candidate scores
        collab_scores: Dict[int, float] = {}
        if user_id:
            cf_recs = collaborative_recommender.recommend_for_user(
                user_id=user_id,
                top_n=len(candidate_pool),
                exclude_consumed=exclude_consumed,
                accessible_ids=candidate_pool,
            )
            for r in cf_recs:
                collab_scores[r["book_id"]] = r["score"]

        # 3. Obtain Popularity scores for candidate books
        popularity_scores = compute_popularity_scores(accessible_ids=candidate_pool)

        # Determine user data density for dynamic reweighting
        has_user_cf = len(collab_scores) > 0
        has_user_cb = len(content_scores) > 0

        # Build candidate items with hybrid scoring
        candidates = []
        for b_id in candidate_pool:
            s_content = content_scores.get(b_id, 0.0)
            s_collab = collab_scores.get(b_id, 0.0)
            s_pop = popularity_scores.get(b_id, 0.1)

            # Dynamic weight adjustment
            if has_user_cf and b_id in collab_scores:
                # Full hybrid weights
                w_c = self.content_weight
                w_cf = self.collab_weight
                w_p = self.popularity_weight
            elif has_user_cb and s_content > 0:
                # Shift collaborative weight smoothly between content and popularity
                total_remaining = self.content_weight + self.popularity_weight
                w_c = (self.content_weight / total_remaining) * (1.0 - 0.05)
                w_cf = 0.05
                w_p = (self.popularity_weight / total_remaining) * (1.0 - 0.05)
            else:
                # Cold-start or guest: rely on catalog popularity and category diversity
                w_c = 0.30
                w_cf = 0.0
                w_p = 0.70

            final_score = (w_c * s_content) + (w_cf * s_collab) + (w_p * s_pop)
            final_score = float(np.clip(final_score, 0.01, 0.99))

            # Grounded explanation determination
            if s_collab >= 0.6 and w_cf > 0.1:
                reason = "Popular with readers who share your reading interests"
                rec_type = "collaborative"
            elif s_content >= 0.4 and b_id in content_reasons:
                reason = content_reasons[b_id]
                rec_type = "content_based"
            elif s_pop >= 0.5:
                reason = "Trending and widely borrowed across the library"
                rec_type = "popular"
            elif b_id in content_reasons:
                reason = content_reasons[b_id]
                rec_type = "hybrid"
            else:
                reason = "Recommended based on library reading trends"
                rec_type = "hybrid"

            candidates.append({
                "book_id": b_id,
                "score": round(final_score, 3),
                "reason": reason,
                "recommendation_type": rec_type,
                "model_breakdown": {
                    "content_score": round(s_content, 3),
                    "collaborative_score": round(s_collab, 3),
                    "popularity_score": round(s_pop, 3),
                    "weights": {
                        "content": round(w_c, 2),
                        "collaborative": round(w_cf, 2),
                        "popularity": round(w_p, 2),
                    },
                },
            })

        # Rank candidates by final hybrid score
        candidates.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = candidates[:top_n]

        # Attach Book model instances efficiently
        book_ids = [c["book_id"] for c in top_candidates]
        books_map = {
            b.id: b
            for b in Book.objects.filter(id__in=book_ids).select_related("category").prefetch_related("ratings")
        }

        for c in top_candidates:
            c["book"] = books_map.get(c["book_id"])

        return top_candidates


# Singleton instance
hybrid_recommender = HybridRecommender()


def recommend_for_user(user_id: Any, top_n: int = 10) -> List[int]:
    """
    Backward-compatible wrapper returning list of book IDs.
    """
    from apps.users.models import User
    user = None
    if user_id:
        try:
            user = User.objects.filter(pk=user_id).first()
        except Exception:
            user = None

    recs = hybrid_recommender.recommend(user=user, top_n=top_n)
    return [r["book_id"] for r in recs]
