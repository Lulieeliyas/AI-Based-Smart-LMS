from django.contrib import admin
from .models import DigitalResource, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_at')
    search_fields = ('name',)


@admin.register(DigitalResource)
class DigitalResourceAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'title', 'resource_type', 'source_type',
        'category', 'quality_status', 'access_level',
        'downloads_count', 'views_count', 'created_at',
    )
    list_filter = ('resource_type', 'source_type', 'quality_status', 'access_level', 'category')
    search_fields = ('title', 'description', 'keywords')
    readonly_fields = ('downloads_count', 'views_count', 'created_at', 'updated_at')