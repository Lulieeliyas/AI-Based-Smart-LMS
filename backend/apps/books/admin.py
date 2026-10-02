from django.contrib import admin
from .models import Book, Category, BookReview

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description', 'created_at')
    search_fields = ('name',)
    list_filter = ('created_at',)

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title', 
        'author', 
        'isbn', 
        'category', 
        'status', 
        'available_quantity',
        'quantity',
        'created_at'
    )
    list_filter = ('category', 'status', 'author')
    search_fields = ('title', 'author', 'isbn', 'publisher')
    list_editable = ('status', 'available_quantity')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'author', 'isbn', 'category', 'publisher', 'publication_year')
        }),
        ('Physical Details', {
            'fields': ('edition', 'pages', 'location')
        }),
        ('Availability', {
            'fields': ('status', 'quantity', 'available_quantity')
        }),
        ('Additional', {
            'fields': ('description', 'cover_image', 'added_by')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(BookReview)
class BookReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'book', 'user', 'rating', 'comment', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('book__title', 'user__username', 'comment')