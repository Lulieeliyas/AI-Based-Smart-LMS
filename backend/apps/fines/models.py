
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Fine(models.Model):
    class Reason(models.TextChoices):
        OVERDUE = "overdue", "Overdue"
        DAMAGED = "damaged", "Damaged Book"
        LOST = "lost", "Lost Book"
        OTHER = "other", "Other Penalty"

    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"
        DISPUTED = "disputed", "Disputed"
        WAIVED = "waived", "Waived"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="fines",
    )

    # General link to the borrowing record, if the fine relates to a book.
    borrow_record = models.ForeignKey(
        "borrowing.BorrowRecord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fine_records",
    )

    # A separate unique link prevents multiple automatic overdue fines
    # from being created for the same borrowing record.
    overdue_borrow_record = models.OneToOneField(
        "borrowing.BorrowRecord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="overdue_fine_record",
    )

    reason = models.CharField(
        max_length=20,
        choices=Reason.choices,
    )
    description = models.TextField()

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    paid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNPAID,
    )

    payment_due_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["reason", "created_at"]),
            models.Index(fields=["payment_due_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(paid_amount__lte=models.F("amount")),
                name="fine_paid_not_over_amount",
            ),
        ]

    @property
    def outstanding_balance(self):
        return max(
            self.amount - self.paid_amount,
            Decimal("0.00"),
        )

    def __str__(self):
        return f"Fine #{self.pk} - {self.user} - {self.amount} ETB"


class FineReport(models.Model):
    class Reason(models.TextChoices):
        DAMAGED = "damaged", "Damaged Book"
        LOST = "lost", "Lost Book"
        OTHER = "other", "Other Problem"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_fine_reports",
    )

    # The user affected by the incident.
    # This can be set directly when there is no borrowing record.
    subject_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fine_reports_against",
    )

    borrow_record = models.ForeignKey(
        "borrowing.BorrowRecord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fine_reports",
    )

    reason = models.CharField(
        max_length=20,
        choices=Reason.choices,
    )
    description = models.TextField()

    evidence = models.FileField(
        upload_to="fine_reports/evidence/",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    proposed_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    approved_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    librarian_response = models.TextField(blank=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_fine_reports",
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    generated_fine = models.OneToOneField(
        Fine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_report",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["reported_by", "status"]),
        ]

    def __str__(self):
        return f"Fine report #{self.pk} - {self.reason} - {self.status}"


class FinePayment(models.Model):
    class Provider(models.TextChoices):
        CHAPA = "chapa", "Chapa"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESSFUL = "successful", "Successful"
        FAILED = "failed", "Failed"

    fine = models.ForeignKey(
        Fine,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="fine_payments",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    currency = models.CharField(max_length=3, default="ETB")
    provider = models.CharField(
        max_length=20,
        choices=Provider.choices,
        default=Provider.CHAPA,
    )

    tx_ref = models.CharField(max_length=100, unique=True)
    provider_reference = models.CharField(
        max_length=150,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    checkout_url = models.URLField(max_length=1000, blank=True)

    provider_response = models.JSONField(default=dict, blank=True)

    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["fine", "status"]),
        ]

    def __str__(self):
        return f"{self.tx_ref} - {self.amount} ETB - {self.status}"


class FineExtensionRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    fine = models.ForeignKey(
        Fine,
        on_delete=models.PROTECT,
        related_name="extension_requests",
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="fine_extension_requests",
    )

    reason = models.TextField()
    requested_until = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_fine_extensions",
    )

    approved_until = models.DateField(null=True, blank=True)
    decision_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["requested_by", "status"]),
        ]

    def __str__(self):
        return f"Extension request #{self.pk} - {self.status}"


class FineAdminReport(models.Model):
    class ExportFormat(models.TextChoices):
        CSV = "csv", "CSV"
        EXCEL = "xlsx", "Excel"
        PDF = "pdf", "PDF"
        IMAGE = "image", "Image"
        PRINT = "print", "Printable"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_fine_admin_reports",
    )

    recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="received_fine_admin_reports",
        blank=True,
    )

    export_format = models.CharField(
        max_length=10,
        choices=ExportFormat.choices,
    )

    filters = models.JSONField(default=dict, blank=True)

    # Snapshot of exactly the data the librarian chose to share.
    snapshot = models.JSONField(default=dict)

    file = models.FileField(
        upload_to="fine_admin_reports/",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.created_by}"
