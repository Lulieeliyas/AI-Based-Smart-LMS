
from rest_framework import serializers
from .models import Book, Category, Rating


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class RatingSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Rating
        fields = ["id", "user", "book", "score", "review", "created_at"]
        read_only_fields = ["user", "book", "created_at"]


class BookListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name", read_only=True, allow_null=True
    )
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id", "title", "author", "category", "category_name",
            "isbn", "publisher", "published_year", "description",
            "cover", "total_copies", "available_copies", "access_type",
            "average_rating", "reviews_count",
        ]

    def get_average_rating(self, obj):
        ratings = obj.ratings.all()
        if ratings.exists():
            return sum(r.score for r in ratings) / ratings.count()
        return None

    def get_reviews_count(self, obj):
        return obj.ratings.count()


class BookSerializer(BookListSerializer):
    class Meta(BookListSerializer.Meta):
        fields = BookListSerializer.Meta.fields + ["created_at"]
        read_only_fields = ["created_at"]

    def validate(self, data):
        total = data.get(
            "total_copies",
            getattr(self.instance, "total_copies", 1),
        )
        available = data.get(
            "available_copies",
            getattr(self.instance, "available_copies", 1),
        )

        if available > total:
            raise serializers.ValidationError(
                "Available copies cannot exceed total copies."
            )
        return data
