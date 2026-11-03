from django.test import TestCase
from apps.books.models import Book, Category, Rating
from apps.users.models import User
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction
from apps.ai_recommendations.services.content_based import (
    ContentBasedRecommender,
    build_book_document,
)


class ContentBasedRecommenderTest(TestCase):
    def setUp(self):
        self.cat_sci_fi = Category.objects.create(name="Science Fiction")
        self.cat_history = Category.objects.create(name="History")

        self.book1 = Book.objects.create(
            title="Dune Chronicles",
            author="Frank Herbert",
            category=self.cat_sci_fi,
            description="Epic spice and desert planet sci-fi adventure.",
            available_copies=3,
            total_copies=3,
        )
        self.book2 = Book.objects.create(
            title="Children of Dune",
            author="Frank Herbert",
            category=self.cat_sci_fi,
            description="Sequel in the desert spice saga.",
            available_copies=2,
            total_copies=2,
        )
        self.book3 = Book.objects.create(
            title="World War II History",
            author="John Keegan",
            category=self.cat_history,
            description="Comprehensive history of the second world war battles.",
            available_copies=1,
            total_copies=1,
        )
        self.book_empty_meta = Book.objects.create(
            title="Minimalist Title Only",
            author="",
            description="",
            available_copies=1,
            total_copies=1,
        )

        self.user = User.objects.create_user(
            username="test_reader",
            email="reader@test.com",
            password="testpassword123",
            role="student",
        )

    def test_build_book_document_weighting_and_null_safety(self):
        doc = build_book_document({
            "title": "Clean Code",
            "author": "Robert Martin",
            "category_name": "Software",
            "publisher": "Prentice Hall",
            "description": "A handbook of agile software craftsmanship.",
        })
        # Title repeated 3 times, Author 2 times, Category 2 times
        self.assertIn("Clean Code Clean Code Clean Code", doc)
        self.assertIn("Robert Martin Robert Martin", doc)
        self.assertIn("Software Software", doc)
        self.assertIn("Prentice Hall", doc)

        # Null safe
        empty_doc = build_book_document({})
        self.assertEqual(empty_doc, "")

    def test_train_and_similarity(self):
        recommender = ContentBasedRecommender()
        artifact = recommender.train()

        self.assertIsNotNone(artifact)
        self.assertEqual(len(recommender.book_ids), 4)
        self.assertIn(self.book1.id, recommender.book_index_map)

        # Children of Dune should be most similar to Dune Chronicles
        sims = recommender.get_similar_books(self.book1.id, top_n=3)
        self.assertTrue(len(sims) > 0)
        top_similar_id = sims[0]["book_id"]
        self.assertEqual(top_similar_id, self.book2.id)
        self.assertGreater(sims[0]["score"], 0.2)
        self.assertIn("Frank Herbert", sims[0]["reason"])

    def test_personalized_recommendation_from_interactions(self):
        recommender = ContentBasedRecommender()
        recommender.train()

        # User borrows Dune Chronicles
        BorrowRecord.objects.create(
            user=self.user,
            book=self.book1,
            due_date="2026-11-15",
        )

        # Recommendations should recommend Children of Dune because of shared author/category
        recs = recommender.recommend_for_user(self.user.id, top_n=2, exclude_consumed=True)
        rec_ids = [r["book_id"] for r in recs]

        # Book1 is consumed, so it must not be recommended
        self.assertNotIn(self.book1.id, rec_ids)
        # Book2 should be top recommendation
        self.assertIn(self.book2.id, rec_ids)
        self.assertEqual(recs[0]["book_id"], self.book2.id)
        self.assertIn("Science Fiction", recs[0]["reason"])

    def test_cold_start_user(self):
        recommender = ContentBasedRecommender()
        recommender.train()

        # User with 0 interactions
        cold_user = User.objects.create_user(
            username="cold_user",
            email="cold@test.com",
            password="testpassword123",
        )
        recs = recommender.recommend_for_user(cold_user.id, top_n=3)
        self.assertTrue(len(recs) > 0)
        self.assertIn("coldstart", recs[0]["model"])
