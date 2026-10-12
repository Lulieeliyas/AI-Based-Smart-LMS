from django.conf import settings
from django.db import models

from apps.books.models import Book


class UserBookInteraction(models.Model):
    INTERACTION_TYPES = (
        ("view", "View"),
        ("borrow", "Borrow"),
        ("reserve", "Reserve"),
        ("favorite", "Favorite"),
        ("rate", "Rate"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="book_interactions",
    )

    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name="user_interactions",
    )

    interaction_type = models.CharField(
        max_length=20,
        choices=INTERACTION_TYPES,
    )

    rating = models.IntegerField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.book.title} - "
            f"{self.interaction_type}"
        )
