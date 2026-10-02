from rest_framework import serializers
from .models import Recommendation, RecommendationActivity
from apps.books.serializers import BookListSerializer

class RecommendationSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_author = serializers.CharField(source='book.author', read_only=True)
    book_details = BookListSerializer(source='book', read_only=True)
    
    class Meta:
        model = Recommendation
        fields = [
            'id', 'user', 'book', 'book_title', 'book_author', 'book_details',
            'score', 'algorithm_used', 'is_viewed', 'is_clicked',
            'generated_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'generated_at', 'updated_at']


class RecommendationActivitySerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source='book.title', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = RecommendationActivity
        fields = [
            'id', 'user', 'user_name', 'book', 'book_title',
            'activity_type', 'data', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']