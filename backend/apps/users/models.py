from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid

class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('academic_staff', 'Academic Staff'),
        ('librarian', 'Librarian'),
        ('admin', 'System Administrator'),
        ('digital_officer', 'Digital Library Officer'),
        ('guest', 'Guest'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ✅ Make email unique
    email = models.EmailField(unique=True, error_messages={
        'unique': 'A user with this email already exists.'
    })
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=15, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    student_id = models.CharField(max_length=20, blank=True, null=True)
    max_books_allowed = models.IntegerField(default=5)
    is_email_verified = models.BooleanField(default=False)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['email']),
            models.Index(fields=['department']),
        ]
    
    def __str__(self):
        return f"{self.username} - {self.get_role_display()}"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username
    
    def can_borrow(self):
        from apps.borrowing.models import Borrow
        active_borrowings = Borrow.objects.filter(
            user=self,
            status__in=['borrowed', 'overdue']
        ).count()
        return active_borrowings < self.max_books_allowed
    
    def get_active_borrowings_count(self):
        from apps.borrowing.models import Borrow
        return Borrow.objects.filter(
            user=self,
            status__in=['borrowed', 'overdue']
        ).count()



class EmailVerification(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_verification')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    otp = models.CharField(max_length=6, blank=True, null=True)  # ✅ Add OTP field
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=1)
        super().save(*args, **kwargs)
    
    def is_valid(self):
        return not self.expires_at < timezone.now()
    
    def verify_otp(self, otp):
        return self.otp == otp and self.is_valid()


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_resets')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    otp = models.CharField(max_length=6, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        super().save(*args, **kwargs)
    
    def is_valid(self):
        return not self.expires_at < timezone.now() and not self.used


class UserActivityLog(models.Model):
    ACTION_CHOICES = (
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('borrow', 'Borrow Book'),
        ('return', 'Return Book'),
        ('search', 'Search'),
        ('view', 'View'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('create', 'Create'),
        ('export', 'Export'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_activities')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_activity_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'action']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.action} at {self.created_at}"