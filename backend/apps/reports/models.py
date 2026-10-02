from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class Report(models.Model):
    REPORT_TYPES = (
        ('borrowing', 'Borrowing Report'),
        ('user', 'User Report'),
        ('book', 'Book Report'),
        ('overdue', 'Overdue Report'),
        ('fine', 'Fine Report'),
        ('inventory', 'Inventory Report'),
        ('popular_books', 'Popular Books Report'),
        ('category', 'Category Report'),
        ('damage', 'Damage Report'),
        ('digital_resources', 'Digital Resources Report'),
        ('daily', 'Daily Report'),
        ('monthly', 'Monthly Report'),
        ('yearly', 'Yearly Report'),
        ('custom', 'Custom Report'),
    )
    
    REPORT_FORMATS = (
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
        ('json', 'JSON'),
    )
    
    # Use AutoField or BigAutoField for id instead of UUID
    id = models.BigAutoField(primary_key=True)  # ✅ Use AutoField instead of UUID
    
    title = models.CharField(max_length=200)
    report_type = models.CharField(max_length=50, choices=REPORT_TYPES)
    description = models.TextField(blank=True, null=True)
    parameters = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to='reports/', null=True, blank=True)
    file_format = models.CharField(max_length=20, choices=REPORT_FORMATS, default='pdf')
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='generated_reports',
        null=True,  # ✅ Allow null for migration
        blank=True
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    is_scheduled = models.BooleanField(default=False)
    schedule_frequency = models.CharField(max_length=20, blank=True, null=True)
    next_schedule = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    
    class Meta:
        db_table = 'reports'
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['report_type', 'generated_at']),
            models.Index(fields=['generated_by']),
            models.Index(fields=['start_date', 'end_date']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.get_report_type_display()}"
    
    def get_file_size(self):
        if self.file and self.file.size:
            return self.file.size
        return 0


class ReportSchedule(models.Model):
    FREQUENCY_CHOICES = (
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
    )
    
    id = models.BigAutoField(primary_key=True)  # ✅ Use AutoField instead of UUID
    
    report_type = models.CharField(max_length=50, choices=Report.REPORT_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    parameters = models.JSONField(default=dict, blank=True)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    format = models.CharField(max_length=20, choices=Report.REPORT_FORMATS, default='pdf')
    recipients = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    last_run = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        null=True,  # ✅ Allow null for migration
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    
    class Meta:
        db_table = 'report_schedules'
        ordering = ['next_run']
    
    def __str__(self):
        return f"{self.title} - {self.get_frequency_display()}"