from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReportListView, ReportDetailView, ReportStatisticsView,
    ReportScheduleViewSet
)

router = DefaultRouter()
router.register(r'schedules', ReportScheduleViewSet, basename='report-schedule')

urlpatterns = [
    path('reports/', ReportListView.as_view(), name='report-list'),
    path('reports/<int:id>/', ReportDetailView.as_view(), name='report-detail'),
    path('reports/statistics/', ReportStatisticsView.as_view(), name='report-statistics'),
    path('', include(router.urls)),
]