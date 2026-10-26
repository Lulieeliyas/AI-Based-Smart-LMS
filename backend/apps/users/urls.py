
from django.urls import path

from . import views
from .views import (
    RegisterView,
    AuthorizedUserLookupView,
    LoginView,
    ProfileView,
    ChangePasswordView,
    UserListView,
    UserDetailView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    EmailVerificationView,
    ResendVerificationView,
    UserActivityView,
    UserStatisticsView,
    LogoutView,
    GuestUpgradeView,
    VerifyOTPView,
    AuthorizedUserCSVUploadView,
    AuthorizedUserListCreateView,
    AuthorizedUserDetailView,
    AuthorizedUserCSVUploadHistoryView,
    AuthorizedUserCSVDownloadView,
)

app_name = "users"

urlpatterns = [
    # --------------------------------------------------
    # Authentication
    # --------------------------------------------------
    path(
        "auth/register/",
        RegisterView.as_view(),
        name="register",
    ),
    path(
        "auth/login/",
        LoginView.as_view(),
        name="login",
    ),
    path(
        "auth/logout/",
        LogoutView.as_view(),
        name="logout",
    ),

    # --------------------------------------------------
    # User profile and password
    # --------------------------------------------------
    path(
        "auth/profile/",
        ProfileView.as_view(),
        name="auth-profile",
    ),
    path(
        "profile/",
        ProfileView.as_view(),
        name="profile",
    ),
    path(
        "auth/change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),

    # --------------------------------------------------
    # Email and OTP verification
    # --------------------------------------------------
    path(
        "auth/verify-email/",
        EmailVerificationView.as_view(),
        name="verify-email-otp",
    ),
    path(
        "auth/verify-email/<uuid:token>/",
        EmailVerificationView.as_view(),
        name="verify-email-token",
    ),
    path(
        "auth/verify-otp/",
        VerifyOTPView.as_view(),
        name="verify-otp",
    ),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="resend-verification",
    ),

    # --------------------------------------------------
    # Password reset
    # --------------------------------------------------
    path(
        "auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset",
    ),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),

    # --------------------------------------------------
    # Guest account upgrade
    # --------------------------------------------------
    path(
        "auth/upgrade/",
        GuestUpgradeView.as_view(),
        name="guest-upgrade",
    ),

    # --------------------------------------------------
    # Registered user account management
    # --------------------------------------------------
    path(
        "users/",
        UserListView.as_view(),
        name="user-list",
    ),
    path(
        "users/statistics/",
        UserStatisticsView.as_view(),
        name="user-statistics",
    ),
    path(
        "users/<uuid:user_id>/activities/",
        UserActivityView.as_view(),
        name="user-activities",
    ),
    path(
        "users/<uuid:pk>/",
        UserDetailView.as_view(),
        name="user-detail",
    ),

    # --------------------------------------------------
    # Authorized-user lookup during registration
    # --------------------------------------------------
    path(
        "auth/authorized-user-lookup/",
        AuthorizedUserLookupView.as_view(),
        name="authorized-user-lookup",
    ),

    # --------------------------------------------------
    # Admin: authorized-user roster
    # --------------------------------------------------
    path(
        "admin/authorized-users/",
        AuthorizedUserListCreateView.as_view(),
        name="authorized-users-list-create",
    ),

    path(
        "admin/authorized-users/<int:pk>/",
        AuthorizedUserDetailView.as_view(),
        name="authorized-users-detail",
    ),

    path(
        "admin/authorized-users/upload-csv/",
        AuthorizedUserCSVUploadView.as_view(),
        name="authorized-users-upload-csv",
    ),

    # --------------------------------------------------
    # Admin: CSV upload history and original-file downloads
    # --------------------------------------------------
    path(
        "admin/authorized-users/csv-uploads/",
        AuthorizedUserCSVUploadHistoryView.as_view(),
        name="authorized-users-csv-upload-history",
    ),
    path(
        "admin/authorized-users/csv-uploads/<int:pk>/download/",
        AuthorizedUserCSVDownloadView.as_view(),
        name="authorized-users-csv-download",
    ),
]
