import tempfile
from pathlib import Path
from io import StringIO
from django.core.management import call_command
from django.test import TestCase
from apps.books.models import Book, Rating
from apps.users.models import User
from apps.ai_recommendations.models import UserBookInteraction
from apps.ai_recommendations.services.model_store import ModelStore


class PipelineAndModelStoreTest(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = ModelStore(model_dir=self.temp_dir.name)

        self.u1 = User.objects.create_user(username="p_user1", email="p1@test.com", password="pwd")
        self.u2 = User.objects.create_user(username="p_user2", email="p2@test.com", password="pwd")

        self.b1 = Book.objects.create(title="Book Alpha", author="Author Alpha")
        self.b2 = Book.objects.create(title="Book Beta", author="Author Beta")

        Rating.objects.create(user=self.u1, book=self.b1, score=5)
        Rating.objects.create(user=self.u2, book=self.b1, score=4)
        Rating.objects.create(user=self.u2, book=self.b2, score=5)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_model_store_save_and_load(self):
        content_artifact = {"mock_vectorizer": "ready", "book_ids": [self.b1.id]}
        collab_artifact = {"mock_matrix": "ready"}
        metadata = {"version": "2.0.0", "catalog_size": 2}

        self.store.save_artifacts(
            content_artifact=content_artifact,
            collab_artifact=collab_artifact,
            metadata=metadata,
        )

        self.assertTrue(self.store.content_path.exists())
        self.assertTrue(self.store.collab_path.exists())
        self.assertTrue(self.store.metadata_path.exists())

        loaded = self.store.load_artifacts(force_reload=True)
        self.assertEqual(loaded["content"]["mock_vectorizer"], "ready")
        self.assertEqual(loaded["collaborative"]["mock_matrix"], "ready")
        self.assertEqual(loaded["metadata"]["version"], "2.0.0")

    def test_train_recommendations_command_execution(self):
        out = StringIO()
        call_command(
            "train_recommendations",
            "--evaluate",
            f"--output-dir={self.temp_dir.name}",
            stdout=out,
        )
        output = out.getvalue()

        self.assertIn("Starting AI Recommendation Model Training", output)
        self.assertIn("Content-Based Model trained", output)
        self.assertIn("Collaborative Model trained", output)
        self.assertIn("Training completed successfully", output)
