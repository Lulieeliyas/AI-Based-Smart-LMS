from .models import Notification
from apps.borrowing.models import BorrowRecord
from django.utils import timezone
from datetime import timedelta

class NotificationService:
    
    @staticmethod
    def create_notification(user, type, title, message, data=None):
        """Create a notification for a user."""
        return Notification.objects.create(
            user=user,
            type=type,
            title=title,
            message=message,
            data=data or {}
        )

    @staticmethod
    def send_borrow_due_reminders():
        """Send reminders for books due soon (3 days)."""
        from datetime import date, timedelta
        
        due_date = date.today() + timedelta(days=3)
        upcoming_due_borrowings = BorrowRecord.objects.filter(
            due_date=due_date,
            status='borrowed'
        ).select_related('user', 'book')
        
        notifications_created = 0
        for borrow in upcoming_due_borrowings:
            message = f"Your borrowed book '{borrow.book.title}' is due on {borrow.due_date}. Please return it on time."
            NotificationService.create_notification(
                user=borrow.user,
                type='borrow_due',
                title='Book Due Soon',
                message=message,
                data={'borrow_id': borrow.id, 'book_id': borrow.book.id}
            )
            notifications_created += 1
        
        return notifications_created

    @staticmethod
    def send_overdue_alert():
        """Send alerts for overdue books."""
        overdue_borrowings = BorrowRecord.objects.filter(
            status='overdue'
        ).select_related('user', 'book')
        
        notifications_created = 0
        for borrow in overdue_borrowings:
            days_overdue = (timezone.now().date() - borrow.due_date).days
            message = f"Your borrowed book '{borrow.book.title}' is {days_overdue} days overdue. Please return it immediately."
            NotificationService.create_notification(
                user=borrow.user,
                type='overdue',
                title='Book Overdue',
                message=message,
                data={'borrow_id': borrow.id, 'book_id': borrow.book.id, 'days_overdue': days_overdue}
            )
            notifications_created += 1
        
        return notifications_created

    @staticmethod
    def send_return_confirmation(user, book_title, borrow_id):
        """Send confirmation when a book is returned."""
        return NotificationService.create_notification(
            user=user,
            type='return_confirmation',
            title='Book Returned',
            message=f"You have successfully returned '{book_title}'.",
            data={'borrow_id': borrow_id}
        )