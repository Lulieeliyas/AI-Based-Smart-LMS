from django.db import models
from django.conf import settings

class Notification(models.Model):
    NOTIFICATION_TYPES = (
    ('borrow_due', 'Borrow Due Reminder'),
    ('overdue', 'Overdue Alert'),
    ('return_confirmation', 'Return Confirmation'),
    ('new_resource', 'New Resource Available'),
    ('system', 'System Notification'),

    ('new_registration', 'New User Registration'),
    ('book_added', 'New Book Added'),
    ('book_updated', 'Book Updated'),
    ('book_deleted', 'Book Deleted'),
    ('borrow_activity', 'Borrowing Activity'),

    ('fine_update', 'Fine Update'),
    ('fine_payment_successful', 'Fine Payment Successful'),
    ('fine_payment_received', 'Fine Payment Received'),
    ('fine_extension_request', 'Fine Extension Request'),
    ('fine_extension_update', 'Fine Extension Update'),
    ('damage_report', 'Damage Report'),

    ('digital_resource_added', 'Digital Resource Added'),
    ('digital_resource_updated', 'Digital Resource Updated'),
    ('digital_resource_deleted', 'Digital Resource Deleted'),
    ('digital_resource_status', 'Digital Resource Status Changed'),
)
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"