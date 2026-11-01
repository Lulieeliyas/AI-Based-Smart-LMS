
from unittest.mock import Mock, patch

from django.test import TransactionTestCase

from apps.fines.models import (
    Fine,
    FineReport,
    FinePayment,
    FineExtensionRequest,
    )

from apps.fines.services.payments import (
    ChapaPaymentError,
    verify_fine_payment,
)

from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from apps.books.models import Book
from apps.borrowing.models import BorrowRecord
from apps.fines.models import Fine, FineReport
from apps.notifications.models import Notification


class FineReportAPITests(APITestCase):
    def setUp(self):
        self.student = self.create_user(
            "student1",
            "student1@example.com",
            "student",
        )

        self.other_student = self.create_user(
            "student2",
            "student2@example.com",
            "student",
        )

        self.librarian = self.create_user(
            "librarian1",
            "librarian1@example.com",
            "librarian",
        )

        self.academic_staff = self.create_user(
            "staff1",
            "staff1@example.com",
            "academic_staff",
        )

        self.digital_officer = self.create_user(
            "digital1",
            "digital1@example.com",
            "digital_officer",
        )

        self.admin = self.create_user(
            "admin1",
            "admin1@example.com",
            "admin",
        )

        self.book = Book.objects.create(
            title="Test Library Book",
            author="Test Author",
            isbn="TEST-FINE-001",
            total_copies=5,
            available_copies=5,
        )

        self.student_borrow = BorrowRecord.objects.create(
            user=self.student,
            book=self.book,
            due_date=timezone.localdate() + timedelta(days=14),
            status=BorrowRecord.Status.ISSUED,
        )

        self.other_student_borrow = BorrowRecord.objects.create(
            user=self.other_student,
            book=self.book,
            due_date=timezone.localdate() + timedelta(days=14),
            status=BorrowRecord.Status.ISSUED,
        )

        self.reports_url = reverse("fine-report-list-create")

    def create_user(self, username, email, role):
        return User.objects.create_user(
            username=username,
            email=email,
            password="TestPassword123!",
            role=role,
            is_active=True,
            is_email_verified=True,
        )

    def submit_report(self, user, borrow_record, reason="damaged"):
        self.client.force_authenticate(user=user)

        return self.client.post(
            self.reports_url,
            {
                "borrow_record": borrow_record.pk,
                "reason": reason,
                "description": "The book has damaged pages.",
            },
            format="json",
        )


    def review_report(self, report, decision, explanation, amount=None):
        self.client.force_authenticate(user=self.librarian)

        payload = {
            "decision": decision,
            "librarian_response": explanation,
        }

        if amount is not None:
            payload["approved_amount"] = str(amount)

        return self.client.post(
            reverse(
                "fine-report-review",
                kwargs={"pk": report.pk},
            ),
            payload,
            format="json",
        )


    # ---------------------------------------------------------
    # 1. REPORT SUBMISSION PERMISSIONS
    # ---------------------------------------------------------

    def test_student_can_submit_own_borrowing_report(self):
        response = self.submit_report(
            self.student,
            self.student_borrow,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        report = FineReport.objects.get(
            reported_by=self.student,
        )

        self.assertEqual(report.subject_user, self.student)
        self.assertEqual(report.borrow_record, self.student_borrow)
        self.assertEqual(report.status, "pending")

    def test_academic_staff_can_submit_own_borrowing_report(self):
        borrow = BorrowRecord.objects.create(
            user=self.academic_staff,
            book=self.book,
            due_date=timezone.localdate() + timedelta(days=30),
        )

        response = self.submit_report(
            self.academic_staff,
            borrow,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_digital_officer_can_submit_own_borrowing_report(self):
        borrow = BorrowRecord.objects.create(
            user=self.digital_officer,
            book=self.book,
            due_date=timezone.localdate() + timedelta(days=30),
        )

        response = self.submit_report(
            self.digital_officer,
            borrow,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_can_submit_own_borrowing_report(self):
        borrow = BorrowRecord.objects.create(
            user=self.admin,
            book=self.book,
            due_date=timezone.localdate() + timedelta(days=30),
        )

        response = self.submit_report(
            self.admin,
            borrow,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_user_cannot_report_without_borrowing_record(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            self.reports_url,
            {
                "reason": "damaged",
                "description": "My book is damaged.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(FineReport.objects.count(), 0)

    def test_user_cannot_report_another_users_borrowing_record(self):
        response = self.submit_report(
            self.student,
            self.other_student_borrow,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(FineReport.objects.count(), 0)

    def test_librarian_can_report_another_users_borrowing_record(self):
        self.client.force_authenticate(user=self.librarian)

        response = self.client.post(
            self.reports_url,
            {
                "borrow_record": self.other_student_borrow.pk,
                "reason": "damaged",
                "description": "Damage identified by librarian.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        report = FineReport.objects.get(
            reported_by=self.librarian,
        )

        self.assertEqual(report.subject_user, self.other_student)
        self.assertEqual(report.borrow_record, self.other_student_borrow)

    def test_librarian_can_report_without_borrowing_record(self):
        self.client.force_authenticate(user=self.librarian)

        response = self.client.post(
            self.reports_url,
            {
                "subject_user": str(self.other_student.pk),
                "reason": "other",
                "description": "An incident reported by the librarian.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        report = FineReport.objects.get(
            reported_by=self.librarian,
        )

        self.assertEqual(report.subject_user, self.other_student)
        self.assertIsNone(report.borrow_record)

    # ---------------------------------------------------------
    # 2. REPORT REVIEW PERMISSIONS
    # ---------------------------------------------------------

    def create_pending_report(self):
        return FineReport.objects.create(
            reported_by=self.student,
            subject_user=self.student,
            borrow_record=self.student_borrow,
            reason="damaged",
            description="Damaged book reported by student.",
            status="pending",
        )

    def test_only_librarian_can_review_report(self):
        report = self.create_pending_report()

        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse(
                "fine-report-review",
                kwargs={"pk": report.pk},
            ),
            {
                "decision": "approved",
                "explanation": "Damage confirmed.",
                "approved_amount": "100.00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        report.refresh_from_db()

        self.assertEqual(report.status, "pending")
        self.assertEqual(Fine.objects.count(), 0)

    def test_librarian_can_approve_report_and_create_fine(self):
        report = self.create_pending_report()

        response = self.review_report(
            report,
            "approved",
            "The damage was confirmed after inspection.",
            Decimal("150.00"),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        report.refresh_from_db()

        self.assertEqual(report.status, "approved")
        self.assertEqual(report.reviewed_by, self.librarian)
        self.assertEqual(report.approved_amount, Decimal("150.00"))

        fine = Fine.objects.get(
            user=self.student,
            reason="damaged",
        )

        self.assertEqual(fine.amount, Decimal("150.00"))
        self.assertEqual(fine.paid_amount, Decimal("0"))
        self.assertEqual(fine.status, "unpaid")

        self.assertEqual(report.generated_fine, fine)
        self.assertEqual(Fine.objects.count(), 1)

    def test_rejected_report_does_not_create_fine(self):
        report = self.create_pending_report()

        response = self.review_report(
            report,
            "rejected",
            "Inspection found no damage.",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        report.refresh_from_db()

        self.assertEqual(report.status, "rejected")
        self.assertEqual(report.reviewed_by, self.librarian)
        self.assertIsNone(report.generated_fine)

        self.assertEqual(Fine.objects.count(), 0)

    def test_already_reviewed_report_cannot_be_reviewed_again(self):
        report = self.create_pending_report()

        first_response = self.review_report(
            report,
            "approved",
            "Damage confirmed.",
            Decimal("100.00"),
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        second_response = self.review_report(
            report,
            "approved",
            "Trying to approve again.",
            Decimal("200.00"),
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(Fine.objects.count(), 1)

    def test_approved_report_requires_positive_amount(self):
        report = self.create_pending_report()

        response = self.review_report(
            report,
            "approved",
            "Damage confirmed.",
            Decimal("0.00"),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        report.refresh_from_db()

        self.assertEqual(report.status, "pending")
        self.assertEqual(Fine.objects.count(), 0)

    # ---------------------------------------------------------
    # 3. NOTIFICATIONS
    # ---------------------------------------------------------

    def test_new_report_notifies_librarians(self):
        response = self.submit_report(
            self.student,
            self.student_borrow,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.assertTrue(
            Notification.objects.filter(
                user=self.librarian,
                type="damage_report",
            ).exists()
        )

    def test_approved_report_notifies_affected_user(self):
        report = self.create_pending_report()

        response = self.review_report(
            report,
            "approved",
            "Damage confirmed.",
            Decimal("120.00"),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                type="fine_update",
            ).exists()
        )

    def test_rejected_report_notifies_affected_user(self):
        report = self.create_pending_report()

        response = self.review_report(
            report,
            "rejected",
            "The report was rejected after inspection.",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                type="fine_update",
            ).exists()
        )

    # ---------------------------------------------------------
    # 4. REPORT VISIBILITY
    # ---------------------------------------------------------

    def test_librarian_can_view_all_reports(self):
        FineReport.objects.create(
            reported_by=self.student,
            subject_user=self.student,
            borrow_record=self.student_borrow,
            reason="damaged",
            description="Student report.",
        )

        FineReport.objects.create(
            reported_by=self.other_student,
            subject_user=self.other_student,
            borrow_record=self.other_student_borrow,
            reason="lost",
            description="Another student report.",
        )

        self.client.force_authenticate(user=self.librarian)

        response = self.client.get(self.reports_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_student_can_view_only_own_reports(self):
        FineReport.objects.create(
            reported_by=self.student,
            subject_user=self.student,
            borrow_record=self.student_borrow,
            reason="damaged",
            description="My report.",
        )

        FineReport.objects.create(
            reported_by=self.other_student,
            subject_user=self.other_student,
            borrow_record=self.other_student_borrow,
            reason="lost",
            description="Another student's report.",
        )

        self.client.force_authenticate(user=self.student)

        response = self.client.get(self.reports_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        self.assertEqual(
            str(response.data[0]["subject_user"]),
            str(self.student.pk),
            )

# ---------------------------------------------------------
# FINE PAYMENT SERVICE TESTS
# ---------------------------------------------------------

class FinePaymentServiceTests(TransactionTestCase):

    def setUp(self):
        self.student = User.objects.create_user(
            username="payment_student",
            email="payment_student@example.com",
            password="TestPassword123!",
            role="student",
            is_active=True,
            is_email_verified=True,
        )

        self.other_student = User.objects.create_user(
            username="payment_other_student",
            email="payment_other@example.com",
            password="TestPassword123!",
            role="student",
            is_active=True,
            is_email_verified=True,
        )

        self.fine = Fine.objects.create(
            user=self.student,
            reason=Fine.Reason.DAMAGED,
            description="Damaged library book.",
            amount=Decimal("100.00"),
            paid_amount=Decimal("0.00"),
            status=Fine.Status.UNPAID,
        )

        self.payment = FinePayment.objects.create(
            fine=self.fine,
            user=self.student,
            amount=Decimal("40.00"),
            currency="ETB",
            provider=FinePayment.Provider.CHAPA,
            tx_ref="LMS-FINE-TEST-001",
            status=FinePayment.Status.PENDING,
        )

    def chapa_success_response(self):
        response = Mock()
        response.raise_for_status.return_value = None

        response.json.return_value = {
            "status": "success",
            "data": {
                "status": "success",
                "tx_ref": self.payment.tx_ref,
                "currency": "ETB",
                "amount": "40.00",
                "reference": "CHAPA-REFERENCE-001",
            },
        }

        return response

    @patch(
        "apps.fines.services.payments._send_payment_notifications"
    )
    @patch(
        "apps.fines.services.payments.requests.get"
    )
    @patch(
        "apps.fines.services.payments._get_headers",
        return_value={"Authorization": "Bearer local-test-token"},
    )
    def test_successful_partial_payment(
        self,
        mock_headers,
        mock_get,
        mock_notifications,
    ):
        mock_get.return_value = self.chapa_success_response()

        result = verify_fine_payment(
            tx_ref=self.payment.tx_ref,
            user=self.student,
        )

        self.fine.refresh_from_db()
        self.payment.refresh_from_db()

        self.assertEqual(
            result.status,
            FinePayment.Status.SUCCESSFUL,
        )

        self.assertEqual(
            self.payment.status,
            FinePayment.Status.SUCCESSFUL,
        )

        self.assertEqual(
            self.fine.paid_amount,
            Decimal("40.00"),
        )

        self.assertEqual(
            self.fine.outstanding_balance,
            Decimal("60.00"),
        )

        self.assertEqual(
            self.fine.status,
            Fine.Status.PARTIALLY_PAID,
        )

        mock_notifications.assert_called_once_with(
            self.payment.pk
        )

    @patch(
        "apps.fines.services.payments._send_payment_notifications"
    )
    @patch(
        "apps.fines.services.payments.requests.get"
    )
    @patch(
        "apps.fines.services.payments._get_headers",
        return_value={"Authorization": "Bearer local-test-token"},
    )
    def test_duplicate_verification_does_not_charge_twice(
        self,
        mock_headers,
        mock_get,
        mock_notifications,
    ):
        mock_get.return_value = self.chapa_success_response()

        verify_fine_payment(
            tx_ref=self.payment.tx_ref,
            user=self.student,
        )

        first_balance = Fine.objects.get(
            pk=self.fine.pk
        ).paid_amount

        verify_fine_payment(
            tx_ref=self.payment.tx_ref,
            user=self.student,
        )

        self.fine.refresh_from_db()

        self.assertEqual(
            first_balance,
            Decimal("40.00"),
        )

        self.assertEqual(
            self.fine.paid_amount,
            Decimal("40.00"),
        )

        self.assertEqual(mock_get.call_count, 1)

        mock_notifications.assert_called_once()

    @patch(
        "apps.fines.services.payments.requests.get"
    )
    @patch(
        "apps.fines.services.payments._get_headers",
        return_value={"Authorization": "Bearer local-test-token"},
    )
    def test_failed_chapa_payment_does_not_update_fine(
        self,
        mock_headers,
        mock_get,
    ):
        response = Mock()
        response.raise_for_status.return_value = None

        response.json.return_value = {
            "status": "success",
            "data": {
                "status": "failed",
                "tx_ref": self.payment.tx_ref,
                "currency": "ETB",
                "amount": "40.00",
                "reference": "CHAPA-FAILED-001",
            },
        }

        mock_get.return_value = response

        with self.assertRaises(ChapaPaymentError):
            verify_fine_payment(
                tx_ref=self.payment.tx_ref,
                user=self.student,
            )

        self.fine.refresh_from_db()
        self.payment.refresh_from_db()

        self.assertEqual(
            self.payment.status,
            FinePayment.Status.FAILED,
        )

        self.assertEqual(
            self.fine.paid_amount,
            Decimal("0.00"),
        )

        self.assertEqual(
            self.fine.status,
            Fine.Status.UNPAID,
        )

    @patch(
        "apps.fines.services.payments.requests.get"
    )
    @patch(
        "apps.fines.services.payments._get_headers",
        return_value={"Authorization": "Bearer local-test-token"},
    )
    def test_overpayment_is_rejected(
        self,
        mock_headers,
        mock_get,
    ):
        self.fine.paid_amount = Decimal("90.00")
        self.fine.status = Fine.Status.PARTIALLY_PAID
        self.fine.save()

        self.payment.amount = Decimal("20.00")
        self.payment.save()

        response = Mock()
        response.raise_for_status.return_value = None

        response.json.return_value = {
            "status": "success",
            "data": {
                "status": "success",
                "tx_ref": self.payment.tx_ref,
                "currency": "ETB",
                "amount": "20.00",
                "reference": "CHAPA-OVERPAY-001",
            },
        }

        mock_get.return_value = response

        with self.assertRaises(ChapaPaymentError):
            verify_fine_payment(
                tx_ref=self.payment.tx_ref,
                user=self.student,
            )

        self.fine.refresh_from_db()
        self.payment.refresh_from_db()

        self.assertEqual(
            self.fine.paid_amount,
            Decimal("90.00"),
        )

        self.assertEqual(
            self.payment.status,
            FinePayment.Status.PENDING,
        )

    @patch(
        "apps.fines.services.payments.requests.get"
    )
    def test_payment_owner_mismatch_is_rejected(
        self,
        mock_get,
    ):
        self.payment.user = self.other_student
        self.payment.save()

        with self.assertRaises(ChapaPaymentError):
            verify_fine_payment(
                tx_ref=self.payment.tx_ref,
                user=None,
            )

        mock_get.assert_not_called()

        self.fine.refresh_from_db()

        self.assertEqual(
            self.fine.paid_amount,
            Decimal("0.00"),
        )

class FineExtensionRequestAPITests(APITestCase):
    def setUp(self):
        self.student = self.create_user(
            "extension_student",
            "extension_student@example.com",
            "student",
        )
        self.other_student = self.create_user(
            "extension_other",
            "extension_other@example.com",
            "student",
        )
        self.librarian = self.create_user(
            "extension_librarian",
            "extension_librarian@example.com",
            "librarian",
        )
        self.admin = self.create_user(
            "extension_admin",
            "extension_admin@example.com",
            "admin",
        )
        self.digital_officer = self.create_user(
            "extension_digital",
            "extension_digital@example.com",
            "digital_officer",
        )

        self.fine = Fine.objects.create(
            user=self.student,
            reason=Fine.Reason.DAMAGED,
            description="Damaged book fine.",
            amount=Decimal("200.00"),
            paid_amount=Decimal("50.00"),
            status=Fine.Status.PARTIALLY_PAID,
            payment_due_date=timezone.localdate() + timedelta(days=5),
        )

        self.other_fine = Fine.objects.create(
            user=self.other_student,
            reason=Fine.Reason.LOST,
            description="Lost book fine.",
            amount=Decimal("300.00"),
            paid_amount=Decimal("0.00"),
            status=Fine.Status.UNPAID,
            payment_due_date=timezone.localdate() + timedelta(days=7),
        )

        self.extensions_url = reverse(
            "fine-extension-list-create"
        )

    def create_user(self, username, email, role):
        return User.objects.create_user(
            username=username,
            email=email,
            password="TestPassword123!",
            role=role,
            is_active=True,
            is_email_verified=True,
        )

    def submit_extension(self, user=None, fine=None, requested_until=None):
        self.client.force_authenticate(
            user=user or self.student
        )

        return self.client.post(
            self.extensions_url,
            {
                "fine": (fine or self.fine).pk,
                "reason": "I need more time to arrange payment.",
                "requested_until": (
                    requested_until
                    or timezone.localdate() + timedelta(days=15)
                ).isoformat(),
            },
            format="json",
        )

    def review_extension(
        self,
        extension_request,
        decision,
        decision_note="Reviewed by librarian.",
        approved_until=None,
        user=None,
    ):
        self.client.force_authenticate(
            user=user or self.librarian
        )

        payload = {
            "decision": decision,
            "decision_note": decision_note,
        }

        if approved_until:
            payload["approved_until"] = approved_until.isoformat()

        return self.client.post(
            reverse(
                "fine-extension-review",
                kwargs={"pk": extension_request.pk},
            ),
            payload,
            format="json",
        )

    # ---------------------------------------------------------
    # 1. EXTENSION REQUEST SUBMISSION
    # ---------------------------------------------------------

    def test_student_can_request_extension_for_own_fine(self):
        response = self.submit_extension()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        extension_request = FineExtensionRequest.objects.get(
            fine=self.fine
        )

        self.assertEqual(
            extension_request.requested_by,
            self.student,
        )
        self.assertEqual(
            extension_request.status,
            FineExtensionRequest.Status.PENDING,
        )

    def test_user_cannot_request_extension_for_another_users_fine(self):
        response = self.submit_extension(
            user=self.student,
            fine=self.other_fine,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            FineExtensionRequest.objects.count(),
            0,
        )

    def test_paid_fine_cannot_receive_extension_request(self):
        self.fine.paid_amount = self.fine.amount
        self.fine.status = Fine.Status.PAID
        self.fine.save()

        response = self.submit_extension()

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            FineExtensionRequest.objects.count(),
            0,
        )

    def test_duplicate_pending_extension_is_rejected(self):
        first_response = self.submit_extension()

        self.assertEqual(
            first_response.status_code,
            status.HTTP_201_CREATED,
        )

        second_response = self.submit_extension()

        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            FineExtensionRequest.objects.filter(
                fine=self.fine,
                status=FineExtensionRequest.Status.PENDING,
            ).count(),
            1,
        )

    # ---------------------------------------------------------
    # 2. LIBRARIAN REVIEW PERMISSIONS
    # ---------------------------------------------------------

    def create_pending_extension(self):
        return FineExtensionRequest.objects.create(
            fine=self.fine,
            requested_by=self.student,
            reason="I need more time to pay.",
            requested_until=timezone.localdate() + timedelta(days=15),
        )

    def test_only_librarian_can_review_extension(self):
        extension_request = self.create_pending_extension()

        response = self.review_extension(
            extension_request,
            "approved",
            user=self.student,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        extension_request.refresh_from_db()

        self.assertEqual(
            extension_request.status,
            FineExtensionRequest.Status.PENDING,
        )

    def test_librarian_can_approve_extension(self):
        extension_request = self.create_pending_extension()

        original_amount = self.fine.amount
        original_paid_amount = self.fine.paid_amount
        original_balance = self.fine.outstanding_balance

        new_deadline = timezone.localdate() + timedelta(days=30)

        response = self.review_extension(
            extension_request,
            "approved",
            decision_note="Extension approved after review.",
            approved_until=new_deadline,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        extension_request.refresh_from_db()
        self.fine.refresh_from_db()

        self.assertEqual(
            extension_request.status,
            FineExtensionRequest.Status.APPROVED,
        )
        self.assertEqual(
            extension_request.reviewed_by,
            self.librarian,
        )
        self.assertEqual(
            extension_request.approved_until,
            new_deadline,
        )

        self.assertEqual(
            self.fine.payment_due_date,
            new_deadline,
        )

        # Extension must not change the financial amounts.
        self.assertEqual(self.fine.amount, original_amount)
        self.assertEqual(self.fine.paid_amount, original_paid_amount)
        self.assertEqual(self.fine.outstanding_balance, original_balance)

    def test_librarian_can_reject_extension(self):
        extension_request = self.create_pending_extension()
        original_deadline = self.fine.payment_due_date

        response = self.review_extension(
            extension_request,
            "rejected",
            decision_note="Insufficient reason for extension.",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        extension_request.refresh_from_db()
        self.fine.refresh_from_db()

        self.assertEqual(
            extension_request.status,
            FineExtensionRequest.Status.REJECTED,
        )
        self.assertEqual(
            extension_request.reviewed_by,
            self.librarian,
        )
        self.assertEqual(
            self.fine.payment_due_date,
            original_deadline,
        )

    def test_already_reviewed_extension_cannot_be_reviewed_again(self):
        extension_request = self.create_pending_extension()

        first_response = self.review_extension(
            extension_request,
            "approved",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_200_OK,
        )

        second_response = self.review_extension(
            extension_request,
            "rejected",
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        extension_request.refresh_from_db()

        self.assertEqual(
            extension_request.status,
            FineExtensionRequest.Status.APPROVED,
        )

    # ---------------------------------------------------------
    # 3. EXTENSION NOTIFICATIONS
    # ---------------------------------------------------------

    def test_new_extension_request_notifies_librarians(self):
        response = self.submit_extension()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            Notification.objects.filter(
                user=self.librarian,
                type="fine_extension_request",
            ).exists()
        )

        # Admin and digital officer must not receive
        # another user's extension request notification.
        self.assertFalse(
            Notification.objects.filter(
                user=self.admin,
                type="fine_extension_request",
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                user=self.digital_officer,
                type="fine_extension_request",
            ).exists()
        )

    def test_approved_extension_notifies_requester(self):
        extension_request = self.create_pending_extension()

        response = self.review_extension(
            extension_request,
            "approved",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                type="fine_extension_update",
                title="Fine Extension Approved",
            ).exists()
        )

    def test_rejected_extension_notifies_requester(self):
        extension_request = self.create_pending_extension()

        response = self.review_extension(
            extension_request,
            "rejected",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                type="fine_extension_update",
                title="Fine Extension Rejected",
            ).exists()
        )

    # ---------------------------------------------------------
    # 4. EXTENSION REQUEST VISIBILITY
    # ---------------------------------------------------------

    def test_student_can_view_only_own_extension_requests(self):
        FineExtensionRequest.objects.create(
            fine=self.fine,
            requested_by=self.student,
            reason="My extension request.",
            requested_until=timezone.localdate() + timedelta(days=15),
        )

        FineExtensionRequest.objects.create(
            fine=self.other_fine,
            requested_by=self.other_student,
            reason="Another student's extension request.",
            requested_until=timezone.localdate() + timedelta(days=20),
        )

        self.client.force_authenticate(user=self.student)

        response = self.client.get(self.extensions_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["fine"],
            self.fine.pk,
        )

    def test_librarian_can_view_all_extension_requests(self):
        FineExtensionRequest.objects.create(
            fine=self.fine,
            requested_by=self.student,
            reason="First extension request.",
            requested_until=timezone.localdate() + timedelta(days=15),
        )

        FineExtensionRequest.objects.create(
            fine=self.other_fine,
            requested_by=self.other_student,
            reason="Second extension request.",
            requested_until=timezone.localdate() + timedelta(days=20),
        )

        self.client.force_authenticate(user=self.librarian)

        response = self.client.get(self.extensions_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(len(response.data), 2)