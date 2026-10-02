from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class Borrow(models.Model):
    STATUS_CHOICES = (
        ('borrowed', 'Borrowed'),
        ('returned', 'Returned'),
        ('overdue', 'Overdue'),
        ('renewed', 'Renewed'),
        ('pending', 'Pending'),
        ('cancelled', 'Cancelled'),
        ('damaged', 'Damaged'),
        ('lost', 'Lost'),
    )
    
    DAMAGE_STATUS_CHOICES = (
        ('none', 'No Damage'),
        ('minor', 'Minor Damage'),
        ('moderate', 'Moderate Damage'),
        ('severe', 'Severe Damage'),
        ('lost', 'Lost'),
    )
    
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('academic_staff', 'Academic Staff'),
        ('librarian', 'Librarian'),
        ('admin', 'System Administrator'),
        ('guest', 'Guest'),
    )
    
    # Basic borrow info
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='borrowings')
    book = models.ForeignKey('books.Book', on_delete=models.CASCADE, related_name='borrowings')
    borrow_date = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='borrowed')
    fine_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fine_paid = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
        null=True, related_name='processed_borrowings'
    )
    
    # Borrower details
    borrower_role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    student_id = models.CharField(max_length=50, blank=True, null=True)
    student_name = models.CharField(max_length=200, blank=True, null=True)
    staff_id = models.CharField(max_length=50, blank=True, null=True)
    staff_name = models.CharField(max_length=200, blank=True, null=True)
    staff_position = models.CharField(max_length=100, blank=True, null=True)
    
    # Image fields
    id_front_image = models.TextField(blank=True, null=True, help_text="Base64 encoded front of ID")
    id_back_image = models.TextField(blank=True, null=True, help_text="Base64 encoded back of ID")
    selfie_image = models.TextField(blank=True, null=True, help_text="Base64 encoded selfie")
    
    # Damage/Loss fields
    damage_status = models.CharField(max_length=20, choices=DAMAGE_STATUS_CHOICES, default='none')
    damage_description = models.TextField(blank=True, null=True)
    damage_reported_at = models.DateTimeField(null=True, blank=True)
    damage_reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reported_damages'
    )
    damage_images = models.TextField(blank=True, null=True, help_text="JSON list of damage images")
    
    # Payment fields
    payment_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=20, default='pending')  # pending, completed, failed
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    payment_data = models.JSONField(default=dict, blank=True)
    
    # Borrow duration
    borrow_duration_days = models.IntegerField(default=14)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'borrow_records'
        ordering = ['-borrow_date']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'due_date']),
            models.Index(fields=['borrower_role']),
            models.Index(fields=['student_id']),
            models.Index(fields=['staff_id']),
            models.Index(fields=['damage_status']),
            models.Index(fields=['payment_status']),
        ]
    
    def __str__(self):
        return f"{self.get_borrower_name()} - {self.book.title} - {self.status}"
    
    def get_borrower_name(self):
        """Get the borrower's name based on role"""
        if self.borrower_role == 'student':
            return self.student_name or self.user.username
        elif self.borrower_role == 'academic_staff':
            return self.staff_name or self.user.username
        return self.user.username
    
    def get_borrower_id(self):
        """Get the borrower's ID based on role"""
        if self.borrower_role == 'student':
            return self.student_id
        elif self.borrower_role == 'academic_staff':
            return self.staff_id
        return None
    
    def is_overdue(self):
        """Check if the borrowing is overdue."""
        if self.status in ['borrowed', 'renewed']:
            due_datetime = timezone.datetime.combine(self.due_date, timezone.datetime.min.time())
            due_datetime = timezone.make_aware(due_datetime)
            return timezone.now() > due_datetime
        return False
    
    def calculate_fine(self, daily_rate=2.0):
        """Calculate fine for overdue books."""
        if not self.is_overdue():
            return 0
        due_datetime = timezone.datetime.combine(self.due_date, timezone.datetime.min.time())
        due_datetime = timezone.make_aware(due_datetime)
        days_overdue = (timezone.now() - due_datetime).days
        return days_overdue * daily_rate
    
    def calculate_damage_cost(self):
        """Calculate cost based on damage status"""
        damage_costs = {
            'none': 0,
            'minor': 5.00,
            'moderate': 15.00,
            'severe': 30.00,
            'lost': 50.00,
        }
        return damage_costs.get(self.damage_status, 0)
    
    def save(self, *args, **kwargs):
        # Set default due date if not set
        if not self.due_date and self.borrow_duration_days:
            self.due_date = timezone.now().date() + timedelta(days=self.borrow_duration_days)
        elif not self.due_date:
            self.due_date = timezone.now().date() + timedelta(days=14)
        
        # Check if overdue and update status
        if self.status in ['borrowed', 'renewed'] and self.is_overdue():
            self.status = 'overdue'
            if not self.fine_amount:
                self.fine_amount = self.calculate_fine()
        
        # Calculate total payment amount
        self.payment_amount = self.fine_amount + self.calculate_damage_cost()
        
        super().save(*args, **kwargs)


class BorrowHistory(models.Model):
    borrowing = models.ForeignKey(Borrow, on_delete=models.CASCADE, related_name='history_entries')
    action = models.CharField(max_length=50)
    previous_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'borrow_history'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.action} - {self.borrowing} at {self.timestamp}"