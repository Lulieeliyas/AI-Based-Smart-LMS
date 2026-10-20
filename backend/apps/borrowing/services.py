from datetime import date, timedelta
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from apps.books.models import Book
from apps.notifications.models import Notification
from .models import BorrowRecord


@transaction.atomic
def issue_book(user, book_id):
    if not user.is_approved_member():
        raise ValueError("Your account is not approved to borrow books.")

    book = Book.objects.select_for_update().get(id=book_id)

    if book.available_copies <= 0:
        raise ValueError("No copies available.")

    if BorrowRecord.objects.filter(
        user=user, book=book, status=BorrowRecord.Status.ISSUED
    ).exists():
        raise ValueError("You already have this book.")

    record = BorrowRecord.objects.create(
        user=user, book=book,
        due_date=date.today() + timedelta(days=settings.BORROW_DAYS),
    )
    book.available_copies -= 1
    book.save(update_fields=["available_copies"])

    Notification.objects.create(
        user=user,
        title="Book Borrowed",
        message=f"You borrowed '{book.title}'. Due on {record.due_date}.",
    )
    return record


@transaction.atomic
def return_book(user, record_id):
    record = BorrowRecord.objects.select_for_update().get(id=record_id, user=user)
    if record.status == BorrowRecord.Status.RETURNED:
        raise ValueError("Already returned.")

    today = date.today()
    record.return_date = today
    record.status = BorrowRecord.Status.RETURNED

    if today > record.due_date:
        days_late = (today - record.due_date).days
        record.fine = Decimal(days_late * settings.FINE_PER_DAY)

    record.save()
    record.book.available_copies += 1
    record.book.save(update_fields=["available_copies"])

    msg = f"You returned '{record.book.title}'."
    if record.fine > 0:
        msg += f" Fine: ETB {record.fine}."
    Notification.objects.create(user=user, title="Book Returned", message=msg)
    return record


def mark_overdue_records():
    today = date.today()
    overdue = BorrowRecord.objects.filter(
        status=BorrowRecord.Status.ISSUED,
        due_date__lt=today,
    )
    count = 0
    for record in overdue:
        record.status = BorrowRecord.Status.OVERDUE
        days_late = (today - record.due_date).days
        record.fine = Decimal(days_late * settings.FINE_PER_DAY)
        record.save(update_fields=["status", "fine"])
        count += 1
    return count
