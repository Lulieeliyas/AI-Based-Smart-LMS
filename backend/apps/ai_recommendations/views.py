
from django.db.models import Count, Avg, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.books.models import Book, Rating
from apps.books.serializers import BookSerializer
from .models import UserBookInteraction
from .services.hybrid import recommend_for_user
from .services.content_based import get_similar


def get_limit(request, default=6, maximum=30):
    try:
        limit = int(request.query_params.get("limit", default))
    except (TypeError, ValueError):
        limit = default
    return max(1, min(limit, maximum))


class RecommendationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ids = recommend_for_user(request.user.id, top_n=12)
        books = Book.objects.filter(id__in=ids)
        order = {book_id: i for i, book_id in enumerate(ids)}
        books = sorted(books, key=lambda book: order.get(book.id, 999))
        return Response(BookSerializer(books, many=True).data)

    def post(self, request):
        ids = recommend_for_user(request.user.id, top_n=12)
        return Response({
            "message": "Recommendations generated successfully.",
            "count": len(ids),
        })


class ForMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ids = recommend_for_user(request.user.id, top_n=12)
        books = Book.objects.filter(id__in=ids)
        order = {book_id: i for i, book_id in enumerate(ids)}
        books = sorted(books, key=lambda book: order.get(book.id, 999))
        return Response(BookSerializer(books, many=True).data)


class SimilarView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, book_id):
        ids = get_similar(book_id)
        limit = get_limit(request)
        books = Book.objects.filter(id__in=ids)
        order = {book_id: i for i, book_id in enumerate(ids)}
        books = sorted(books, key=lambda book: order.get(book.id, 999))
        return Response(BookSerializer(books[:limit], many=True).data)


class PopularBooksView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        limit = get_limit(request)
        books = Book.objects.annotate(
            borrow_count=Count("borrows"),
            rating_average=Avg("ratings__score"),
        ).order_by("-borrow_count", "-rating_average", "title")[:limit]
        return Response(BookSerializer(books, many=True).data)



class TrendingBooksView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        limit = get_limit(request)
        today = timezone.now().date()

        books = Book.objects.annotate(
            recent_views=Count(
                "user_interactions",
                filter=Q(user_interactions__interaction_type="view"),
                distinct=True,
            ),
            recent_borrows=Count(
                "borrows",
                filter=Q(borrows__issue_date__gte=today),
                distinct=True,
            ),
        ).order_by(
            "-recent_borrows",
            "-recent_views",
            "-created_at",
        )[:limit]

        return Response(BookSerializer(books, many=True).data)


class RecordActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        book_id = request.data.get("book_id")
        activity_type = str(request.data.get("activity_type", "")).strip().lower()

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

        UserBookInteraction.objects.create(
            user=request.user,
            book=book,
            interaction_type=normalized_type,
        )
        return Response({"message": "Activity recorded."}, status=status.HTTP_201_CREATED)


class UserActivitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        activities = UserBookInteraction.objects.filter(
            user=request.user
        ).select_related("book")[:50]

        return Response([
            {
                "id": activity.id,
                "book_id": activity.book_id,
                "book_title": activity.book.title,
                "activity_type": activity.interaction_type,
                "created_at": activity.created_at,
            }
            for activity in activities
        ])
