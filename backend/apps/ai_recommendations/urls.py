from django.urls import path

from .views import (
    RecommendationsView,
    ForMeView,
    SimilarView,
    PopularBooksView,
    TrendingBooksView,
    RecordActivityView,
    UserActivitiesView,
    ModelStatusView,
)

urlpatterns = [
    path("", RecommendationsView.as_view(), name="recommendations"),
    path("for-me/", ForMeView.as_view(), name="rec-for-me"),
    path("similar/<int:book_id>/", SimilarView.as_view(), name="rec-similar"),
    path("popular/", PopularBooksView.as_view(), name="rec-popular"),
    path("trending/", TrendingBooksView.as_view(), name="rec-trending"),
    path("activity/", RecordActivityView.as_view(), name="rec-activity"),
    path("activities/", UserActivitiesView.as_view(), name="rec-activities"),
    path("generate/", RecommendationsView.as_view(), name="rec-generate"),
    path("status/", ModelStatusView.as_view(), name="rec-status"),
]
