from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase

from apps.users.models import User, AuthorizedUser
from apps.books.models import Book
from apps.borrowing.models import BorrowRecord
from apps.borrowing.services import issue_book


class BookIssuingDueDateTests(TestCase):

    def create_user(self, role, student_id, department=None):
        user = User.objects.create_user(
            username=f"user_{student_id}",
            email=f"{student_id}@example.com",
            password="TestPassword123!",
            role=role,
            student_id=student_id,
            department="User Editable Department",
            is_active=True,
            is_email_verified=True,
        )

        if role == "student":
            AuthorizedUser.objects.create(
                student_id=student_id,
                first_name="Test",
                last_name="User",
                email=f"{student_id}@example.com",
                department=department or "Software Engineering",
                role="student",
                is_authorized=True,
            )

        return user

    def create_book(self):
        return Book.objects.create(
            title="Test Borrowing Book",
            author="Test Author",
            total_copies=5,
            available_copies=5,
        )

    def assert_borrowing_period(self, user, expected_days):
        book = self.create_book()

        # Notifications are not the subject of these tests.
        with patch("apps.borrowing.services.Notification.objects.create"):
            record = issue_book(user, book.id)

        self.assertEqual(
            (record.due_date - record.issue_date).days,
            expected_days,
        )

        record.refresh_from_db()

        self.assertEqual(
            (record.due_date - record.issue_date).days,
            expected_days,
        )

        book.refresh_from_db()
        self.assertEqual(book.available_copies, 4)

    def test_health_student_receives_30_days(self):
        user = self.create_user(
            "student", "HEALTH001", "College of Health Sciences"
        )
        self.assert_borrowing_period(user, 30)

    def test_law_student_receives_30_days(self):
        user = self.create_user(
            "student", "LAW001", "Faculty of Law"
        )
        self.assert_borrowing_period(user, 30)

    def test_academic_staff_receives_30_days(self):
        user = self.create_user(
            "academic_staff", "STAFF001"
        )
        self.assert_borrowing_period(user, 30)

    def test_regular_student_receives_14_days(self):
        user = self.create_user(
            "student", "STUDENT001", "Software Engineering"
        )
        self.assert_borrowing_period(user, 14)

    def test_editable_department_does_not_grant_exception(self):
        user = self.create_user(
            "student", "STUDENT002", "Software Engineering"
        )

        # The profile says Health, but the authorized record says
        # Software Engineering.
        user.department = "Health"
        user.save(update_fields=["department"])

        self.assert_borrowing_period(user, 14)

