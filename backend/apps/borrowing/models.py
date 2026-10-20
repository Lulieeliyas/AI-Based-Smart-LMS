from django.db import models
from django.conf import settings
from apps.books.models import Book


class BorrowRecord(models.Model):
    class Status(models.TextChoices):
        ISSUED = "issued", "Issued"
        RETURNED = "returned", "Returned"
        OVERDUE = "overdue", "Overdue"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="borrows",
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name="borrows",
    )
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ISSUED,
    )
    fine = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        ordering = ["-issue_date"]

    def __str__(self):
        return f"{self.user} -> {self.book} ({self.status})"
