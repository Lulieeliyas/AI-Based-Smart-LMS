# apps/digital_resources/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('digital-resources/', views.DigitalResourceListCreateView.as_view(), name='digital-resource-list'),
    path('digital-resources/<int:pk>/', views.DigitalResourceDetailView.as_view(), name='digital-resource-detail'),
    path('digital-resources/<int:pk>/view/', views.DigitalResourceServeView.as_view(), name='digital-resource-view'),
    path('digital-resources/<int:pk>/download/', views.DigitalResourceDownloadView.as_view(), name='digital-resource-download'),
    path('digital-resources/<int:pk>/verify/', views.VerifyResourceView.as_view(), name='digital-resource-verify'),
    path('categories/', views.DigitalCategoryListCreateView.as_view(), name='digital-category-list'),
    path('stats/', views.DigitalStatsView.as_view(), name='digital-stats'),
]