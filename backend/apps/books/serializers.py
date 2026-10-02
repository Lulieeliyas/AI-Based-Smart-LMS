from rest_framework import serializers
from .models import Book, Category, BookReview

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at']

class BookReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = BookReview
        fields = ['id', 'user', 'rating', 'comment', 'created_at']
        read_only_fields = ['user', 'created_at']

class BookListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'category', 'category_name', 'status', 
                  'available_quantity', 'average_rating', 'reviews_count', 'cover_image']
    
    def get_average_rating(self, obj):
        reviews = obj.reviews.all()
        if reviews.exists():
            return sum(r.rating for r in reviews) / reviews.count()
        return None
    
    def get_reviews_count(self, obj):
        return obj.reviews.count()

class BookSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    added_by_name = serializers.CharField(source='added_by.username', read_only=True)
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'isbn', 'category', 'category_name',
                  'publisher', 'publication_year', 'edition', 'pages', 'description',
                  'cover_image', 'status', 'quantity', 'available_quantity', 'location',
                  'added_by', 'added_by_name', 'created_at', 'updated_at',
                  'average_rating', 'reviews_count']
        read_only_fields = ['added_by', 'created_at', 'updated_at']
    
    def get_average_rating(self, obj):
        reviews = obj.reviews.all()
        if reviews.exists():
            return sum(r.rating for r in reviews) / reviews.count()
        return None
    
    def get_reviews_count(self, obj):
        return obj.reviews.count()
    
    def validate(self, data):
        if data.get('available_quantity', 0) > data.get('quantity', 0):
            raise serializers.ValidationError(
                "Available quantity cannot exceed total quantity"
            )
        return data