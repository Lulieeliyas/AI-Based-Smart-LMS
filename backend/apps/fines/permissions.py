
from rest_framework.permissions import BasePermission


PERSONAL_FINE_ROLES = {
    "student",
    "academic_staff",
    "librarian",
    "digital_officer",
    "admin",
}

REPORT_SUBMISSION_ROLES = {
    "student",
    "academic_staff",
    "librarian",
    "digital_officer",
    "admin",
}

LIBRARIAN_ROLE = "librarian"


class IsFineUser(BasePermission):
    """Allow authenticated, non-guest users to access personal fine features."""

    message = "You are not authorized to access Fine Management."

    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and getattr(user, "role", None) in PERSONAL_FINE_ROLES
        )


class CanSubmitFineReport(BasePermission):
    """Allow authorized users to submit reports."""

    message = "Your role cannot submit fine reports."

    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and getattr(user, "role", None) in REPORT_SUBMISSION_ROLES
        )


class IsLibrarian(BasePermission):
    """Only librarians can review reports, manage fines, and extensions."""

    message = "Only librarians can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and getattr(user, "role", None) == LIBRARIAN_ROLE
        )


class IsLibrarianOrReportRecipient(BasePermission):
    """Librarians manage reports; admins see only reports sent to them."""

    message = "You cannot access this administrative fine report."

    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and getattr(user, "role", None) in {"librarian", "admin"}
        )

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, "role", None) == LIBRARIAN_ROLE:
            return True

        return obj.recipients.filter(pk=request.user.pk).exists()
