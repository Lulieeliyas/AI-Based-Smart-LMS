from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from apps.books.models import Book


class BookRecommender:
    """
    Content-based book recommendation engine.

    Uses book metadata to determine which books are
    most similar to a selected book.
    """

    def __init__(self):
        self.books = list(
            Book.objects.all().select_related("category")
        )

        self.documents = [
            self._build_document(book)
            for book in self.books
        ]

        self.vectorizer = TfidfVectorizer(
            stop_words="english"
        )

        self.matrix = self.vectorizer.fit_transform(
            self.documents
        )

    def _build_document(self, book):
        category = (
            book.category.name
            if book.category
            else ""
        )

        return " ".join([
            book.title or "",
            book.author or "",
            category,
            book.publisher or "",
            book.description or "",
        ])

    def recommend(self, book_id, limit=5):
        """
        Return books most similar to the selected book.
        """

        target_index = None

        for index, book in enumerate(self.books):
            if book.id == book_id:
                target_index = index
                break

        if target_index is None:
            return []

        similarities = cosine_similarity(
            self.matrix[target_index],
            self.matrix,
        ).flatten()

        ranked_indices = similarities.argsort()[::-1]

        recommendations = []

        for index in ranked_indices:
            # Don't recommend the book itself.
            if index == target_index:
                continue

            recommendations.append({
                "book": self.books[index],
                "score": float(similarities[index]),
            })

            if len(recommendations) >= limit:
                break

        return recommendations
