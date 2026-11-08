
from django.db.models import Q, Count
from django.utils import timezone

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import BorrowRecord
from .serializers import BorrowRecordSerializer
from .services import issue_book, return_book


class BorrowViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = BorrowRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = BorrowRecord.objects.select_related(
            "user",
            "book",
            "book__category",
        )

        if user.role in (
            "librarian",
            "admin",
            "digital_officer",
        ):
            return queryset

        return queryset.filter(user=user)

    def staff_only(self, request):
        if request.user.role not in (
            "librarian",
            "admin",
            "digital_officer",
        ):
            return Response(
                {
                    "detail": (
                        "You do not have permission to access "
                        "all borrowing records."
                    )
                },
                status=403,
            )

        return None

    # ------------------------------------------------
    # CHECK BORROWING ELIGIBILITY
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="can-borrow",
    )
    def can_borrow(self, request):

        user = request.user

        approved = user.is_approved_member()
        within_limit = user.can_borrow()

        if not approved:
            message = (
                "Your account must be active, email-verified, "
                "and have an eligible role to borrow books."
            )
        elif not within_limit:
            message = "You have reached your borrowing limit."
        else:
            message = "You are eligible to borrow books."

        return Response({
            "can_borrow": approved and within_limit,
            "is_approved_member": approved,
            "active_borrowings_count": (
                user.get_active_borrowings_count()
            ),
            "max_books_allowed": user.max_books_allowed,
            "message": message,
        })

    # ------------------------------------------------
    # ISSUE A BOOK
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["post"],
        url_path="issue",
    )
    def issue(self, request):

        book_id = request.data.get("book_id")

        if book_id is None:
            return Response(
                {"detail": "book_id is required."},
                status=400,
            )

        try:
            rec = issue_book(
                request.user,
                int(book_id),
            )

        except (ValueError, TypeError):
            return Response(
                {"detail": "book_id must be an integer."},
                status=400,
            )

        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            BorrowRecordSerializer(rec).data,
            status=201,
        )

    # ------------------------------------------------
    # RETURN A BOOK
    # ------------------------------------------------

    @action(
        detail=True,
        methods=["post"],
        url_path="return",
    )
    def return_book(self, request, pk=None):

        try:
            rec = return_book(
                request.user,
                int(pk),
            )

        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid borrow id."},
                status=400,
            )

        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            BorrowRecordSerializer(rec).data
        )

    # ------------------------------------------------
    # ALL BORROWINGS - ADMIN / LIBRARIAN
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="all",
    )
    def all_borrowings(self, request):

        denied = self.staff_only(request)

        if denied:
            return denied

        records = self.get_queryset()

        serializer = self.get_serializer(
            records,
            many=True,
        )

        return Response(serializer.data)

    # ------------------------------------------------
    # ACTIVE BORROWINGS
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="active",
    )
    def active_borrowings(self, request):

        denied = self.staff_only(request)

        if denied:
            return denied

        records = self.get_queryset().filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ]
        )

        serializer = self.get_serializer(
            records,
            many=True,
        )

        return Response(serializer.data)

    # ------------------------------------------------
    # OVERDUE BORROWINGS
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="overdue",
    )
    def overdue_borrowings(self, request):

        denied = self.staff_only(request)

        if denied:
            return denied

        today = timezone.localdate()

        records = self.get_queryset().filter(
            Q(status=BorrowRecord.Status.OVERDUE)
            | Q(
                status=BorrowRecord.Status.ISSUED,
                due_date__lt=today,
            )
        )

        serializer = self.get_serializer(
            records,
            many=True,
        )

        return Response(serializer.data)

    # ------------------------------------------------
    # BORROWING STATISTICS
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="statistics",
    )
    def statistics(self, request):

        denied = self.staff_only(request)

        if denied:
            return denied

        today = timezone.localdate()

        records = self.get_queryset()

        active = records.filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ]
        ).count()

        overdue = records.filter(
            Q(status=BorrowRecord.Status.OVERDUE)
            | Q(
                status=BorrowRecord.Status.ISSUED,
                due_date__lt=today,
            )
        ).count()

        returned = records.filter(
            status=BorrowRecord.Status.RETURNED
        ).count()

        return Response({
            "total_borrowings": records.count(),
            "active_borrowings": active,
            "overdue_borrowings": overdue,
            "returned_borrowings": returned,
        })

    # ------------------------------------------------
    # PERSONAL BORROWING STATISTICS
    # ------------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="my-statistics",
    )
    def my_statistics(self, request):

        records = BorrowRecord.objects.filter(
            user=request.user
        )

        today = timezone.localdate()

        active = records.filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ]
        ).count()

        overdue = records.filter(
            Q(status=BorrowRecord.Status.OVERDUE)
            | Q(
                status=BorrowRecord.Status.ISSUED,
                due_date__lt=today,
            )
        ).count()

        returned = records.filter(
            status=BorrowRecord.Status.RETURNED
        ).count()

        return Response({
            "total_borrowings": records.count(),
            "active_borrowings": active,
            "overdue_borrowings": overdue,
            "returned_borrowings": returned,
        })
