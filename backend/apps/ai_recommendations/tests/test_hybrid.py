from django.test import TestCase
from apps.books.models import Book, Category, Rating
from apps.users.models import User
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from apps.ai_recommendations.services.hybrid import HybridRecommender
from apps.ai_recommendations.services.content_based import content_recommender
from apps.ai_recommendations.services.collaborative import collaborative_recommender


class HybridRecommenderTest(TestCase):
    def setUp(self):
        self.cat1 = Category.objects.create(name="Computer Science")
        self.cat2 = Category.objects.create(name="Philosophy")

        self.book_public = Book.objects.create(
            title="Introduction to Algorithms",
            author="Cormen",
            category=self.cat1,
            access_type=Book.AccessType.PUBLIC,
            available_copies=5,
            total_copies=5,
        )
        self.book_private = Book.objects.create(
            title="Restricted Rare Archives",
            author="Scholar",
            category=self.cat2,
            access_type=Book.AccessType.PRIVATE,
            available_copies=1,
            total_copies=1,
        )
        self.book_unavail = Book.objects.create(
            title="Clean Architecture",
            author="Martin",
            category=self.cat1,
            access_type=Book.AccessType.PUBLIC,
            available_copies=0,
            total_copies=2,
        )

        self.student = User.objects.create_user(
            username="student_user",
            email="student@test.com",
            password="testpassword123",
            role="student",
        )
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@test.com",
            password="testpassword123",
            role="admin",
        )

        # Train underlying models on setup
        content_recommender.train()
        collaborative_recommender.train()

    def test_permissions_student_cannot_see_private_books(self):
        hybrid = HybridRecommender()
        student_recs = hybrid.recommend(user=self.student, top_n=10)
        student_rec_ids = [r["book_id"] for r in student_recs]

        # Student should NOT see private book
        self.assertNotIn(self.book_private.id, student_rec_ids)

        # Admin CAN see private book
        admin_recs = hybrid.recommend(user=self.admin, top_n=10)
        admin_rec_ids = [r["book_id"] for r in admin_recs]
        self.assertIn(self.book_private.id, admin_rec_ids)

    def test_available_only_filter(self):
        hybrid = HybridRecommender()
        recs = hybrid.recommend(user=self.student, top_n=10, available_only=True)
        rec_ids = [r["book_id"] for r in recs]

        # book_unavail has available_copies=0
        self.assertNotIn(self.book_unavail.id, rec_ids)
        self.assertIn(self.book_public.id, rec_ids)

    def test_dynamic_weights_sparse_collaborative_data(self):
        hybrid = HybridRecommender(content_weight=0.40, collab_weight=0.40, popularity_weight=0.20)
        recs = hybrid.recommend(user=self.student, top_n=5)

        # When collaborative data is sparse, scores should NOT collapse to 0
        self.assertTrue(len(recs) > 0)
        for r in recs:
            self.assertGreater(r["score"], 0.0)
            self.assertLessEqual(r["score"], 1.0)
            self.assertIn("reason", r)
            self.assertIn("recommendation_type", r)
            # Weights applied are recorded in breakdown
            weights = r["model_breakdown"]["weights"]
            self.assertAlmostEqual(sum(weights.values()), 1.0, delta=0.05)

    def test_deduplication(self):
        hybrid = HybridRecommender()
        recs = hybrid.recommend(user=self.student, top_n=10)
        rec_ids = [r["book_id"] for r in recs]

        # No duplicate book IDs
        self.assertEqual(len(rec_ids), len(set(rec_ids)))
