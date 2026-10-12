from django.urls import path
from .views import ForMeView, SimilarView

urlpatterns = [
    path("for-me/", ForMeView.as_view(), name="rec-for-me"),
    path("similar/<int:book_id>/", SimilarView.as_view(), name="rec-similar"),
]