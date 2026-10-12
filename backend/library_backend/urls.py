from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from rest_framework_simplejwt.views import TokenRefreshView
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="AI-Based Smart Library Management API",
        default_version='v1',
        description="API documentation for the AI-Based Smart Library Management and Recommendation System",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@library.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/public/', include('apps.users.public_urls')),
    # API URLs
    path('api/users/', include('apps.users.urls')),
    path('api/users/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/books/', include('apps.books.urls')),
    path('api/borrowing/', include('apps.borrowing.urls')),
    path('api/recommendations/', include('apps.ai_recommendations.urls')),
    path('api/digital/', include('apps.digital_resources.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    # Swagger/API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
