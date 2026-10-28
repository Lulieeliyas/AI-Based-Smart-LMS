# backend/apps/digital_resources/urls.py

from django.urls import path

from .views import (
    DigitalResourceListCreateView,
    DigitalResourceDetailView,
    DigitalResourceServeView,
    DigitalResourceVerifyView,
    DigitalResourcePublishView,
    DigitalResourceDownloadView,
    CategoryListCreateView,
    CategoryDetailView,
    DigitalResourceStatsView,
)

urlpatterns = [
    # Resources endpoints (canonical)
    path(
        "resources/",
        DigitalResourceListCreateView.as_view(),
        name="digital-resource-list-create",
    ),
    path(
        "resources/<int:pk>/",
        DigitalResourceDetailView.as_view(),
        name="digital-resource-detail",
    ),
    path(
        "resources/<int:pk>/view/",
        DigitalResourceServeView.as_view(),
        name="digital-resource-view",
    ),
    path(
        "resources/<int:pk>/verify/",
        DigitalResourceVerifyView.as_view(),
        name="digital-resource-verify",
    ),
    path(
        "resources/<int:pk>/publish/",
        DigitalResourcePublishView.as_view(),
        name="digital-resource-publish",
    ),
    path(
        "resources/<int:pk>/download/",
        DigitalResourceDownloadView.as_view(),
        name="digital-resource-download",
    ),

    # Legacy alias digital-resources/
    path(
        "digital-resources/",
        DigitalResourceListCreateView.as_view(),
        name="legacy-digital-resource-list-create",
    ),
    path(
        "digital-resources/<int:pk>/",
        DigitalResourceDetailView.as_view(),
        name="legacy-digital-resource-detail",
    ),
    path(
        "digital-resources/<int:pk>/view/",
        DigitalResourceServeView.as_view(),
        name="legacy-digital-resource-view",
    ),
    path(
        "digital-resources/<int:pk>/download/",
        DigitalResourceDownloadView.as_view(),
        name="legacy-digital-resource-download",
    ),
    path(
        "digital-resources/<int:pk>/verify/",
        DigitalResourceVerifyView.as_view(),
        name="legacy-digital-resource-verify",
    ),

    # Categories
    path(
        "categories/",
        CategoryListCreateView.as_view(),
        name="digital-category-list-create",
    ),
    path(
        "categories/<int:pk>/",
        CategoryDetailView.as_view(),
        name="digital-category-detail",
    ),

    # Statistics
    path(
        "stats/",
        DigitalResourceStatsView.as_view(),
        name="digital-resource-stats",
    ),
]
