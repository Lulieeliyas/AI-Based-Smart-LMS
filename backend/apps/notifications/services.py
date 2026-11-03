from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.borrowing.models import BorrowRecord
from .models import Notification


User = get_user_model()


class NotificationService:
    """Create and manage in-app notifications."""

    @staticmethod
    def create_notification(user, type, title, message, data=None):
        return Notification.objects.create(
            user=user,
            type=type,
            title=title,
            message=message,
            data=data or {},
        )

    @staticmethod
    def notify_roles(roles, type, title, message, data=None):
        """
        Notify active users with the specified application roles.
        Example roles: ['admin'] or ['librarian'].
        """
        recipients = User.objects.filter(
            role__in=roles,
            is_active=True,
        )

        notifications = [
            Notification(
                user=user,
                type=type,
                title=title,
                message=message,
                data=data or {},
            )
            for user in recipients
        ]

        return Notification.objects.bulk_create(notifications)

    @staticmethod
    def notify_admins_new_registration(user):
        return NotificationService.notify_roles(
            roles=['admin'],
            type='new_registration',
            title='New User Registration',
            message=(
                f'{user.get_full_name()} ({user.username}) '
                f'has verified their account and registered as '
                f'{user.get_role_display()}.'
            ),
            data={
                'user_id': str(user.id),
                'username': user.username,
                'role': user.role,
            },
        )

    @staticmethod
    def notify_librarians_book_event(book, event):
        event_details = {
            'added': (
                'book_added',
                'New Book Added',
                f'A new book, "{book.title}", has been added to the library.',
            ),
            'updated': (
                'book_updated',
                'Book Updated',
                f'The book "{book.title}" has been updated.',
            ),
            'deleted': (
                'book_deleted',
                'Book Deleted',
                f'The book "{book.title}" has been deleted from the library.',
            ),
        }

        if event not in event_details:
            raise ValueError(f'Unsupported book event: {event}')

        notification_type, title, message = event_details[event]

        return NotificationService.notify_roles(
            roles=['librarian'],
            type=notification_type,
            title=title,
            message=message,
            data={
                'book_title': book.title,
                'book_id': book.pk,
                'event': event,
            },
        )

    @staticmethod
    def notify_digital_officers_resource_event(resource, event):
        event_details = {
            'added': (
                'digital_resource_added',
                'Digital Resource Added',
                f'The digital resource "{resource.title}" has been added.',
            ),
            'updated': (
                'digital_resource_updated',
                'Digital Resource Updated',
                f'The digital resource "{resource.title}" has been updated.',
            ),
            'deleted': (
                'digital_resource_deleted',
                'Digital Resource Deleted',
                f'The digital resource "{resource.title}" has been deleted.',
            ),
        }

        if event == 'status':
            notification_type = 'digital_resource_status'
            title = 'Digital Resource Status Changed'
            message = (
                f'The digital resource "{resource.title}" '
                f'now has status: {resource.get_quality_status_display()}.'
            )
        elif event in event_details:
            notification_type, title, message = event_details[event]
        else:
            raise ValueError(
                f'Unsupported digital resource event: {event}'
            )

        return NotificationService.notify_roles(
            roles=['digital_officer'],
            type=notification_type,
            title=title,
            message=message,
            data={
                'resource_id': resource.pk,
                'resource_title': resource.title,
                'event': event,
                'quality_status': resource.quality_status,
            },
        )

    @staticmethod
    def send_borrow_due_reminders():
        """Notify users once, three days before a book is due."""
        due_date = timezone.localdate() + timedelta(days=3)

        borrowings = BorrowRecord.objects.filter(
            due_date=due_date,
            status=BorrowRecord.Status.ISSUED,
        ).select_related('user', 'book')

        notifications_created = 0

        for borrow in borrowings:
            _, created = Notification.objects.get_or_create(
                user=borrow.user,
                type='borrow_due',
                data__borrow_id=borrow.id,
                defaults={
                    'title': 'Book Due Soon',
                    'message': (
                        f"Your borrowed book '{borrow.book.title}' "
                        f'is due on {borrow.due_date}. Please return it on time.'
                    ),
                    'data': {
                        'borrow_id': borrow.id,
                        'book_id': borrow.book.id,
                    },
                },
            )

            if created:
                notifications_created += 1

        return notifications_created

    @staticmethod
    def send_overdue_alert():
        """Notify users about overdue books without creating duplicates."""
        today = timezone.localdate()

        borrowings = BorrowRecord.objects.filter(
            status=BorrowRecord.Status.OVERDUE,
        ).select_related('user', 'book')

        notifications_created = 0

        for borrow in borrowings:
            days_overdue = (today - borrow.due_date).days

            _, created = Notification.objects.get_or_create(
                user=borrow.user,
                type='overdue',
                data__borrow_id=borrow.id,
                defaults={
                    'title': 'Book Overdue',
                    'message': (
                        f"Your borrowed book '{borrow.book.title}' "
                        f'is {days_overdue} days overdue. '
                        'Please return it immediately.'
                    ),
                    'data': {
                        'borrow_id': borrow.id,
                        'book_id': borrow.book.id,
                        'days_overdue': days_overdue,
                    },
                },
            )

            if created:
                notifications_created += 1

        return notifications_created

    @staticmethod
    def send_return_confirmation(user, book_title, borrow_id):
        return NotificationService.create_notification(
            user=user,
            type='return_confirmation',
            title='Book Returned',
            message=f"You have successfully returned '{book_title}'.",
            data={'borrow_id': borrow_id},
        )

    @staticmethod
    def notify_user_fine_payment_successful(payment):
        fine = payment.fine

        return NotificationService.create_notification(
            user=payment.user,
            type='fine_payment_successful',
            title='Fine Payment Successful',
            message=(
                f"Your payment of ETB {payment.amount} for "
                f"your {fine.get_reason_display().lower()} fine "
                f"was successful. "
                f"Remaining balance: ETB {fine.outstanding_balance}."
            ),
            data={
                'payment_id': payment.pk,
                'fine_id': fine.pk,
                'amount_paid': str(payment.amount),
                'outstanding_balance': str(fine.outstanding_balance),
                'tx_ref': payment.tx_ref,
            },
        )

    @staticmethod
    def notify_librarians_fine_payment_received(payment):
        fine = payment.fine

        return NotificationService.notify_roles(
            roles=['librarian'],
            type='fine_payment_received',
            title='Fine Payment Received',
            message=(
                f"{payment.user.username} made a payment of "
                f"ETB {payment.amount} for a "
                f"{fine.get_reason_display().lower()} fine."
            ),
            data={
                'payment_id': payment.pk,
                'fine_id': fine.pk,
                'borrower_id': str(payment.user.pk),
                'borrower_username': payment.user.username,
                'amount_paid': str(payment.amount),
                'outstanding_balance': str(fine.outstanding_balance),
                'tx_ref': payment.tx_ref,
            },
        )
