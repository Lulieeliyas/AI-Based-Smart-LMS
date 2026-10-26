from django.urls import path
from .views import (
    BookListCreateView,
    BookDetailView,
    BookSearchView,
    BookReviewListCreateView,
    CategoryListCreateView,
)

urlpatterns = [
    path("books/", BookListCreateView.as_view(), name="book-list"),
    path("books/search/", BookSearchView.as_view(), name="book-search"),
    path(
        "books/<int:book_id>/reviews/",
        BookReviewListCreateView.as_view(),
        name="book-reviews",
    ),
    path("books/<int:pk>/", BookDetailView.as_view(), name="book-detail"),
    path("categories/", CategoryListCreateView.as_view(), name="category-list-create"),
]