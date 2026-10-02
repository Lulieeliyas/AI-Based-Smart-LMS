from django.urls import path
from .views import (
    NotificationListView,
    NotificationDetailView,
    MarkAllReadView,
    UnreadCountView
)

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:id>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/mark-all-read/', MarkAllReadView.as_view(), name='mark-all-read'),
    path('notifications/unread-count/', UnreadCountView.as_view(), name='unread-count'),
]