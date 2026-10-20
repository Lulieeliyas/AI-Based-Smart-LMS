from django.contrib import admin
from .models import BorrowRecord


@admin.register(BorrowRecord)
class BorrowRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "book", "issue_date", "due_date", "return_date", "status", "fine")
    list_filter = ("status",)
    search_fields = ("user__username", "book__title")
