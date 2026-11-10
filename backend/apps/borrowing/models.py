from django.db import models
from django.conf import settings
from apps.books.models import Book


class BorrowRecord(models.Model):
    class Status(models.TextChoices):
     PENDING = "pending", "Pending approval"
     ISSUED = "issued", "Issued"
     OVERDUE = "overdue", "Overdue"
     RETURN_REQUESTED = "return_requested", "Return requested"
     AWAITING_PAYMENT = "awaiting_payment", "Awaiting fine payment"
     READY_TO_RETURN = "ready_to_return", "Ready to finalize return"
     RETURNED = "returned", "Returned"
     REJECTED = "rejected", "Rejected"

    class DamageStatus(models.TextChoices):
        NONE = "none", "No damage"
        MINOR = "minor", "Minor"
        MODERATE = "moderate", "Moderate"
        SEVERE = "severe", "Severe"
        LOST = "lost", "Lost"


    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="borrows")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="borrows")
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ISSUED)
    fine = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    return_requested_at = models.DateTimeField(null=True, blank=True)
    inspected_at = models.DateTimeField(null=True, blank=True)
    damage_status = models.CharField(max_length=16, choices=DamageStatus.choices, default=DamageStatus.NONE)
    damage_notes = models.TextField(blank=True)
    damage_fine = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    return_confirmed_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name="confirmed_book_returns"
)
    class Meta:
        ordering = ["-issue_date"]

    def __str__(self):
        return f"{self.user} -> {self.book} ({self.status})"
