from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from django.conf import settings

from apps.borrowing.services import get_borrowing_period


class BorrowingPeriodTests(SimpleTestCase):

    def make_user(self, role, student_id="TEST001"):
        return SimpleNamespace(
            role=role,
            student_id=student_id,
            is_approved_member=lambda: True,
        )

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_health_student_gets_30_days(self, mock_filter):
        mock_filter.return_value.only.return_value.first.return_value = (
            SimpleNamespace(department="Health Sciences")
        )

        user = self.make_user("student")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_HEALTH_STUDENT,
        )

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_law_student_gets_30_days(self, mock_filter):
        mock_filter.return_value.only.return_value.first.return_value = (
            SimpleNamespace(department="Faculty of Law")
        )

        user = self.make_user("student")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_LAW_STUDENT,
        )

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_regular_student_gets_14_days(self, mock_filter):
        mock_filter.return_value.only.return_value.first.return_value = (
            SimpleNamespace(department="Software Engineering")
        )

        user = self.make_user("student")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_OTHER,
        )

    def test_academic_staff_gets_30_days(self):
        user = self.make_user("academic_staff")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_ACADEMIC_STAFF,
        )

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_librarian_gets_14_days(self, mock_filter):
        user = self.make_user("librarian")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_OTHER,
        )

        mock_filter.assert_not_called()

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_digital_officer_gets_14_days(self, mock_filter):
        user = self.make_user("digital_officer")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_OTHER,
        )

        mock_filter.assert_not_called()

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_admin_gets_14_days(self, mock_filter):
        user = self.make_user("admin")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_OTHER,
        )

        mock_filter.assert_not_called()

    @patch("apps.borrowing.services.AuthorizedUser.objects.filter")
    def test_student_without_authorized_record_gets_14_days(
        self, mock_filter
    ):
        mock_filter.return_value.only.return_value.first.return_value = None

        user = self.make_user("student")

        self.assertEqual(
            get_borrowing_period(user),
            settings.BORROW_DAYS_OTHER,
        )

    def test_unapproved_user_cannot_borrow(self):
        user = self.make_user("student")
        user.is_approved_member = lambda: False

        with self.assertRaisesMessage(
            ValueError,
            "Your account is not approved to borrow books.",
        ):
            get_borrowing_period(user)
