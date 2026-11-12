
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
        required=True
    )

    username = serializers.CharField(
        source="user.username",
        read_only=True
    )

    return_confirmed_by_name = serializers.CharField(
        source="return_confirmed_by.username",
        read_only=True
    )

    class Meta:
        model = BorrowRecord
        fields = (
            "id",
            "user",
            "username",
            "book",
            "book_id",
            "issue_date",
            "due_date",
            "return_date",
            "status",
            "fine",
            "return_requested_at",
            "inspected_at",
            "damage_status",
            "damage_notes",
            "damage_fine",
            "return_confirmed_by",
            "return_confirmed_by_name",
        )

        read_only_fields = (
            "id",
            "user",
            "username",
            "book",
            "issue_date",
            "due_date",
            "return_date",
            "status",
            "fine",
            "return_requested_at",
            "inspected_at",
            "damage_status",
            "damage_notes",
            "damage_fine",
            "return_confirmed_by",
            "return_confirmed_by_name",
        )
