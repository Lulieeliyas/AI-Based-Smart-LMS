

from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from apps.books.models import Book
from apps.users.models import AuthorizedUser
from apps.notifications.models import Notification
from .models import BorrowRecord
from django.utils import timezone


def get_borrowing_period(user):
    """
    Return the borrowing period according to the approved
    role and trusted department in AuthorizedUser.

    Academic staff: 30 days
    Health students: 30 days
    Law students: 30 days
    Everyone else: 14 days
    """

    if not user.is_approved_member():
        raise ValueError(
            "Your account is not approved to borrow books."
        )

    # Academic staff receive 30 days.
    if user.role == "academic_staff":
        return settings.BORROW_DAYS_ACADEMIC_STAFF

    # Only students are eligible for the Health/Law exception.
    if user.role == "student" and user.student_id:
        authorized_user = AuthorizedUser.objects.filter(
            student_id__iexact=user.student_id,
            is_authorized=True,
        ).only("department").first()

        if authorized_user:
            trusted_department = (
                authorized_user.department or ""
            ).strip().casefold()

            if "health" in trusted_department:
                return settings.BORROW_DAYS_HEALTH_STUDENT

            if "law" in trusted_department:
                return settings.BORROW_DAYS_LAW_STUDENT

    # All other users receive the standard borrowing period.
    return settings.BORROW_DAYS_OTHER


def calculate_overdue_fine(due_date, calculation_date=None):
    """
    Calculate overdue fine using the configured daily rate.

    Fine = overdue days * daily fine rate.
    Currency: ETB.
    """

    calculation_date = calculation_date or date.today()

    if calculation_date <= due_date:
        return Decimal("0.00")

    days_late = (calculation_date - due_date).days
    daily_rate = Decimal(str(settings.FINE_PER_DAY))

    return (daily_rate * days_late).quantize(Decimal("0.01"))


@transaction.atomic
def issue_book(user, book_id):
    """Issue a book and create an in-app notification."""

    borrowing_days = get_borrowing_period(user)

    if not user.can_borrow():
        raise ValueError(
            "You have reached your maximum borrowing limit."
        )

    book = Book.objects.select_for_update().get(id=book_id)

    if book.available_copies <= 0:
        raise ValueError("No copies available.")

    if BorrowRecord.objects.filter(
        user=user,
        book=book,
        status__in=[
            BorrowRecord.Status.ISSUED,
            BorrowRecord.Status.OVERDUE,
        ],
    ).exists():
        raise ValueError("You already have this book.")

    record = BorrowRecord.objects.create(
        user=user,
        book=book,
        due_date=date.today() + timedelta(days=borrowing_days),
    )

    book.available_copies -= 1
    book.save(update_fields=["available_copies"])

    Notification.objects.create(
        user=user,
        type="system",
        title="Book Borrowed",
        message=(
            f"You borrowed '{book.title}'. "
            f"Your borrowing period is {borrowing_days} days. "
            f"Due date: {record.due_date}."
        ),
        data={
            "borrow_id": record.id,
            "book_id": book.id,
            "borrowing_days": borrowing_days,
            "due_date": str(record.due_date),
        },
    )

    return record


@transaction.atomic
def return_book(user, record_id):
    """Return a borrowed book and calculate its final overdue fine."""

    record = BorrowRecord.objects.select_for_update().select_related(
        "book"
    ).get(
        id=record_id,
        user=user,
    )

    if record.status == BorrowRecord.Status.RETURNED:
        raise ValueError("This book has already been returned.")

    today = date.today()

    record.return_date = today
    record.status = BorrowRecord.Status.RETURNED
    record.fine = calculate_overdue_fine(record.due_date, today)

    record.save(
        update_fields=["return_date", "status", "fine"]
    )

    record.book.available_copies += 1
    record.book.save(update_fields=["available_copies"])

    message = f"You returned '{record.book.title}'."

    if record.fine > 0:
        message += (
            f" Your overdue fine is ETB {record.fine}. "
            "Please visit the Fines section to review payment options."
        )

    Notification.objects.create(
        user=user,
        type="return_confirmation",
        title="Book Returned",
        message=message,
        data={
            "borrow_id": record.id,
            "book_id": record.book.id,
            "fine": str(record.fine),
            "currency": "ETB",
        },
    )

    return record


@transaction.atomic
def mark_overdue_records():
    """
    Mark overdue borrowing records and update their overdue fines.

    Safe to run repeatedly:
    - Does not create duplicate overdue notifications.
    - Recalculates the current overdue amount.
    - Updates the existing overdue notification with current details.
    """

    today = timezone.localdate()

    overdue_records = (
        BorrowRecord.objects.filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ],
            due_date__lt=today,
        )
        .select_related("user", "book")
    )

    count = 0

    for record in overdue_records:
        days_late = (today - record.due_date).days

        fine_amount = calculate_overdue_fine(
            record.due_date,
            today,
        )

        record.status = BorrowRecord.Status.OVERDUE
        record.fine = fine_amount

        record.save(update_fields=["status", "fine"])

        notification, created = Notification.objects.get_or_create(
            user=record.user,
            type="overdue",
            data__borrow_id=record.id,
            defaults={
                "title": "Book Overdue",
                "message": (
                    f"Your borrowed book '{record.book.title}' "
                    f"is {days_late} days overdue. "
                    f"Current fine: ETB {fine_amount}. "
                    "Please return the book and review your fine."
                ),
                "data": {
                    "borrow_id": record.id,
                    "book_id": record.book.id,
                    "days_overdue": days_late,
                    "fine": str(fine_amount),
                    "currency": "ETB",
                    "reason": "overdue",
                },
            },
        )

        if not created:
            notification.title = "Book Overdue"
            notification.message = (
                f"Your borrowed book '{record.book.title}' "
                f"is {days_late} days overdue. "
                f"Current fine: ETB {fine_amount}. "
                "Please return the book and review your fine."
            )

            notification.data = {
                "borrow_id": record.id,
                "book_id": record.book.id,
                "days_overdue": days_late,
                "fine": str(fine_amount),
                "currency": "ETB",
                "reason": "overdue",
            }

            notification.save(
                update_fields=["title", "message", "data"]
            )

        count += 1

    return count
