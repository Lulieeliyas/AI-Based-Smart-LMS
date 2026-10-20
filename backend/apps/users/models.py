
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid


class User(AbstractUser):
    ROLE_CHOICES = (
        ("student", "Student"),
        ("academic_staff", "Academic Staff"),
        ("librarian", "Librarian"),
        ("admin", "System Administrator"),
        ("digital_officer", "Digital Library Officer"),
        ("guest", "Guest"),
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    email = models.EmailField(
        unique=True,
        error_messages={
            "unique": "A user with this email already exists."
        },
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="student",
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
        null=True,
    )

    profile_picture = models.ImageField(
        upload_to="profiles/",
        null=True,
        blank=True,
    )

    department = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    student_id = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    max_books_allowed = models.IntegerField(default=5)
    is_email_verified = models.BooleanField(default=False)

    last_login_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["email"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.username} - {self.get_role_display()}"

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.username

    def get_active_borrowings_count(self):
        from apps.borrowing.models import BorrowRecord

        return BorrowRecord.objects.filter(
            user=self,
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ],
        ).count()

    def can_borrow(self):
        return (
            self.get_active_borrowings_count()
            < self.max_books_allowed
        )


class EmailVerification(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification",
    )

    token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
    )

    otp = models.CharField(
        max_length=6,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.conf import settings
            
            self.expires_at = (
                timezone.now()
                + timezone.timedelta(
                    minutes=settings.OTP_EXPIRY_MINUTES
                    )
                    )
            
        super().save(*args, **kwargs)


    def is_valid(self):
        return self.expires_at >= timezone.now()

    def verify_otp(self, otp):
        return self.otp == otp and self.is_valid()

    def __str__(self):
        return f"Email verification for {self.user.username}"


class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_resets",
    )

    token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
    )

    otp = models.CharField(
        max_length=6,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = (
                timezone.now() + timezone.timedelta(hours=24)
            )
        super().save(*args, **kwargs)

    def is_valid(self):
        return self.expires_at >= timezone.now() and not self.used

    def __str__(self):
        return f"Password reset for {self.user.username}"


class UserActivityLog(models.Model):
    ACTION_CHOICES = (
        ("login", "Login"),
        ("logout", "Logout"),
        ("borrow", "Borrow Book"),
        ("return", "Return Book"),
        ("search", "Search"),
        ("view", "View"),
        ("update", "Update"),
        ("delete", "Delete"),
        ("create", "Create"),
        ("export", "Export"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_activities",
    )

    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
    )

    description = models.TextField(
        blank=True,
        null=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    user_agent = models.TextField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_activity_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "action"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return (
            f"{self.user.username} - {self.action} "
            f"at {self.created_at}"
        )

class AuthorizedUser(models.Model):
    """
    People approved by an administrator to register for the library.
    Their trusted details are imported from an administrator's CSV file.
    """

    ALLOWED_ROLES = (
    ("student", "Student"),
    ("academic_staff", "Academic Staff"),
    ("digital_officer", "Digital Library Officer"),
    ("librarian", "Librarian"),
)

    student_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)
    role = models.CharField(
        max_length=20,
        choices=ALLOWED_ROLES,
        default="student",
    )
    is_authorized = models.BooleanField(default=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student_id"]

    def __str__(self):
        return f"{self.student_id} - {self.first_name} {self.last_name}"

