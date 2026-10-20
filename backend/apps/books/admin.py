from django.contrib import admin
from .models import Category, Book, Rating


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "author", "category", "access_type", "total_copies", "available_copies")
    list_filter = ("category", "access_type")
    search_fields = ("title", "author", "isbn")


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "book", "score", "created_at")
    list_filter = ("score",)
