
from datetime import date

from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import BorrowRecord
from .serializers import BorrowRecordSerializer
from .services import (
    issue_book,
    approve_borrow,
    reject_borrow,
    request_return,
    inspect_return,
    verify_fine_payment,
    finalize_return,
)


class IsLibrarianOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (
                "librarian",
                "admin",
                "digital_officer",
            )
        )


class BorrowViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BorrowRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        qs = BorrowRecord.objects.select_related(
            "user",
            "book",
            "return_confirmed_by",
        )

        if user.role in ("librarian", "admin", "digital_officer"):
            return qs.all()

        return qs.filter(user=user)

    # -----------------------------------------
    # STUDENT: CHECK BORROWING ELIGIBILITY
    # -----------------------------------------

    @action(detail=False, methods=["get"], url_path="can-borrow")
    def can_borrow(self, request):
        user = request.user

        approved = user.is_approved_member()
        within_limit = user.can_borrow()

        return Response({
            "can_borrow": approved and within_limit,
            "is_approved_member": approved,
            "active_borrowings_count": user.get_active_borrowings_count(),
            "max_books_allowed": user.max_books_allowed,
            "message": (
                "You are eligible to borrow books."
                if approved and within_limit
                else "Your account is not currently eligible to borrow."
            ),
        })

    # -----------------------------------------
    # STUDENT: SUBMIT BORROWING REQUEST
    # -----------------------------------------

    @action(detail=False, methods=["post"], url_path="issue")
    def issue(self, request):
        book_id = request.data.get("book_id")

        if book_id is None:
            return Response(
                {"detail": "book_id is required."},
                status=400,
            )

        try:
            record = issue_book(request.user, int(book_id))
        except (ValueError, TypeError) as exc:
            return Response({"detail": str(exc)}, status=400)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response(
            self.get_serializer(record).data,
            status=201,
        )

    # -----------------------------------------
    # LIBRARIAN: VIEW PENDING BORROW REQUESTS
    # -----------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="pending-requests",
    )
    def pending_requests(self, request):
        qs = self.get_queryset().filter(
            status=BorrowRecord.Status.PENDING
        ).order_by("issue_date")

        return Response(
            self.get_serializer(qs, many=True).data
        )

    # -----------------------------------------
    # LIBRARIAN: APPROVE BORROW REQUEST
    # -----------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="approve",
    )
    def approve_request(self, request, pk=None):
        try:
            record = approve_borrow(pk, request.user)
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            self.get_serializer(record).data
        )

    # -----------------------------------------
    # LIBRARIAN: REJECT BORROW REQUEST
    # -----------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="reject",
    )
    def reject_request(self, request, pk=None):
        try:
            record = reject_borrow(pk, request.user)
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            self.get_serializer(record).data
        )

    # -----------------------------------------
    # STUDENT: REQUEST BOOK RETURN
    # -----------------------------------------

    @action(
        detail=True,
        methods=["post"],
        url_path="return",
    )
    def return_book(self, request, pk=None):
        try:
            record = request_return(
                request.user,
                int(pk),
            )
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            self.get_serializer(record).data
        )

    # -----------------------------------------
    # LIBRARIAN: VIEW RETURN REQUESTS
    # -----------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="return-requests",
    )
    def return_requests(self, request):
        qs = self.get_queryset().filter(
            status=BorrowRecord.Status.RETURN_REQUESTED
        )

        return Response(
            self.get_serializer(qs, many=True).data
        )

    # -----------------------------------------
    # LIBRARIAN: INSPECT RETURNED BOOK
    # -----------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="inspect-return",
    )
    def inspect_return_action(self, request, pk=None):
        try:
            record = inspect_return(
                pk,
                request.user,
                request.data.get("damage_status", "none"),
                request.data.get("damage_notes", ""),
                request.data.get("damage_fine", "0"),
            )
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            self.get_serializer(record).data
        )

    # -----------------------------------------
    # LIBRARIAN: VERIFY FINE PAYMENT
    # -----------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="verify-payment",
    )
    def verify_payment_action(self, request, pk=None):
        try:
            record = verify_fine_payment(
                pk,
                request.user,
                request.data.get("transaction_reference", ""),
            )
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            self.get_serializer(record).data
        )

    # -----------------------------------------
    # LIBRARIAN: FINALIZE BOOK RETURN
    # -----------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsLibrarianOrAdmin],
        url_path="finalize-return",
    )
    def finalize_return_action(self, request, pk=None):
        try:
            record = finalize_return(
                pk,
                request.user,
            )
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            self.get_serializer(record).data
        )

    # -----------------------------------------
    # LIBRARIAN: BORROWING STATISTICS
    # -----------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsLibrarianOrAdmin],
    )
    def statistics(self, request):
        qs = BorrowRecord.objects.all()
        today = date.today()

        return Response({
            "total_borrowings": qs.count(),

            "pending_requests": qs.filter(
                status=BorrowRecord.Status.PENDING
            ).count(),

            "active_borrowings": qs.filter(
                status__in=[
                    BorrowRecord.Status.ISSUED,
                    BorrowRecord.Status.OVERDUE,
                ]
            ).count(),

            "overdue_borrowings": qs.filter(
                Q(status=BorrowRecord.Status.OVERDUE)
                | Q(
                    status=BorrowRecord.Status.ISSUED,
                    due_date__lt=today,
                )
            ).count(),

            "returned_borrowings": qs.filter(
                status=BorrowRecord.Status.RETURNED
            ).count(),

            "return_requests": qs.filter(
                status=BorrowRecord.Status.RETURN_REQUESTED
            ).count(),

            "student_borrowings": qs.filter(
                user__role="student"
            ).count(),

            "staff_borrowings": qs.filter(
                user__role="academic_staff"
            ).count(),

            "recent_borrowings": qs.filter(
                issue_date__gte=today.replace(day=1)
            ).count(),
        })

    # -----------------------------------------
    # LIBRARIAN: ALL BORROWING RECORDS
    # -----------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsLibrarianOrAdmin],
    )
    def all(self, request):
        return Response(
            self.get_serializer(
                self.get_queryset(),
                many=True,
            ).data
        )

    # -----------------------------------------
    # LIBRARIAN: ACTIVE BORROWINGS
    # -----------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsLibrarianOrAdmin],
    )
    def active(self, request):
        qs = self.get_queryset().filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ]
        )

        return Response(
            self.get_serializer(qs, many=True).data
        )

    # -----------------------------------------
    # LIBRARIAN: OVERDUE BORROWINGS
    # -----------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsLibrarianOrAdmin],
    )
    def overdue(self, request):
        qs = self.get_queryset().filter(
            Q(status=BorrowRecord.Status.OVERDUE)
            | Q(
                status=BorrowRecord.Status.ISSUED,
                due_date__lt=date.today(),
            )
        )

        return Response(
            self.get_serializer(qs, many=True).data
        )
