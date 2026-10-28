from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.books.models import Book, Category
from apps.users.models import User
from apps.ai_recommendations.models import UserBookInteraction
from apps.ai_recommendations.services.content_based import content_recommender


class RecommendationsAPITest(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Fiction")
        self.book1 = Book.objects.create(
            title="Pride and Prejudice",
            author="Jane Austen",
            category=self.category,
            available_copies=2,
            total_copies=2,
        )
        self.book2 = Book.objects.create(
            title="Sense and Sensibility",
            author="Jane Austen",
            category=self.category,
            available_copies=1,
            total_copies=1,
        )
        self.book3 = Book.objects.create(
            title="Emma",
            author="Jane Austen",
            category=self.category,
            available_copies=3,
            total_copies=3,
        )

        self.user = User.objects.create_user(
            username="test_student",
            email="student_api@test.com",
            password="testpassword123",
            role="student",
        )

        content_recommender.train()

    def test_guest_recommendations_allowed(self):
        # Guests should NOT receive 401 Unauthorized
        response = self.client.get(reverse("recommendations"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(len(response.data) > 0)
        # Check structure
        first_item = response.data[0]
        self.assertIn("id", first_item)
        self.assertIn("title", first_item)
        self.assertIn("score", first_item)
        self.assertIn("reason", first_item)
        self.assertIn("book", first_item)

    def test_authenticated_recommendations(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("recommendations"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_for_me_view(self):
        # Unauthenticated: 401
        res_unauth = self.client.get(reverse("rec-for-me"))
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated: 200
        self.client.force_authenticate(user=self.user)
        res_auth = self.client.get(reverse("rec-for-me"))
        self.assertEqual(res_auth.status_code, status.HTTP_200_OK)

    def test_similar_books_endpoint(self):
        url = reverse("rec-similar", kwargs={"book_id": self.book1.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        if len(response.data) > 0:
            self.assertIn("score", response.data[0])
            self.assertIn("reason", response.data[0])

    def test_popular_and_trending_endpoints(self):
        res_pop = self.client.get(reverse("rec-popular"))
        self.assertEqual(res_pop.status_code, status.HTTP_200_OK)

        res_trend = self.client.get(reverse("rec-trending"))
        self.assertEqual(res_trend.status_code, status.HTTP_200_OK)

    def test_record_activity_endpoint(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("rec-activity")

        # Missing payload
        res_fail = self.client.post(url, {})
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid payload
        res_success = self.client.post(url, {
            "book_id": self.book1.id,
            "activity_type": "view",
        })
        self.assertEqual(res_success.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserBookInteraction.objects.filter(user=self.user, book=self.book1).count(), 1)

    def test_user_activities_endpoint(self):
        self.client.force_authenticate(user=self.user)
        UserBookInteraction.objects.create(
            user=self.user,
            book=self.book1,
            interaction_type="view",
        )
        response = self.client.get(reverse("rec-activities"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["book_title"], self.book1.title)

    def test_model_status_endpoint(self):
        response = self.client.get(reverse("rec-status"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("status", response.data)
        self.assertIn("metadata", response.data)
