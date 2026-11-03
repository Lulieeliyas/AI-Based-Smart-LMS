from rest_framework import serializers
from apps.books.models import Book
from apps.books.serializers import BookSerializer
from .models import UserBookInteraction


class RecommendedBookSerializer(serializers.Serializer):
    """
    Unified serializer for book recommendations.
    Provides flat book fields, recommendation scores, truthful reasons,
    and a nested 'book' object for 100% compatibility with frontend components.
    """
    id = serializers.IntegerField(source="book.id")
    title = serializers.CharField(source="book.title")
    author = serializers.CharField(source="book.author")
    category = serializers.PrimaryKeyRelatedField(source="book.category", read_only=True)
    category_name = serializers.CharField(source="book.category.name", read_only=True, allow_null=True)
    isbn = serializers.CharField(source="book.isbn", allow_null=True)
    publisher = serializers.CharField(source="book.publisher", allow_blank=True)
    published_year = serializers.IntegerField(source="book.published_year", allow_null=True)
    description = serializers.CharField(source="book.description", allow_blank=True)
    cover = serializers.ImageField(source="book.cover", allow_null=True)
    total_copies = serializers.IntegerField(source="book.total_copies")
    available_copies = serializers.IntegerField(source="book.available_copies")
    access_type = serializers.CharField(source="book.access_type")
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    # Recommendation specifics
    score = serializers.FloatField()
    reason = serializers.CharField()
    recommendation_type = serializers.CharField(required=False, default="hybrid")
    model_breakdown = serializers.DictField(required=False)

    # Nested book instance
    book = serializers.SerializerMethodField()

    def get_average_rating(self, obj):
        book = obj.get("book")
        if not book:
            return None
        ratings = getattr(book, "ratings", None)
        if ratings and ratings.all().exists():
            return round(sum(r.score for r in ratings.all()) / ratings.count(), 1)
        return None

    def get_reviews_count(self, obj):
        book = obj.get("book")
        if not book:
            return 0
        ratings = getattr(book, "ratings", None)
        return ratings.count() if ratings else 0

    def get_book(self, obj):
        book = obj.get("book")
        if not book:
            return None
        return BookSerializer(book).data


class UserBookInteractionSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)
    book_author = serializers.CharField(source="book.author", read_only=True)

    class Meta:
        model = UserBookInteraction
        fields = [
            "id",
            "book",
            "book_title",
            "book_author",
            "interaction_type",
            "rating",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
