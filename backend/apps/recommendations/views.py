from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta
from .models import Recommendation
from .serializers import RecommendationSerializer
from .ai_engine.recommender import recommender
from apps.books.serializers import BookListSerializer
from apps.books.models import Book
from apps.borrowing.models import Borrow
import logging

logger = logging.getLogger(__name__)


class RecommendationsView(generics.ListAPIView):
    """Get user's personalized recommendations"""
    serializer_class = RecommendationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Recommendation.objects.filter(
            user=self.request.user
        ).order_by('-score')[:10]


class GenerateRecommendationsView(generics.GenericAPIView):
    """Generate/refresh recommendations for the user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            recommendations = recommender.get_personalized_recommendations(request.user, top_n=10)
            return Response({
                'message': f'Generated {len(recommendations)} recommendations',
                'count': len(recommendations)
            })
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            return Response({
                'error': 'Failed to generate recommendations',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SimilarBooksView(generics.GenericAPIView):
    """Get books similar to a given book"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, book_id):
        top_n = request.query_params.get('limit', 10)
        try:
            top_n = int(top_n)
        except:
            top_n = 10
        
        try:
            similar = recommender.get_similar_books(book_id, top_n)
            result = []
            for item in similar:
                try:
                    book = Book.objects.get(id=item['book_id'])
                    result.append({
                        'book': BookListSerializer(book).data,
                        'similarity_score': item['score']
                    })
                except Book.DoesNotExist:
                    continue
            
            return Response(result)
        except Exception as e:
            logger.error(f"Error getting similar books: {str(e)}")
            return Response([], status=status.HTTP_200_OK)


class PopularBooksView(generics.ListAPIView):
    """Get most popular books"""
    serializer_class = BookListSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        limit = self.request.query_params.get('limit', 10)
        try:
            limit = int(limit)
        except:
            limit = 10
        
        return recommender.get_popular_books(limit)


class RecordActivityView(generics.GenericAPIView):
    """Record user activity for better recommendations"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        book_id = request.data.get('book_id')
        activity_type = request.data.get('activity_type')
        data = request.data.get('data', {})
        
        if not book_id or not activity_type:
            return Response({
                'error': 'book_id and activity_type required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            success = recommender.record_user_activity(
                request.user.id,
                book_id,
                activity_type,
                data
            )
            if success:
                return Response({'message': 'Activity recorded successfully'})
            else:
                return Response({
                    'error': 'Failed to record activity'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Error recording activity: {str(e)}")
            return Response({
                'error': 'Failed to record activity',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RetrainModelView(generics.GenericAPIView):
    """Retrain the recommendation model"""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    
    def post(self, request):
        try:
            success = recommender.retrain_model()
            if success:
                return Response({'message': 'Model retrained successfully'})
            else:
                return Response({
                    'error': 'Failed to retrain model'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Error retraining model: {str(e)}")
            return Response({
                'error': 'Failed to retrain model',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ModelStatsView(generics.GenericAPIView):
    """Get recommendation model statistics"""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    
    def get(self, request):
        stats = recommender.get_model_stats()
        return Response(stats)


class TrendingBooksView(generics.ListAPIView):
    """Get trending books based on recent activity"""
    serializer_class = BookListSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        days = self.request.query_params.get('days', 7)
        try:
            days = int(days)
        except:
            days = 7
        
        start_date = timezone.now() - timedelta(days=days)
        
        trending = Book.objects.filter(
            borrowings__borrow_date__gte=start_date
        ).annotate(
            borrow_count=Count('borrowings'),
            avg_rating=Avg('reviews__rating')
        ).filter(
            borrow_count__gt=0
        ).order_by('-borrow_count')[:10]
        
        return trending


class CategoryRecommendationsView(generics.ListAPIView):
    """Get recommendations based on user's preferred categories"""
    serializer_class = BookListSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        try:
            recommendations = recommender.get_category_recommendations(self.request.user, top_n=10)
            return recommendations
        except Exception as e:
            logger.error(f"Error getting category recommendations: {str(e)}")
            return Book.objects.none()
        
        

class UserActivityListView(generics.ListAPIView):
    """
    List recent activities for the current user.
    GET /api/recommendations/activities/
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        from apps.users.models import UserActivityLog
        from django.utils import timezone
        from datetime import timedelta
        
        # Get last 20 activities for this user
        activities = UserActivityLog.objects.filter(
            user=request.user
        ).order_by('-created_at')[:20]
        
        data = []
        now = timezone.now()
        
        for activity in activities:
            # Calculate time_ago
            delta = now - activity.created_at
            if delta.seconds < 60:
                time_ago = 'Just now'
            elif delta.seconds < 3600:
                minutes = delta.seconds // 60
                time_ago = f'{minutes} min ago'
            elif delta.days == 0:
                hours = delta.seconds // 3600
                time_ago = f'{hours} hour{"s" if hours > 1 else ""} ago'
            elif delta.days < 7:
                time_ago = f'{delta.days} day{"s" if delta.days > 1 else ""} ago'
            else:
                time_ago = activity.created_at.strftime('%b %d, %Y')
            
            data.append({
                'id': str(activity.id),
                'action': activity.action,
                'description': activity.description or activity.get_action_display(),
                'created_at': activity.created_at.isoformat(),
                'time_ago': time_ago,
            })
        
        return Response(data)