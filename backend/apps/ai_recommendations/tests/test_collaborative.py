from django.test import TestCase
from apps.books.models import Book, Rating
from apps.users.models import User
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from apps.ai_recommendations.services.collaborative import (
    CollaborativeRecommender,
    build_interaction_matrix,
    MAX_PREFERENCE_SCORE,
)


class CollaborativeRecommenderTest(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username="user_a",
            email="a@test.com",
            password="testpassword123",
        )
        self.user_b = User.objects.create_user(
            username="user_b",
            email="b@test.com",
            password="testpassword123",
        )
        self.user_c = User.objects.create_user(
            username="user_c",
            email="c@test.com",
            password="testpassword123",
        )

        self.book1 = Book.objects.create(title="Book 1", author="Author 1")
        self.book2 = Book.objects.create(title="Book 2", author="Author 2")
        self.book3 = Book.objects.create(title="Book 3", author="Author 3")
        self.book4 = Book.objects.create(title="Book 4", author="Author 4")

    def test_interaction_matrix_and_damping(self):
        # User A gives explicit rating of 5 to Book 1
        Rating.objects.create(user=self.user_a, book=self.book1, score=5)

        # User A views Book 2 twenty times (repeated event)
        for _ in range(20):
            UserBookInteraction.objects.create(
                user=self.user_a,
                book=self.book2,
                interaction_type="view",
            )

        pivot, stats = build_interaction_matrix()
        self.assertFalse(pivot.empty)
        self.assertEqual(stats["num_users"], 1)
        self.assertEqual(stats["num_books"], 2)

        # Explicit rating is 5.0
        self.assertEqual(pivot.loc[str(self.user_a.id), self.book1.id], 5.0)

        # Repeated views preference is capped and damped, never exceeding MAX_PREFERENCE_SCORE
        book2_score = pivot.loc[str(self.user_a.id), self.book2.id]
        self.assertLessEqual(book2_score, MAX_PREFERENCE_SCORE)
        self.assertGreater(book2_score, 1.0)  # boosted by 20 views, but damped logarithmic

    def test_collaborative_recommendation_similar_taste(self):
        # User A likes Book 1 (5 stars) and Book 2 (4 stars)
        Rating.objects.create(user=self.user_a, book=self.book1, score=5)
        Rating.objects.create(user=self.user_a, book=self.book2, score=4)

        # User B likes Book 1 (5 stars), Book 2 (5 stars), and Book 3 (5 stars)
        Rating.objects.create(user=self.user_b, book=self.book1, score=5)
        Rating.objects.create(user=self.user_b, book=self.book2, score=5)
        Rating.objects.create(user=self.user_b, book=self.book3, score=5)

        recommender = CollaborativeRecommender()
        recommender.train()

        # Recommender for User A should recommend Book 3 (which User B loved and User A hasn't seen)
        recs = recommender.recommend_for_user(self.user_a.id, top_n=3, exclude_consumed=True)
        rec_ids = [r["book_id"] for r in recs]

        self.assertIn(self.book3.id, rec_ids)
        self.assertNotIn(self.book1.id, rec_ids)
        self.assertNotIn(self.book2.id, rec_ids)

    def test_sparse_or_cold_user_no_synthetic_ratings(self):
        recommender = CollaborativeRecommender()
        recommender.train()

        # User C has no interactions
        recs = recommender.recommend_for_user(self.user_c.id, top_n=3)
        # Should return empty list gracefully without inventing ratings
        self.assertEqual(recs, [])
