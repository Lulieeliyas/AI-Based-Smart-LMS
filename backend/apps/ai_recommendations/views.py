from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.books.models import Book
from apps.books.serializers import BookSerializer
from .services.hybrid import recommend_for_user
from .services.content_based import get_similar


class ForMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ids = recommend_for_user(request.user.id, top_n=12)
        books = Book.objects.filter(id__in=ids)
        # preserve order
        order = {bid: i for i, bid in enumerate(ids)}
        books = sorted(books, key=lambda b: order.get(b.id, 999))
        return Response(BookSerializer(books, many=True).data)


class SimilarView(APIView):
    def get(self, request, book_id):
        ids = get_similar(book_id)
        books = Book.objects.filter(id__in=ids)
        return Response(BookSerializer(books, many=True).data)