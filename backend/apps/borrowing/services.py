
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.books.models import Book
from apps.notifications.models import Notification
from apps.fines.models import Fine

from .models import BorrowRecord


# ==========================================
# NOTIFICATION HELPER
# ==========================================

def _notify(user, title, message):
    if user:
        Notification.objects.create(
            user=user,
            type="system",
            title=title,
            message=message,
        )


# ==========================================
# STUDENT: REQUEST A BOOK
# ==========================================

@transaction.atomic
def issue_book(user, book_id):

    if not user.is_approved_member():
        raise ValueError(
            "Your account is not approved to borrow books."
        )

    if not user.can_borrow():
         raise ValueError(
        "You have reached your borrowing limit."
    )
    try:
        book = Book.objects.select_for_update().get(id=book_id)
    except Book.DoesNotExist:
        raise ValueError("Book not found.")

    if book.available_copies <= 0:
        raise ValueError("No copies available.")

    active_statuses = [
        BorrowRecord.Status.PENDING,
        BorrowRecord.Status.ISSUED,
        BorrowRecord.Status.OVERDUE,
        BorrowRecord.Status.RETURN_REQUESTED,
        BorrowRecord.Status.AWAITING_PAYMENT,
        BorrowRecord.Status.READY_TO_RETURN,
    ]

    existing = BorrowRecord.objects.filter(
        user=user,
        book=book,
        status__in=active_statuses,
    ).exists()

    if existing:
        raise ValueError(
            "You already have an active request or borrowing for this book."
        )

    record = BorrowRecord.objects.create(
        user=user,
        book=book,
        due_date=date.today() + timedelta(
            days=settings.BORROW_DAYS
        ),
        status=BorrowRecord.Status.PENDING,
    )

    # Available copies are decreased only after librarian approval.

    _notify(
        user,
        "Borrowing Request Submitted",
        f"Your request for '{book.title}' is waiting for librarian approval.",
    )

    return record


# ==========================================
# LIBRARIAN: APPROVE BORROW REQUEST
# ==========================================

@transaction.atomic
def approve_borrow(record_id, librarian):

    record = BorrowRecord.objects.select_for_update().get(
        id=record_id
    )

    if record.status != BorrowRecord.Status.PENDING:
        raise ValueError(
            "Only pending requests can be approved."
        )

    if not record.user.is_approved_member():
        raise ValueError(
            "This student's account is not approved."
        )

    if (
        record.user.get_active_borrowings_count()
        >= record.user.max_books_allowed
    ):
         raise ValueError(
            "This student has reached their borrowing limit."
        )

    book = Book.objects.select_for_update().get(
        id=record.book_id
    )

    if book.available_copies <= 0:
        raise ValueError(
            "No available copies. Cannot approve this request."
        )

    book.available_copies -= 1
    book.save(update_fields=["available_copies"])

    today = date.today()

    record.status = BorrowRecord.Status.ISSUED
    record.issue_date = today
    record.due_date = today + timedelta(
        days=settings.BORROW_DAYS
    )

    record.save(
        update_fields=[
            "status",
            "issue_date",
            "due_date",
        ]
    )

    _notify(
        record.user,
        "Borrowing Request Approved",
        f"Your request for '{book.title}' was approved. Due date: {record.due_date}.",
    )

    return record


# ==========================================
# LIBRARIAN: REJECT BORROW REQUEST
# ==========================================

@transaction.atomic
def reject_borrow(record_id, librarian):

    record = BorrowRecord.objects.select_for_update().get(
        id=record_id
    )

    if record.status != BorrowRecord.Status.PENDING:
        raise ValueError(
            "Only pending requests can be rejected."
        )

    record.status = BorrowRecord.Status.REJECTED
    record.save(update_fields=["status"])

    _notify(
        record.user,
        "Borrowing Request Rejected",
        f"Your request for '{record.book.title}' was rejected by the librarian.",
    )

    return record


# ==========================================
# STUDENT: REQUEST BOOK RETURN
# ==========================================

@transaction.atomic
def request_return(user, record_id):

    record = BorrowRecord.objects.select_for_update().get(
        id=record_id,
        user=user,
    )

    allowed_statuses = [
        BorrowRecord.Status.ISSUED,
        BorrowRecord.Status.OVERDUE,
    ]

    if record.status not in allowed_statuses:
        raise ValueError(
            "Only issued or overdue books can be returned."
        )

    record.status = BorrowRecord.Status.RETURN_REQUESTED
    record.return_requested_at = timezone.now()

    record.save(
        update_fields=[
            "status",
            "return_requested_at",
        ]
    )

    _notify(
        user,
        "Return Request Submitted",
        f"Your return request for '{record.book.title}' was sent to the librarian.",
    )

    return record


# ==========================================
# LIBRARIAN: INSPECT RETURNED BOOK
# ==========================================

