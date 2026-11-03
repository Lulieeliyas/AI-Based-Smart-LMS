import logging
import math
from typing import List, Dict, Any, Optional, Set, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from django.db.models import Count, Avg, Q

from apps.books.models import Book, Rating
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from .model_store import model_store

logger = logging.getLogger(__name__)

# Configurable implicit interaction weights
DEFAULT_INTERACTION_WEIGHTS = {
    "borrow": 3.5,
    "favorite": 3.0,
    "reserve": 2.5,
    "rate": 4.0,
    "view": 1.0,
}
MAX_PREFERENCE_SCORE = 5.0
MIN_PREFERENCE_SCORE = 0.5


def build_interaction_matrix() -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Constructs a user-book interaction matrix using actual database records:
    1. Explicit ratings from Rating model (1 to 5).
    2. Borrowing history from BorrowRecord (implicit weight 3.5).
    3. User interactions (view, favorite, reserve, rate) with logarithmic damping
       to prevent repeated events from inflating preference without limit.
    """
    interactions_map: Dict[Tuple[str, int], Dict[str, Any]] = {}

    # 1. Collect explicit ratings
    for r in Rating.objects.values("user_id", "book_id", "score"):
        u_id = str(r["user_id"])
        b_id = int(r["book_id"])
        score = float(r["score"])
        interactions_map[(u_id, b_id)] = {
            "explicit_rating": score,
            "counts": {},
            "final_score": score,
        }

    # 2. Collect borrow records
    for b in BorrowRecord.objects.values("user_id", "book_id"):
        u_id = str(b["user_id"])
        b_id = int(b["book_id"])
        entry = interactions_map.setdefault(
            (u_id, b_id),
            {"explicit_rating": None, "counts": {}, "final_score": 0.0},
        )
        entry["counts"]["borrow"] = entry["counts"].get("borrow", 0) + 1

    # 3. Collect UserBookInteraction events
    for ubi in UserBookInteraction.objects.values("user_id", "book_id", "interaction_type", "rating"):
        u_id = str(ubi["user_id"])
        b_id = int(ubi["book_id"])
        itype = ubi["interaction_type"]
        entry = interactions_map.setdefault(
            (u_id, b_id),
            {"explicit_rating": None, "counts": {}, "final_score": 0.0},
        )
        if itype == "rate" and ubi["rating"] is not None and entry["explicit_rating"] is None:
            entry["explicit_rating"] = float(ubi["rating"])
        else:
            entry["counts"][itype] = entry["counts"].get(itype, 0) + 1

    if not interactions_map:
        return pd.DataFrame(), {"num_users": 0, "num_books": 0, "num_interactions": 0}

    # 4. Calculate bounded, damped preference scores
    rows = []
    for (u_id, b_id), data in interactions_map.items():
        explicit = data["explicit_rating"]
        counts = data["counts"]

        # Calculate implicit score with logarithmic saturation
        implicit_score = 0.0
        for itype, count in counts.items():
            base_w = DEFAULT_INTERACTION_WEIGHTS.get(itype, 1.0)
            # Logarithmic damping: base_w * (1 + ln(count))
            damped_weight = base_w * (1.0 + math.log(max(1, count)))
            implicit_score += damped_weight

        # Cap implicit score at MAX_PREFERENCE_SCORE
        implicit_score = min(MAX_PREFERENCE_SCORE, implicit_score)

        # Blend explicit and implicit scores
        if explicit is not None:
            # If explicit rating exists, weight it heavily, slight boost if also borrowed/favorited
            if implicit_score > 0:
                final = min(MAX_PREFERENCE_SCORE, max(explicit, 0.7 * explicit + 0.3 * implicit_score))
            else:
                final = explicit
        else:
            final = max(MIN_PREFERENCE_SCORE, implicit_score)

        rows.append({
            "user_id": u_id,
            "book_id": b_id,
            "preference": round(final, 3),
        })

    df = pd.DataFrame(rows)
    stats = {
        "num_users": df["user_id"].nunique(),
        "num_books": df["book_id"].nunique(),
        "num_interactions": len(df),
    }

    # Pivot into user x book interaction matrix
    pivot = df.pivot_table(
        index="user_id",
        columns="book_id",
        values="preference",
        fill_value=0.0,
    )
    return pivot, stats


class CollaborativeRecommender:
    """
    Collaborative filtering engine utilizing user-item interaction matrix,
    cosine similarity with shrinkage, and item-based collaborative filtering fallback.
    Handles sparse matrices and cold-starts gracefully without synthetic ratings.
    """

    def __init__(self):
        self.matrix: Optional[pd.DataFrame] = None
        self.user_similarity: Optional[pd.DataFrame] = None
        self.item_similarity: Optional[pd.DataFrame] = None
        self.user_ids: List[str] = []
        self.book_ids: List[int] = []
        self._load_from_store()

    def _load_from_store(self) -> bool:
        artifacts = model_store.load_artifacts()
        collab_artifact = artifacts.get("collaborative")
        if collab_artifact and isinstance(collab_artifact, dict):
            self.matrix = collab_artifact.get("matrix")
            self.user_similarity = collab_artifact.get("user_similarity")
            self.item_similarity = collab_artifact.get("item_similarity")
            self.user_ids = collab_artifact.get("user_ids", [])
            self.book_ids = collab_artifact.get("book_ids", [])
            return True
        return False

    def train(self) -> Dict[str, Any]:
        """
        Builds interaction matrix and computes user-user and item-item similarity.
        """
        pivot, stats = build_interaction_matrix()
        if pivot.empty or len(pivot) == 0:
            logger.info("Insufficient interaction data for collaborative filtering.")
            self.matrix = None
            self.user_similarity = None
            self.item_similarity = None
            self.user_ids = []
            self.book_ids = []
            return {}

        self.matrix = pivot
        self.user_ids = [str(u) for u in pivot.index]
        self.book_ids = [int(b) for b in pivot.columns]

        # Compute user-user cosine similarity with shrinkage
        if len(self.user_ids) >= 2:
            u_sim = cosine_similarity(self.matrix.values)
            # Binary overlap count matrix
            binary_matrix = (self.matrix.values > 0).astype(float)
            overlap_counts = np.dot(binary_matrix, binary_matrix.T)
            # Apply shrinkage: sim * (overlap / (overlap + shrinkage_param))
            shrinkage = 2.0
            shrinkage_factors = overlap_counts / (overlap_counts + shrinkage)
            u_sim_shrunk = u_sim * shrinkage_factors
            self.user_similarity = pd.DataFrame(
                u_sim_shrunk,
                index=self.matrix.index,
                columns=self.matrix.index,
            )
        else:
            self.user_similarity = pd.DataFrame(
                [[1.0]],
                index=self.matrix.index,
                columns=self.matrix.index,
            )

        # Compute item-item cosine similarity
        if len(self.book_ids) >= 2:
            item_matrix = self.matrix.T.values
            i_sim = cosine_similarity(item_matrix)
            self.item_similarity = pd.DataFrame(
                i_sim,
                index=self.matrix.columns,
                columns=self.matrix.columns,
            )
        else:
            self.item_similarity = pd.DataFrame(
                [[1.0]],
                index=self.matrix.columns,
                columns=self.matrix.columns,
            )

        artifact = {
            "matrix": self.matrix,
            "user_similarity": self.user_similarity,
            "item_similarity": self.item_similarity,
            "user_ids": self.user_ids,
            "book_ids": self.book_ids,
            "stats": stats,
        }
        return artifact

    def ensure_ready(self):
        if self.matrix is None:
            if not self._load_from_store():
                self.train()

    def recommend_for_user(
        self,
        user_id: Any,
        top_n: int = 10,
        exclude_consumed: bool = True,
        accessible_ids: Optional[Set[int]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Recommends books using collaborative filtering.
        Combines User-based CF and Item-based CF with preference scores.
        """
        self.ensure_ready()
        u_str = str(user_id)

        if self.matrix is None or u_str not in self.matrix.index:
            return []

        user_ratings = self.matrix.loc[u_str]
        consumed_books = set(user_ratings[user_ratings > 0].index)

        # Candidate books to score
        all_candidate_books = set(self.book_ids)
        if exclude_consumed:
            candidate_books = all_candidate_books - consumed_books
        else:
            candidate_books = all_candidate_books

        if accessible_ids is not None:
            candidate_books = candidate_books.intersection(accessible_ids)

        if not candidate_books:
            return []

        scores: Dict[int, float] = {}

        # 1. User-Based CF scoring
        has_user_cf = False
        if self.user_similarity is not None and u_str in self.user_similarity.index:
            user_sims = self.user_similarity.loc[u_str].drop(index=u_str)
            # Filter positive similarity neighbors
            positive_neighbors = user_sims[user_sims > 0.05].sort_values(ascending=False).head(15)

            if len(positive_neighbors) > 0:
                has_user_cf = True
                neighbor_ratings = self.matrix.loc[positive_neighbors.index]
                neighbor_weights = positive_neighbors.values

                for book_id in candidate_books:
                    if book_id in neighbor_ratings.columns:
                        b_ratings = neighbor_ratings[book_id].values
                        active_mask = b_ratings > 0
                        if np.any(active_mask):
                            # Weighted average rating from similar users
                            weights_sum = np.sum(neighbor_weights[active_mask])
                            if weights_sum > 0:
                                pred = np.sum(b_ratings[active_mask] * neighbor_weights[active_mask]) / weights_sum
                                scores[book_id] = float(pred)

        # 2. Item-Based CF scoring fallback / enhancement
        if self.item_similarity is not None and len(consumed_books) > 0:
            for book_id in candidate_books:
                if book_id in self.item_similarity.columns:
                    # Item similarities to books user rated
                    interacted_in_matrix = [b for b in consumed_books if b in self.item_similarity.index]
                    if interacted_in_matrix:
                        sims = self.item_similarity.loc[interacted_in_matrix, book_id]
                        pos_mask = sims > 0.05
                        if np.any(pos_mask):
                            pos_sims = sims[pos_mask]
                            user_scores = user_ratings.loc[pos_sims.index]
                            pred_item = np.sum(user_scores * pos_sims) / np.sum(pos_sims)

                            # If User CF already scored, average them; else set item score
                            if book_id in scores:
                                scores[book_id] = 0.6 * scores[book_id] + 0.4 * float(pred_item)
                            else:
                                scores[book_id] = float(pred_item)

        if not scores:
            return []

        results = []
        for book_id, raw_score in scores.items():
            # Normalized to 0.0 - 1.0 (raw_score is on 0.0 - 5.0 scale)
            norm_score = float(np.clip(raw_score / MAX_PREFERENCE_SCORE, 0.0, 1.0))
            results.append({
                "book_id": book_id,
                "score": norm_score,
                "raw_score": raw_score,
                "reason": "Highly rated by readers with similar interests",
                "model": "collaborative",
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_n]


# Singleton instance
collaborative_recommender = CollaborativeRecommender()


def user_based(user_id: Any, top_n: int = 8) -> List[int]:
    """Backward compatible helper returning list of book IDs."""
    recs = collaborative_recommender.recommend_for_user(user_id, top_n=top_n)
    return [r["book_id"] for r in recs]


def popular_books(top_n: int = 8, accessible_ids: Optional[Set[int]] = None) -> List[int]:
    """
    Return most frequently borrowed books with high ratings.
    """
    qs = Book.objects.all()
    if accessible_ids is not None:
        qs = qs.filter(id__in=accessible_ids)

    qs = qs.annotate(
        borrow_count=Count("borrows", distinct=True),
        avg_rating=Avg("ratings__score"),
    ).order_by("-borrow_count", "-avg_rating", "title")

    return list(qs.values_list("id", flat=True)[:top_n])
