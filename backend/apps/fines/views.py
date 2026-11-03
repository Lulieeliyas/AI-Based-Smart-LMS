
from .models import (
    Fine,
    FineReport,
    FineExtensionRequest,
)

from .serializers import (
    FineReportSerializer,
    FineExtensionRequestSerializer,
)

from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.services import NotificationService

from .permissions import (
    IsFineUser,
    CanSubmitFineReport,
    IsLibrarian,
)


class FineReportListCreateView(APIView):
    """
    GET:
        Librarians see all reports.
        Other authorized users see only reports involving themselves.

    POST:
        Authorized users submit reports.
        Non-librarians can report only their own borrowing records.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), CanSubmitFineReport()]

        return [IsAuthenticated(), IsFineUser()]

    def get_queryset(self):
        user = self.request.user

        queryset = FineReport.objects.select_related(
            "reported_by",
            "subject_user",
            "borrow_record",
            "reviewed_by",
            "generated_fine",
        )

        if user.role == "librarian":
            return queryset

        return queryset.filter(
            subject_user=user
        ) | queryset.filter(
            reported_by=user
        )

    def get(self, request):
        reports = self.get_queryset().distinct()

        serializer = FineReportSerializer(
            reports,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = FineReportSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)

        report = serializer.save()

        # Notify all active librarians about the new report.
        NotificationService.notify_roles(
            roles=["librarian"],
            type="damage_report",
            title="New Fine Report Submitted",
            message=(
                f"{request.user.username} submitted a "
                f"{report.get_reason_display().lower()} report. "
                "Please review the report."
            ),
            data={
                "report_id": report.pk,
                "reported_by": str(request.user.pk),
                "subject_user": str(report.subject_user_id),
                "borrow_record": (
                    report.borrow_record_id
                    if report.borrow_record_id
                    else None
                ),
                "reason": report.reason,
            },
        )

        return Response(
            FineReportSerializer(
                report,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class FineReportReviewView(APIView):
    """
    Only librarians can approve or reject fine reports.

    APPROVE:
        Requires approved_amount and librarian_response.
        Creates a payable Fine.

    REJECT:
        Requires librarian_response.
        Does not create a Fine.
    """

    permission_classes = [IsAuthenticated, IsLibrarian]

    def post(self, request, pk):
        decision = request.data.get("decision", "").strip().lower()
        response_text = request.data.get(
            "librarian_response", ""
        ).strip()

        if decision not in ["approved", "rejected"]:
            return Response(
                {
                    "detail": (
                        "Decision must be either 'approved' or 'rejected'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not response_text:
            return Response(
                {
                    "detail": (
                        "Please provide an explanation for your decision."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        approved_amount = None

        if decision == "approved":
            try:
                approved_amount = Decimal(
                    str(request.data.get("approved_amount", ""))
                )
            except Exception:
                return Response(
                    {
                        "detail": (
                            "A valid approved_amount is required."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not approved_amount.is_finite() or approved_amount <= 0:
                return Response(
                    {
                        "detail": (
                            "The approved amount must be greater than zero."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            report = get_object_or_404(
                FineReport.objects.select_for_update().select_related(
                    "subject_user",
                    "borrow_record",
                ),
                pk=pk,
            )

            if report.status != FineReport.Status.PENDING:
                return Response(
                    {
                        "detail": (
                            "This report has already been reviewed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            affected_user = report.subject_user

            if affected_user is None:
                return Response(
                    {
                        "detail": (
                            "This report has no affected user. "
                            "The report must identify a borrower."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            report.status = decision
            report.librarian_response = response_text
            report.reviewed_by = request.user
            report.reviewed_at = timezone.now()

            if decision == "approved":
                report.approved_amount = approved_amount

                # Create the payable fine only after approval.
                fine = Fine.objects.create(
                    user=affected_user,
                    borrow_record=report.borrow_record,
                    reason=report.reason,
                    description=(
                        f"{report.description}\n\n"
                        f"Librarian decision: {response_text}"
                    ),
                    amount=approved_amount,
                    paid_amount=Decimal("0.00"),
                    status=Fine.Status.UNPAID,
                )

                report.generated_fine = fine

            report.save()

            # Notify the affected borrower about the decision.
            if decision == "approved":
                notification_message = (
                    f"Your {report.get_reason_display().lower()} "
                    f"report has been approved. "
                    f"An amount of ETB {approved_amount} "
                    "has been added to your fines. "
                    f"Librarian explanation: {response_text}"
                )
            else:
                notification_message = (
                    f"Your {report.get_reason_display().lower()} "
                    "report has been rejected. "
                    f"Librarian explanation: {response_text}"
                )

            NotificationService.create_notification(
                user=affected_user,
                type="fine_update",
                title=(
                    "Fine Report Approved"
                    if decision == "approved"
                    else "Fine Report Rejected"
                ),
                message=notification_message,
                data={
                    "report_id": report.pk,
                    "decision": decision,
                    "fine_id": (
                        report.generated_fine_id
                        if decision == "approved"
                        else None
                    ),
                    "approved_amount": (
                        str(approved_amount)
                        if approved_amount is not None
                        else None
                    ),
                },
            )

        return Response(
            {
                "message": (
                    "Fine report approved successfully."
                    if decision == "approved"
                    else "Fine report rejected successfully."
                ),
                "report": FineReportSerializer(
                    report,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class FineExtensionRequestListCreateView(APIView):
    """
    GET:
        Librarians see all extension requests.
        Other authorized users see only their own requests.

    POST:
        Authorized users submit extension requests for their own fines.
        New requests notify active librarians.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsFineUser()]

        return [IsAuthenticated(), IsFineUser()]

    def get_queryset(self):
        user = self.request.user

        queryset = FineExtensionRequest.objects.select_related(
            "fine",
            "requested_by",
            "reviewed_by",
        )

        if user.role == "librarian":
            return queryset

        return queryset.filter(requested_by=user)

    def get(self, request):
        requests = self.get_queryset()

        serializer = FineExtensionRequestSerializer(
            requests,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = FineExtensionRequestSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        fine = serializer.validated_data["fine"]

        # Lock the fine row so simultaneous requests for this fine
        # are processed one at a time.
        with transaction.atomic():
            locked_fine = Fine.objects.select_for_update().get(
                pk=fine.pk
            )

            if FineExtensionRequest.objects.filter(
                fine=locked_fine,
                status=FineExtensionRequest.Status.PENDING,
            ).exists():
                return Response(
                    {
                        "detail": (
                            "There is already a pending extension "
                            "request for this fine."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            extension_request = serializer.save()

        # Notify librarians after the database transaction succeeds.
        NotificationService.notify_roles(
            roles=["librarian"],
            type="fine_extension_request",
            title="New Fine Extension Request",
            message=(
                f"{request.user.username} requested an extension "
                f"for fine #{locked_fine.pk}. "
                f"Requested payment deadline: "
                f"{extension_request.requested_until}."
            ),
            data={
                "extension_request_id": extension_request.pk,
                "fine_id": locked_fine.pk,
                "requester_id": str(request.user.pk),
                "requester_username": request.user.username,
                "requested_until": str(
                    extension_request.requested_until
                ),
            },
        )

        return Response(
            {
                "message": (
                    "Your extension request was submitted "
                    "successfully."
                ),
                "request": FineExtensionRequestSerializer(
                    extension_request,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class FineExtensionRequestReviewView(APIView):
    """
    Only librarians can approve or reject extension requests.

    Approval changes the fine payment deadline only.
    It does not change the fine amount or payment balance.
    """

    permission_classes = [IsAuthenticated, IsLibrarian]

    def post(self, request, pk):
        decision = str(
            request.data.get("decision", "")
        ).strip().lower()

        decision_note = str(
            request.data.get("decision_note", "")
        ).strip()

        if decision not in ["approved", "rejected"]:
            return Response(
                {
                    "detail": (
                        "Decision must be 'approved' or 'rejected'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not decision_note:
            return Response(
                {
                    "detail": (
                        "Please provide an explanation for your decision."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        approved_until = None

        if decision == "approved":
            requested_date = request.data.get("approved_until")

            if requested_date:
                from django.utils.dateparse import parse_date

                approved_until = parse_date(str(requested_date))

                if approved_until is None:
                    return Response(
                        {
                            "detail": (
                                "approved_until must be a valid date "
                                "in YYYY-MM-DD format."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            with transaction.atomic():
                extension_request = get_object_or_404(
                    FineExtensionRequest.objects.select_for_update()
                    .select_related("fine", "requested_by"),
                    pk=pk,
                )

                if (
                    extension_request.status
                    != FineExtensionRequest.Status.PENDING
                ):
                    return Response(
                        {
                            "detail": (
                                "This extension request has already "
                                "been reviewed."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                fine = Fine.objects.select_for_update().get(
                    pk=extension_request.fine_id
                )

                if fine.outstanding_balance <= Decimal("0.00"):
                    return Response(
                        {
                            "detail": (
                                "This fine has no outstanding balance."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                final_date = approved_until or extension_request.requested_until

                if final_date <= timezone.localdate():
                    return Response(
                        {
                            "detail": (
                                "The approved deadline must be later "
                                "than today."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                extension_request.status = (
                    FineExtensionRequest.Status.APPROVED
                )
                extension_request.approved_until = final_date
                extension_request.decision_note = decision_note
                extension_request.reviewed_by = request.user
                extension_request.reviewed_at = timezone.now()
                extension_request.save()

                # Extend only the payment deadline.
                fine.payment_due_date = final_date
                fine.save(update_fields=["payment_due_date", "updated_at"])

                NotificationService.create_notification(
                    user=extension_request.requested_by,
                    type="fine_extension_update",
                    title="Fine Extension Approved",
                    message=(
                        f"Your extension request for fine #{fine.pk} "
                        f"has been approved. Your new payment deadline "
                        f"is {final_date}. "
                        f"Librarian explanation: {decision_note}"
                    ),
                    data={
                        "extension_request_id": extension_request.pk,
                        "fine_id": fine.pk,
                        "decision": "approved",
                        "approved_until": str(final_date),
                        "decision_note": decision_note,
                    },
                )

        else:
            with transaction.atomic():
                extension_request = get_object_or_404(
                    FineExtensionRequest.objects.select_for_update()
                    .select_related("fine", "requested_by"),
                    pk=pk,
                )

                if (
                    extension_request.status
                    != FineExtensionRequest.Status.PENDING
                ):
                    return Response(
                        {
                            "detail": (
                                "This extension request has already "
                                "been reviewed."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                extension_request.status = (
                    FineExtensionRequest.Status.REJECTED
                )
                extension_request.decision_note = decision_note
                extension_request.reviewed_by = request.user
                extension_request.reviewed_at = timezone.now()
                extension_request.save()

                NotificationService.create_notification(
                    user=extension_request.requested_by,
                    type="fine_extension_update",
                    title="Fine Extension Rejected",
                    message=(
                        f"Your extension request for fine "
                        f"#{extension_request.fine_id} has been rejected. "
                        f"Librarian explanation: {decision_note}"
                    ),
                    data={
                        "extension_request_id": extension_request.pk,
                        "fine_id": extension_request.fine_id,
                        "decision": "rejected",
                        "decision_note": decision_note,
                    },
                )

        return Response(
            {
                "message": (
                    "Extension request "
                    f"{decision} successfully."
                ),
                "request": FineExtensionRequestSerializer(
                    extension_request,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )
