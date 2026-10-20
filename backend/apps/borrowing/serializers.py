from rest_framework import serializers

from .models import BorrowRecord
from apps.books.models import Book
from apps.books.serializers import BookSerializer


class BorrowRecordSerializer(serializers.ModelSerializer):
    book = BookSerializer(read_only=True)
    book_id = serializers.PrimaryKeyRelatedField(
        queryset=Book.objects.all(),
        source="book",
        write_only=True,
    )
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = BorrowRecord
        fields = (
            "id", "user", "username", "book", "book_id",
            "issue_date", "due_date", "return_date", "status", "fine",
        )
        read_only_fields = (
            "user", "issue_date", "due_date", "return_date", "status", "fine",
        )
