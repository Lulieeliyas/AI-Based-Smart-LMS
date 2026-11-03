
from django.core.management.base import BaseCommand

from apps.notifications.services import NotificationService
from apps.borrowing.services import mark_overdue_records


class Command(BaseCommand):
    help = "Generate due-soon and overdue in-app notifications."

    def handle(self, *args, **options):
        self.stdout.write("Starting notification processing...")

        # Mark overdue borrowing records and create overdue notifications.
        overdue_count = mark_overdue_records()

        # Create reminders for books due in three days.
        due_count = NotificationService.send_borrow_due_reminders()

        self.stdout.write(
            self.style.SUCCESS(
                f"Notification processing completed.\n"
                f"New overdue notifications: {overdue_count}\n"
                f"New due-soon notifications: {due_count}"
            )
        )
