from django.contrib import admin
from .models import Borrow

@admin.register(Borrow)
class BorrowAdmin(admin.ModelAdmin):
    list_display = ('user', 'book', 'borrow_date', 'due_date', 'status', 'fine_amount')
    list_filter = ('status', 'borrow_date')
    search_fields = ('user__username', 'book__title')