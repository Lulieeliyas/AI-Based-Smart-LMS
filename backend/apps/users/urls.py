from django.urls import path,include
from .views import (
    RegisterView,
    AuthorizedUserLookupView,
    LoginView,
    ProfileView,
    ChangePasswordView, UserListView, UserDetailView,
    PasswordResetRequestView, PasswordResetConfirmView,
    EmailVerificationView, ResendVerificationView,
    UserActivityView, UserStatisticsView, LogoutView,
    GuestUpgradeView, VerifyOTPView,
    AuthorizedUserCSVUploadView,
)
from . import views
urlpatterns = [
    # Authentication
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/profile/', ProfileView.as_view(), name='profile'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('profile/', views.ProfileView.as_view(), name='profile'), 
    # ✅ Email Verification with OTP (POST) — THIS IS THE MISSING ONE
    path('auth/verify-email/', EmailVerificationView.as_view(), name='verify-email-otp'),

    # ✅ Legacy email verification with UUID token (GET) — keep if you use link-based
    path('auth/verify-email/<uuid:token>/', EmailVerificationView.as_view(), name='verify-email-token'),

    # Resend verification OTP
    path('auth/resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),

    # Password Reset
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # Guest Upgrade
    path('auth/upgrade/', GuestUpgradeView.as_view(), name='guest-upgrade'),

    # Admin User Management
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<uuid:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('users/<uuid:user_id>/activities/', UserActivityView.as_view(), name='user-activities'),
    path('users/statistics/', UserStatisticsView.as_view(), name='user-statistics'),

    path(
    'admin/authorized-users/upload-csv/',
    AuthorizedUserCSVUploadView.as_view(),
    name='authorized-users-upload-csv',
    ),

    path(
    'auth/authorized-user-lookup/',
    AuthorizedUserLookupView.as_view(),
    name='authorized-user-lookup',
),
]