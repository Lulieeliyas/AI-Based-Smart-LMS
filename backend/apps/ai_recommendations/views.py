import logging
from datetime import timedelta
from django.db.models import Count, Avg, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.books.models import Book, Rating
from apps.books.serializers import BookSerializer
from .models import UserBookInteraction
from .serializers import RecommendedBookSerializer, UserBookInteractionSerializer
from .services.hybrid import hybrid_recommender, get_accessible_book_ids
from .services.content_based import content_recommender
from .services.model_store import model_store

logger = logging.getLogger(__name__)


def get_limit(request, default=10, maximum=50):
    try:
        limit = int(request.query_params.get("limit", default))
    except (TypeError, ValueError):
        limit = default
    return max(1, min(limit, maximum))


class RecommendationsView(APIView):
    """
    Main recommendation endpoint.
    - Authenticated users receive personalized hybrid recommendations.
    - Guests receive curated popular and category-diverse recommendations.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        limit = get_limit(request, default=10)
        available_only = request.query_params.get("available_only", "").lower() in ("true", "1", "yes")

        category_id = None
        if "category" in request.query_params:
            try:
                category_id = int(request.query_params["category"])
            except (ValueError, TypeError):
                category_id = None

        recommendations = hybrid_recommender.recommend(
            user=request.user if request.user.is_authenticated else None,
            top_n=limit,
            available_only=available_only,
            category_id=category_id,
        )

        serializer = RecommendedBookSerializer(recommendations, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        Force generation or refresh of personalized recommendations.
        """
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        limit = get_limit(request, default=10)
        recommendations = hybrid_recommender.recommend(
            user=request.user,
            top_n=limit,
        )

        serializer = RecommendedBookSerializer(recommendations, many=True)
        return Response({
            "message": "Recommendations generated successfully.",
            "count": len(recommendations),
            "results": serializer.data,
        })


class ForMeView(APIView):
    """
    Personalized recommendations strictly for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = get_limit(request, default=10)
        available_only = request.query_params.get("available_only", "").lower() in ("true", "1", "yes")

        recommendations = hybrid_recommender.recommend(
            user=request.user,
            top_n=limit,
            available_only=available_only,
        )

        serializer = RecommendedBookSerializer(recommendations, many=True)
        return Response(serializer.data)


class SimilarView(APIView):
    """
    Content-Based similar books for a specific book ID.
    Uses TF-IDF metadata similarity (title, author, category, publisher, description).
    """
    permission_classes = [AllowAny]

    def get(self, request, book_id):
        limit = get_limit(request, default=6)
        accessible_ids = get_accessible_book_ids(request.user if request.user.is_authenticated else None)

        try:
            target_book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            return Response({"detail": "Book not found."}, status=status.HTTP_404_NOT_FOUND)

        if target_book.id not in accessible_ids:
            return Response({"detail": "You do not have permission to view this book."}, status=status.HTTP_403_FORBIDDEN)

        similar_candidates = content_recommender.get_similar_books(
            book_id=book_id,
            top_n=limit,
            accessible_ids=accessible_ids,
        )

        cand_ids = [c["book_id"] for c in similar_candidates]
        books_map = {
            b.id: b
            for b in Book.objects.filter(id__in=cand_ids).select_related("category").prefetch_related("ratings")
        }

        recommendations = []
        for c in similar_candidates:
            b = books_map.get(c["book_id"])
            if b:
                recommendations.append({
                    "book_id": b.id,
                    "book": b,
                    "score": c["score"],
                    "reason": c["reason"],
                    "recommendation_type": "content_based",
                })

        serializer = RecommendedBookSerializer(recommendations, many=True)
        return Response(serializer.data)


class PopularBooksView(APIView):
    """
    Popular books across the library based on borrow frequency and ratings.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        limit = get_limit(request, default=8)
        accessible_ids = get_accessible_book_ids(request.user if request.user.is_authenticated else None)

        books = (
            Book.objects.filter(id__in=accessible_ids)
            .select_related("category")
            .prefetch_related("ratings")
            .annotate(
                borrow_count=Count("borrows", distinct=True),
                rating_average=Avg("ratings__score"),
            )
            .order_by("-borrow_count", "-rating_average", "title")[:limit]
        )

        recommendations = [
            {
                "book_id": b.id,
                "book": b,
                "score": 0.85,
                "reason": "Popular across the library",
                "recommendation_type": "popular",
            }
            for b in books
        ]

        serializer = RecommendedBookSerializer(recommendations, many=True)
        return Response(serializer.data)


