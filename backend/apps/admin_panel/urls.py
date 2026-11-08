
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

router.register(
    r'backups',
    views.BackupRecordViewSet,
    basename='backup'
)

router.register(
    r'settings',
    views.SystemSettingViewSet,
    basename='setting'
)

router.register(
    r'restores',
    views.RestoreLogViewSet,
    basename='restore'
)

router.register(
    r'audit',
    views.AuditLogViewSet,
    basename='audit'
)

urlpatterns = [
    path(
        'stats/',
        views.SystemStatsView.as_view(),
        name='system-stats'
    ),
    path('', include(router.urls)),
]
