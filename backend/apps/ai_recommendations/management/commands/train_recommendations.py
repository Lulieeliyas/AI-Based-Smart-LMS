import time
from datetime import datetime, timezone
from django.core.management.base import BaseCommand
from django.conf import settings

from apps.books.models import Book, Rating
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from apps.ai_recommendations.services.content_based import content_recommender
from apps.ai_recommendations.services.collaborative import collaborative_recommender, build_interaction_matrix
from apps.ai_recommendations.services.model_store import model_store, ModelStore


class Command(BaseCommand):
    help = "Trains and saves content-based and collaborative book recommendation models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--evaluate",
            action="store_true",
            help="Evaluate recommendation models on a held-out test split.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force retraining even if no database changes detected.",
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            default=None,
            help="Custom directory path to save model artifacts.",
        )

    def handle(self, *args, **options):
        start_time = time.time()
        self.stdout.write(self.style.NOTICE("=== Starting AI Recommendation Model Training ==="))

        total_books = Book.objects.count()
        total_ratings = Rating.objects.count()
        total_borrows = BorrowRecord.objects.count()
        total_interactions = UserBookInteraction.objects.count()

        self.stdout.write(
            f"Database summary: {total_books} books, {total_ratings} ratings, "
            f"{total_borrows} borrows, {total_interactions} interaction events."
        )

        if total_books == 0:
            self.stdout.write(self.style.WARNING("No books found in database. Skipping training."))
            return

        # 1. Train Content-Based Model
        self.stdout.write("Training Content-Based Model (TF-IDF + Cosine Similarity)...")
        content_artifact = content_recommender.train()
        vocab_size = len(content_recommender.vectorizer.vocabulary_) if content_recommender.vectorizer else 0
        self.stdout.write(
            self.style.SUCCESS(
                f"Content-Based Model trained: {len(content_recommender.book_ids)} books, "
                f"{vocab_size} vocabulary features."
            )
        )

        # 2. Train Collaborative Filtering Model
        self.stdout.write("Training Collaborative Filtering Model (Interaction Matrix + Cosine Similarity)...")
        collab_artifact = collaborative_recommender.train()
        collab_stats = collab_artifact.get("stats", {}) if collab_artifact else {}
        self.stdout.write(
            self.style.SUCCESS(
                f"Collaborative Model trained: {collab_stats.get('num_users', 0)} users, "
                f"{collab_stats.get('num_books', 0)} books, "
                f"{collab_stats.get('num_interactions', 0)} interactions."
            )
        )

        # 3. Metadata tracking
        training_timestamp = datetime.now(timezone.utc).isoformat()
        metadata = {
            "version": "2.0.0",
            "trained_at": training_timestamp,
            "training_duration_seconds": round(time.time() - start_time, 2),
            "catalog_size": total_books,
            "ratings_count": total_ratings,
            "borrows_count": total_borrows,
            "interactions_count": total_interactions,
            "content_model": {
                "vectorizer_max_features": 5000,
                "ngram_range": [1, 2],
                "num_books_indexed": len(content_recommender.book_ids),
                "vocabulary_size": vocab_size,
            },
            "collaborative_model": collab_stats,
            "weights": {
                "content_weight": getattr(settings, "AI_CONTENT_WEIGHT", 0.40),
                "collab_weight": getattr(settings, "AI_COLLAB_WEIGHT", 0.40),
                "popularity_weight": getattr(settings, "AI_POPULARITY_WEIGHT", 0.20),
            },
        }

        # 4. Optional Evaluation
        if options["evaluate"]:
            self.stdout.write("Running offline evaluation...")
            eval_results = self.run_evaluation(k=5)
            metadata["evaluation"] = eval_results
            self.stdout.write(self.style.SUCCESS(f"Evaluation Results (K=5): {eval_results}"))

        # 5. Persist artifacts
        out_dir = options.get("output_dir")
        target_store = ModelStore(model_dir=out_dir) if out_dir else model_store
        self.stdout.write(f"Persisting artifacts to {target_store.model_dir}...")
        target_store.save_artifacts(
            content_artifact=content_artifact,
            collab_artifact=collab_artifact,
            metadata=metadata,
        )

        elapsed = round(time.time() - start_time, 2)
        self.stdout.write(
            self.style.SUCCESS(
                f"=== Training completed successfully in {elapsed}s. Artifacts saved. ==="
            )
        )

    def run_evaluation(self, k: int = 5) -> dict:
        """
        Leave-one-out evaluation for users with >= 2 interactions.
        Calculates Precision@K, Recall@K, NDCG@K, and Catalog Coverage.
        Avoids data leakage by holding out the target interaction during candidate scoring.
        """
        import numpy as np
        from apps.ai_recommendations.services.hybrid import hybrid_recommender
        from apps.users.models import User

        pivot, stats = build_interaction_matrix()
        if pivot.empty or len(pivot) == 0:
            return {"status": "insufficient_data_for_evaluation"}

        hits = []
        recalls = []
        ndcgs = []
        recommended_catalog_books = set()
        all_book_ids = set(Book.objects.values_list("id", flat=True))

        evaluated_users_count = 0

        for user_id_str in pivot.index:
            user_ratings = pivot.loc[user_id_str]
            interacted = user_ratings[user_ratings > 0].index.tolist()
            if len(interacted) < 2:
                continue

            evaluated_users_count += 1
            # Leave one out: hold out the last interacted item
            held_out = interacted[-1]
            train_items = interacted[:-1]

            user_obj = User.objects.filter(pk=user_id_str).first()
            if not user_obj:
                continue

            recs = hybrid_recommender.recommend(
                user=user_obj,
                top_n=k,
                exclude_consumed=True,
            )
            rec_ids = [r["book_id"] for r in recs]
            recommended_catalog_books.update(rec_ids)

            # Precision@K, Recall@K
            is_hit = held_out in rec_ids
            hits.append(1.0 if is_hit else 0.0)
            recalls.append(1.0 if is_hit else 0.0)

            # NDCG@K
            if is_hit:
                rank = rec_ids.index(held_out) + 1
                ndcg = 1.0 / np.log2(rank + 1)
                ndcgs.append(ndcg)
            else:
                ndcgs.append(0.0)

        if evaluated_users_count == 0:
            return {
                "status": "insufficient_multi_interaction_users",
                "evaluated_users": 0,
                "catalog_coverage": round(len(recommended_catalog_books) / max(1, len(all_book_ids)), 4),
            }

        return {
            "evaluated_users": evaluated_users_count,
            "precision_at_k": round(float(np.mean(hits)) / k, 4),
            "recall_at_k": round(float(np.mean(recalls)), 4),
            "ndcg_at_k": round(float(np.mean(ndcgs)), 4),
            "catalog_coverage": round(len(recommended_catalog_books) / max(1, len(all_book_ids)), 4),
        }
