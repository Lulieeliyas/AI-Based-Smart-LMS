from rest_framework import generics, filters, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny,IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from .models import Book, Category, Rating
from .serializers import (
    BookSerializer,
    BookListSerializer,
    CategorySerializer,
    RatingSerializer,
)
from apps.users.permissions import IsLibrarianUser
from rest_framework.exceptions import ValidationError

class BookListCreateView(generics.ListCreateAPIView):
    """
    View to list and create books.
    - GET: List all books with filters and search
    - POST: Create a new book (Librarian/Admin only)
    """
    queryset = Book.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'author', 'isbn', 'publisher', 'description']
    filterset_fields = ['category', 'author', 'access_type']
    ordering_fields = ['title', 'author', 'published_year', 'created_at']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsLibrarianUser()]
        return [IsAuthenticatedOrReadOnly()]
    
    def get_serializer_class(self):
        return BookSerializer if self.request.method == 'POST' else BookListSerializer


   
class BookDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    View to retrieve, update, or delete a book.
    - GET: View book details (Authenticated users)
    - PUT/PATCH: Update book (Librarian/Admin only)
    - DELETE: Delete book (Librarian/Admin only)
    """
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        - Anyone authenticated can view (GET)
        - Only librarians and admins can update (PUT, PATCH) or delete (DELETE)
        """
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAuthenticated(), IsLibrarianUser()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        """Save the book with updated information."""
        serializer.save()


class BookSearchView(generics.ListAPIView):
    """
    View to search books by title, author, ISBN, or category.
    """
    serializer_class = BookListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        category = self.request.query_params.get('category', '')
        author = self.request.query_params.get('author', '')
        
        queryset = Book.objects.all()
        
        if query:
            queryset = queryset.filter(
                models.Q(title__icontains=query) |
                models.Q(author__icontains=query) |
                models.Q(isbn__icontains=query) |
                models.Q(publisher__icontains=query)
            )
        if category:
            queryset = queryset.filter(category__name__icontains=category)
        if author:
            queryset = queryset.filter(author__icontains=author)
        
        return queryset.distinct()
    
class CategoryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/books/categories/ — list all categories (public)
    POST /api/books/categories/ — create a new category (librarian/admin only)
    """
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None   # return plain array

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsLibrarianUser()]
        return [AllowAny()]

class BookReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = RatingSerializer

    def get_queryset(self):
        return Rating.objects.filter(
            book_id=self.kwargs["book_id"]
        ).select_related("user", "book").order_by("-created_at")

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def perform_create(self, serializer):
        book_id = self.kwargs["book_id"]

        if not Book.objects.filter(pk=book_id).exists():
            raise ValidationError({"detail": "Book not found."})

        serializer.save(
            user=self.request.user,
            book_id=book_id,
        )
