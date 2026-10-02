# apps/recommendations/urls.py
from django.urls import path
from . import views

app_name = 'recommendations'

urlpatterns = [
    # Personal recommendations for logged-in user
    path('', views.RecommendationsView.as_view(), name='recommendations'),
    
    # Generate new recommendations
    path('generate/', views.GenerateRecommendationsView.as_view(), name='generate'),
    
    # Similar books (public)
    path('similar/<uuid:book_id>/', views.SimilarBooksView.as_view(), name='similar-books'),
    
    # Popular books (public)
    path('popular/', views.PopularBooksView.as_view(), name='popular'),
    
    # Trending books (public)
    path('trending/', views.TrendingBooksView.as_view(), name='trending'),
    
    # Category-based recommendations
    path('category/', views.CategoryRecommendationsView.as_view(), name='category'),
    
    # ✅ User activity endpoints (this was 404'ing)
    path('activity/', views.RecordActivityView.as_view(), name='record-activity'),
    path('activities/', views.UserActivityListView.as_view(), name='user-activities'),
    
    # Admin: model management
    path('retrain/', views.RetrainModelView.as_view(), name='retrain'),
    path('stats/', views.ModelStatsView.as_view(), name='model-stats'),
]