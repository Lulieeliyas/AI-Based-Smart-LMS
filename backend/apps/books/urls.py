from django.urls import path
from .views import BookListCreateView, BookDetailView, BookSearchView
from . import views
urlpatterns = [
    path('books/', BookListCreateView.as_view(), name='book-list'),
    path('books/search/', BookSearchView.as_view(), name='book-search'),
    path('books/<int:pk>/', BookDetailView.as_view(), name='book-detail'),
    path('categories/', views.CategoryListCreateView.as_view(), name='category-list-create'),  # ✅
]