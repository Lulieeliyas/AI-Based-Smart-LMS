from django.urls import path
from .views import (
    PublicStatsView,
    PublicBooksView,
    PublicBookDetailView,
    PublicDocumentationView,
    PublicRecentBooksView,
    PublicPopularBooksView,
)

urlpatterns = [
    path('stats/', PublicStatsView.as_view(), name='public-stats'),
    path('books/', PublicBooksView.as_view(), name='public-books'),
    path('books/<int:id>/', PublicBookDetailView.as_view(), name='public-book-detail'),
    path('books/recent/', PublicRecentBooksView.as_view(), name='public-recent-books'),
    path('books/popular/', PublicPopularBooksView.as_view(), name='public-popular-books'),
    path('documentation/', PublicDocumentationView.as_view(), name='public-documentation'),
]