@transaction.atomic
def inspect_return(
    record_id,
    librarian,
    damage_status="none",
    damage_notes="",
    damage_fine="0",
):

    record = BorrowRecord.objects.select_for_update().get(
        id=record_id
    )

    if record.status != BorrowRecord.Status.RETURN_REQUESTED:
        raise ValueError(
            "Only requested returns can be inspected."
        )

    if damage_status not in BorrowRecord.DamageStatus.values:
        raise ValueError("Invalid damage condition.")

    try:
        damage_amount = Decimal(str(damage_fine))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(
            "Damage fine must be a valid amount."
        )

    if not damage_amount.is_finite() or damage_amount < 0:
        raise ValueError(
            "Damage fine must be a non-negative valid amount."
        )

    today = date.today()

    overdue_days = max(
        (today - record.due_date).days,
        0,
    )

    overdue_amount = (
        Decimal(overdue_days)
        * Decimal(str(settings.FINE_PER_DAY))
    )

    total_fine = overdue_amount + damage_amount

    record.damage_status = damage_status
    record.damage_notes = damage_notes
    record.damage_fine = damage_amount
    record.fine = total_fine
    record.inspected_at = timezone.now()

    if total_fine > 0:
        record.status = BorrowRecord.Status.AWAITING_PAYMENT
    else:
        record.status = BorrowRecord.Status.READY_TO_RETURN

    record.save(
        update_fields=[
            "damage_status",
            "damage_notes",
            "damage_fine",
            "fine",
            "inspected_at",
            "status",
        ]
    )

    # No payment is required when the total fine is zero.

    fine_status = (
        Fine.Status.UNPAID
        if total_fine > 0
        else Fine.Status.PAID
    )

    fine_defaults = {
        "amount": total_fine,
        "status": fine_status,
    }

    if total_fine == 0:
        fine_defaults.update({
            "paid_at": timezone.now(),
            "verified_by": librarian,
        })

    Fine.objects.update_or_create(
        borrow_record=record,
        defaults=fine_defaults,
    )

    _notify(
        record.user,
        "Return Inspection Completed",
        f"Inspection completed for '{record.book.title}'. Total fine: ETB {total_fine}.",
    )

    return record


# ==========================================
# LIBRARIAN: VERIFY FINE PAYMENT
# ==========================================

@transaction.atomic
def verify_fine_payment(
    record_id,
    librarian,
    transaction_reference="",
):

    record = BorrowRecord.objects.select_for_update().get(
        id=record_id
    )

    if record.status != BorrowRecord.Status.AWAITING_PAYMENT:
        raise ValueError(
            "This borrowing record is not awaiting payment."
        )

    fine = Fine.objects.select_for_update().get(
        borrow_record=record
    )

    if fine.status == Fine.Status.PAID:
        raise ValueError(
            "This fine has already been paid."
        )

    fine.status = Fine.Status.PAID
    fine.transaction_reference = transaction_reference
    fine.verified_by = librarian
    fine.paid_at = timezone.now()

    fine.save()

    record.status = BorrowRecord.Status.READY_TO_RETURN
    record.save(update_fields=["status"])

    _notify(
        record.user,
        "Fine Payment Verified",
        f"Your payment of ETB {fine.amount} was verified. Please complete the return with the librarian.",
    )

    return record


# ==========================================
# LIBRARIAN: FINALIZE BOOK RETURN
# ==========================================

@transaction.atomic
def finalize_return(record_id, librarian):

    record = (
        BorrowRecord.objects
        .select_for_update()
        .select_related("book", "user")
        .get(id=record_id)
    )

    if record.status != BorrowRecord.Status.READY_TO_RETURN:
        raise ValueError(
            "Complete inspection and any required payment before finalizing the return."
        )

    if record.fine > 0:

        paid = Fine.objects.filter(
            borrow_record=record,
            status=Fine.Status.PAID,
        ).exists()

        if not paid:
            raise ValueError(
                "The fine must be paid and verified before finalizing the return."
            )

    record.status = BorrowRecord.Status.RETURNED
    record.return_date = date.today()
    record.return_confirmed_by = librarian

    record.save(
        update_fields=[
            "status",
            "return_date",
            "return_confirmed_by",
        ]
    )

    # A lost book must not be added back to available inventory.

    if record.damage_status != BorrowRecord.DamageStatus.LOST:
        record.book.available_copies += 1
        record.book.save(
            update_fields=["available_copies"]
        )

    _notify(
        record.user,
        "Book Return Confirmed",
        f"The return of '{record.book.title}' has been finalized.",
    )

    return record


# ==========================================
# SYSTEM: MARK OVERDUE BORROWINGS
# ==========================================

@transaction.atomic
def mark_overdue_records():

    today = date.today()

    overdue_records = BorrowRecord.objects.filter(
        status=BorrowRecord.Status.ISSUED,
        due_date__lt=today,
    )

    count = 0

    for record in overdue_records:

        days_late = (today - record.due_date).days

        record.status = BorrowRecord.Status.OVERDUE

        record.fine = (
            Decimal(days_late)
            * Decimal(str(settings.FINE_PER_DAY))
        )

        record.save(
            update_fields=[
                "status",
                "fine",
            ]
        )

        count += 1

    return count
