from django.contrib import admin
from .models import Recommendation, RecommendationActivity  # ✅ Updated import

@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ['user', 'book', 'score', 'algorithm_used', 'is_viewed', 'is_clicked', 'generated_at']
    list_filter = ['algorithm_used', 'is_viewed', 'is_clicked']
    search_fields = ['user__username', 'book__title']
    readonly_fields = ['generated_at', 'updated_at']

@admin.register(RecommendationActivity)  # ✅ Updated registration
class RecommendationActivityAdmin(admin.ModelAdmin):  # ✅ Renamed class
    list_display = ['user', 'book', 'activity_type', 'created_at']
    list_filter = ['activity_type']
    search_fields = ['user__username', 'book__title']
    readonly_fields = ['created_at']