class TrendingBooksView(APIView):
    """
    Trending books with high interaction activity in the last 30 days.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        limit = get_limit(request, default=8)
        accessible_ids = get_accessible_book_ids(request.user if request.user.is_authenticated else None)
        cutoff_date = timezone.now().date() - timedelta(days=30)

        books = (
            Book.objects.filter(id__in=accessible_ids)
            .select_related("category")
            .prefetch_related("ratings")
            .annotate(
                recent_views=Count(
                    "user_interactions",
                    filter=Q(
                        user_interactions__interaction_type="view",
                        user_interactions__created_at__date__gte=cutoff_date,
                    ),
                    distinct=True,
                ),
                recent_borrows=Count(
                    "borrows",
                    filter=Q(borrows__issue_date__gte=cutoff_date),
                    distinct=True,
                ),
            )
            .order_by(
                "-recent_borrows",
                "-recent_views",
                "-created_at",
            )[:limit]
        )

        recommendations = [
            {
                "book_id": b.id,
                "book": b,
                "score": 0.90,
                "reason": "Trending among readers this month",
                "recommendation_type": "trending",
            }
            for b in books
        ]

        serializer = RecommendedBookSerializer(recommendations, many=True)
        return Response(serializer.data)


class RecordActivityView(APIView):
    """
    Records user interactions (view, click, borrow, reserve, favorite, rate).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        book_id = request.data.get("book_id")
        activity_type = str(request.data.get("activity_type", "")).strip().lower()
        rating_val = request.data.get("rating")

        if not book_id or not activity_type:
            return Response(
                {"detail": "book_id and activity_type are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_types = {
            "view": "view",
            "click": "view",
            "recommendation_click": "view",
            "borrow": "borrow",
            "reserve": "reserve",
            "favorite": "favorite",
            "rate": "rate",
        }
        normalized_type = allowed_types.get(activity_type)
        if normalized_type is None:
            return Response(
                {"detail": "Unsupported activity_type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            book = Book.objects.get(pk=book_id)
        except (Book.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Book not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        parsed_rating = None
        if rating_val is not None:
            try:
                parsed_rating = int(rating_val)
                if not (1 <= parsed_rating <= 5):
                    parsed_rating = None
            except (ValueError, TypeError):
                parsed_rating = None

        interaction = UserBookInteraction.objects.create(
            user=request.user,
            book=book,
            interaction_type=normalized_type,
            rating=parsed_rating,
        )

        return Response(
            {
                "message": "Activity recorded successfully.",
                "id": interaction.id,
                "activity_type": normalized_type,
            },
            status=status.HTTP_201_CREATED,
        )


class UserActivitiesView(APIView):
    """
    Returns recent activities for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        activities = (
            UserBookInteraction.objects.filter(user=request.user)
            .select_related("book")
            .order_by("-created_at")[:50]
        )
        serializer = UserBookInteractionSerializer(activities, many=True)
        return Response(serializer.data)


class ModelStatusView(APIView):
    """
    Returns the metadata and training status of recommendation models.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        artifacts = model_store.load_artifacts()
        metadata = artifacts.get("metadata") or {}
        return Response({
            "status": "ready" if model_store.has_artifacts() else "uninitialized",
            "metadata": metadata,
        })
