from rest_framework import generics, status, views, permissions,viewsets
from rest_framework.response import Response
from rest_framework.decorators import action,api_view, permission_classes
from django.conf import settings
from .permissions import IsAdminUser, IsLibrarianUser, IsAuthenticatedReadOnly
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.files.base import ContentFile
from django.db.models import Count, Q, Exists, OuterRef
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from .models import (
    User,
    EmailVerification,
    PasswordResetToken,
    UserActivityLog,
    AuthorizedUser,
    AuthorizedUserCSVUpload,
)
from .serializers import (
    UserSerializer, UserListSerializer, RegisterSerializer, LoginSerializer,
    ChangePasswordSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    EmailVerificationSerializer, UserActivityLogSerializer, UserStatisticsSerializer
)
import csv
import io

import logging

logger = logging.getLogger(__name__)

class AuthorizedUserLookupView(generics.GenericAPIView):
    """
    Check whether an ID is approved for library registration.
    Return masked contact information to avoid exposing private details.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        student_id = str(request.data.get("student_id", "")).strip()

        if not student_id:
            return Response(
                {"error": "Student or staff ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            approved_user = AuthorizedUser.objects.get(
                student_id__iexact=student_id,
                is_authorized=True,
            )
        except AuthorizedUser.DoesNotExist:
            return Response(
                {
                    "error": (
                        "This ID is not approved for registration. "
                        "Please contact the library administrator."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent registration against an identity already in use.
        if User.objects.filter(
            Q(student_id__iexact=approved_user.student_id)
            | Q(email__iexact=approved_user.email)
        ).exists():
            return Response(
                {
                    "error": (
                        "An account already exists for this approved record. "
                        "Please contact the library administrator if you need help."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        email = approved_user.email
        phone = approved_user.phone or ""

        # Mask email: h***@example.com
        if "@" in email:
            local_part, domain = email.split("@", 1)
            masked_email = f"{local_part[0]}***@{domain}"
        else:
            masked_email = "***"

        # Mask phone, preserving only the last 3 digits.
        digits = "".join(char for char in phone if char.isdigit())
        masked_phone = f"***{digits[-3:]}" if digits else "Not provided"

        return Response(
            {
                "student_id": approved_user.student_id,
                "first_name": approved_user.first_name,
                "last_name": approved_user.last_name,
                "department": approved_user.department,
                "role": approved_user.role,
                "masked_email": masked_email,
                "masked_phone": masked_phone,
            },
            status=status.HTTP_200_OK,
        )

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # ✅ Account is UNVERIFIED and INACTIVE
            user.is_email_verified = False
            user.is_active = False
            user.save(update_fields=['is_email_verified', 'is_active'])
            verification = None
            # ✅ Send OTP to email AND SMS
            try:
                from .utils import create_email_verification
                verification = create_email_verification(user)

                if not verification:
                    user.delete()
                    return Response(
                        {'error': 'Could not send verification OTP. Please check your email and phone number.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
            except Exception as e:
                logger.error(f"Failed to send verification OTP: {str(e)}")
                user.delete()
                return Response(
                    {'error': 'Could not send verification OTP. Please try again.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # ✅ DO NOT return JWT — user must verify first
            return Response(
                {
                    'message': 'OTP sent. Please verify to activate your account.',
                    'email': user.email,
                    'phone': user.phone,
                    'requires_verification': True,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuthorizedUserCSVUploadView(generics.GenericAPIView):
    """Import approved people from an administrator-uploaded CSV file."""

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    REQUIRED_COLUMNS = {
        "student_id",
        "first_name",
        "last_name",
        "email",
    }

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            return Response(
                {"error": "Please upload a CSV file using the 'file' field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not uploaded_file.name.lower().endswith(".csv"):
            return Response(
                {"error": "Only CSV files are accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent unexpectedly large uploads.
        if uploaded_file.size > 5 * 1024 * 1024:
            return Response(
                {"error": "The CSV file must be 5 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            text_file = io.TextIOWrapper(
                uploaded_file.file,
                encoding="utf-8-sig",
                newline="",
            )
            reader = csv.DictReader(text_file)

            if not reader.fieldnames:
                return Response(
                    {"error": "The CSV file is empty or has no header row."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Normalize header names, including accidental spaces.
            reader.fieldnames = [
                (name or "").strip().lower()
                for name in reader.fieldnames
            ]

            if len(reader.fieldnames) != len(set(reader.fieldnames)):
                return Response(
                    {"error": "The CSV contains duplicate column names."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            missing = self.REQUIRED_COLUMNS - set(reader.fieldnames)
            if missing:
                return Response(
                    {
                        "error": "Required CSV columns are missing.",
                        "missing_columns": sorted(missing),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            allowed_roles = {
                role for role, label in AuthorizedUser.ALLOWED_ROLES
            }
            imported = 0
            errors = []
            seen_ids = set()
            seen_emails = set()

            for row_number, row in enumerate(reader, start=2):
                # Ignore completely blank rows.
                if not any((value or "").strip() for value in row.values()):
                    continue

                student_id = (row.get("student_id") or "").strip()
                first_name = (row.get("first_name") or "").strip()
                last_name = (row.get("last_name") or "").strip()
                email = (row.get("email") or "").strip().lower()
                phone = (row.get("phone") or "").strip()
                department = (row.get("department") or "").strip()
                role = (row.get("role") or "student").strip().lower()

                if not all([student_id, first_name, last_name, email]):
                    errors.append({
                        "row": row_number,
                        "error": "ID, first name, last name, and email are required.",
                    })
                    continue

                if role not in allowed_roles:
                    errors.append({
                        "row": row_number,
                        "error": (
                            f"Invalid role '{role}'. Allowed roles: "
                            f"{', '.join(sorted(allowed_roles))}."
                        ),
                    })
                    continue

                if (
                    student_id in seen_ids
                    or email in seen_emails
                    or AuthorizedUser.objects.filter(student_id=student_id).exists()
                    or AuthorizedUser.objects.filter(email__iexact=email).exists()
                ):
                    errors.append({
                        "row": row_number,
                        "error": "Duplicate ID or email; this row was not imported.",
                    })
                    continue

                if User.objects.filter(
                    student_id=student_id
                ).exists() or User.objects.filter(email__iexact=email).exists():
                    errors.append({
                        "row": row_number,
                        "error": "This ID or email already belongs to an account.",
                    })
                    continue

                try:
                    from django.core.validators import validate_email
                    validate_email(email)

                    AuthorizedUser.objects.create(
                        student_id=student_id,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        phone=phone,
                        department=department,
                        role=role,
                        is_authorized=True,
                    )

                    seen_ids.add(student_id)
                    seen_emails.add(email)
                    imported += 1

                except Exception as exc:
                    logger.warning(
                        "CSV import row %s failed: %s",
                        row_number,
                        str(exc),
                    )
                    errors.append({
                        "row": row_number,
                        "error": "Invalid data or database constraint violation.",
                    })

        except (UnicodeDecodeError, csv.Error):
            return Response(
                {"error": "Could not read the CSV. Please use a valid UTF-8 CSV file."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        finally:
            # Detach the wrapper so it does not unexpectedly close Django's
            # uploaded-file handle.
            if "text_file" in locals():
                try:
                    text_file.detach()
                except Exception:
                    pass

        # Save the original CSV and import results for administrators.
        try:
            uploaded_file.seek(0)
            raw_content = uploaded_file.read()

            upload_record = AuthorizedUserCSVUpload(
                original_filename=uploaded_file.name,
                uploaded_by=request.user,
                imported_count=imported,
                rejected_count=len(errors),
                errors=errors,
            )
            upload_record.file.save(
                uploaded_file.name,
                ContentFile(raw_content),
                save=False,
            )
            upload_record.save()

        except Exception:
            logger.exception("Failed to save CSV upload history")
            return Response(
                {
                    "error": (
                        "CSV rows were processed, but upload history "
                        "could not be saved. Check media storage."
                    ),
                    "imported": imported,
                    "rejected": len(errors),
                    "errors": errors,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": "CSV import finished and original file saved.",
                "upload_id": upload_record.pk,
                "filename": upload_record.original_filename,
                "imported": imported,
                "rejected": len(errors),
                "errors": errors,
            },
            status=status.HTTP_200_OK,
        )


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.validated_data

        # ✅ Block login until verified
        if not user.is_email_verified:
            return Response(
                {
                    'error': 'Your account is not verified. Please verify with the OTP sent to your email and phone.',
                    'requires_verification': True,
                    'email': user.email,
                    'phone': user.phone,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        # Log activity
        UserActivityLog.objects.create(
            user=user,
            action='update',
            description='Password changed'
        )
        
        return Response({'message': 'Password changed successfully'})


class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserListSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['role', 'is_active', 'is_email_verified', 'department']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'phone']
    ordering_fields = ['username', 'email', 'created_at', 'last_login']
    
    def get_permissions(self):
        # ✅ Allow admin and librarian to access user list
        if self.request.user.is_authenticated and self.request.user.role in ['admin', 'librarian']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        user = self.request.user
        
        # ✅ Admin and librarian can see all users
        if user.role in ['admin', 'librarian']:
            queryset = User.objects.all()
            # Exclude superusers if not superuser
            if not user.is_superuser:
                queryset = queryset.filter(is_superuser=False)
            return queryset
        
        # ✅ Other roles can only see themselves
        return User.objects.filter(id=user.id)
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            
            # ✅ Check if user has permission to view all users
            if request.user.role not in ['admin', 'librarian']:
                # Students can only see themselves
                queryset = queryset.filter(id=request.user.id)
            
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching users: {str(e)}")
            return Response(
                {'error': 'Failed to fetch users', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def perform_update(self, serializer):
        user = serializer.save()
        UserActivityLog.objects.create(
            user=self.request.user,
            action='update',
            description=f'Updated user {user.username}'
        )
    
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'You cannot delete your own account'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        user.delete()
        UserActivityLog.objects.create(
            user=request.user,
            action='delete',
            description=f'Deleted user {user.username}'
        )
        return Response({'message': 'User deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()

        # ✅ Check if email exists
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # ✅ Return error message
            return Response(
                {'error': 'This email is not registered. Please check your email or register a new account.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # ✅ Check if user account is active
        if not user.is_active:
            return Response(
                {'error': 'This account has been deactivated. Please contact the librarian.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ✅ Send OTP
        try:
            from .utils import create_password_reset_token
            create_password_reset_token(user)
            return Response({
                'message': 'OTP sent to your email. Please check your inbox.',
                'email': user.email,
            })
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}")
            return Response(
                {'error': 'Failed to send OTP. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
            

class VerifyOTPView(generics.GenericAPIView):
    """Verify OTP before showing the new password step"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        otp = request.data.get('otp', '').strip()

        if not email or not otp:
            return Response(
                {'error': 'Email and OTP are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user exists
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'This email is not registered.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find matching reset token
        reset_token = PasswordResetToken.objects.filter(
            user=user,
            otp=otp,
            used=False
        ).order_by('-created_at').first()

        if not reset_token:
            return Response(
                {'error': 'Invalid OTP. Please check the code and try again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reset_token.is_valid():
            return Response(
                {'error': 'OTP has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'valid': True,
            'message': 'OTP verified successfully'
        })
        
class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data.get('email', '').lower().strip()
        otp = serializer.validated_data.get('otp', '').strip()
        new_password = serializer.validated_data['new_password']

        # Find user by email
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid email or OTP'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find valid reset token for this user with matching OTP
        reset_token = PasswordResetToken.objects.filter(
            user=user,
            otp=otp,
            used=False
        ).order_by('-created_at').first()

        if not reset_token:
            return Response(
                {'error': 'Invalid or expired OTP'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reset_token.is_valid():
            return Response(
                {'error': 'OTP has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update password
        user.set_password(new_password)
        user.save()

        # Mark token as used
        reset_token.used = True
        reset_token.save()

        logger.info(f"✅ Password reset successful for {user.email}")

        return Response({
            'message': 'Password reset successfully. You can now login with your new password.'
        })


class EmailVerificationView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        otp = request.data.get('otp', '').strip()

        if not email or not otp:
            return Response(
                {'error': 'Email and OTP are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'This email is not registered.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.is_email_verified:
            return Response({
                'message': 'Account already verified. You can login.',
                'already_verified': True,
            })

        try:
            verification = EmailVerification.objects.get(user=user)
        except EmailVerification.DoesNotExist:
            return Response(
                {'error': 'No verification pending. Please register or request a new OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not verification.is_valid():
            return Response(
                {'error': 'OTP has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.otp != otp:
            return Response(
                {'error': 'Invalid OTP. Please check the code and try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ ACTIVATE THE ACCOUNT
        user.is_email_verified = True
        user.is_active = True
        user.save()
        verification.delete()

        logger.info(f"Account verified and activated for {user.email}")

        return Response({
            'message': 'Account verified successfully! You can now login.',
            'email': user.email,
        })
class ResendVerificationView(generics.GenericAPIView):
    serializer_class = EmailVerificationSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.is_email_verified:
            return Response(
                {'error': 'Account already verified. You can login.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from .utils import create_email_verification
            verification = create_email_verification(user)
            if not verification:
                return Response(
            {
                'error': (
                    'Could not deliver the OTP. '
                    'Please check your contact details and try again.'
                )
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
            return Response({
        'message': 'OTP sent successfully.',
    })
        except Exception as e:

            logger.error(f"Resend OTP failed: {str(e)}")
            return Response(
                {'error': 'Failed to send OTP. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
            
class UserActivityView(generics.ListAPIView):
    serializer_class = UserActivityLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        return UserActivityLog.objects.filter(user_id=user_id)


class UserStatisticsView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        verified_users = User.objects.filter(is_email_verified=True).count()
        
        roles_distribution = {}
        for role, _ in User.ROLE_CHOICES:
            count = User.objects.filter(role=role).count()
            if count > 0:
                roles_distribution[role] = count
        
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        new_users_this_month = User.objects.filter(created_at__gte=start_of_month).count()
        new_users_today = User.objects.filter(created_at__gte=start_of_day).count()
        
        data = {
            'total_users': total_users,
            'active_users': active_users,
            'verified_users': verified_users,
            'roles_distribution': roles_distribution,
            'new_users_this_month': new_users_this_month,
            'new_users_today': new_users_today
        }
        
        serializer = UserStatisticsSerializer(data)
        return Response(serializer.data)


class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
        
        # Log activity
        UserActivityLog.objects.create(
            user=request.user,
            action='logout',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return Response({'message': 'Logged out successfully'})


class GuestUpgradeView(views.APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        if user.role != 'guest':
            return Response(
                {'error': 'Only guest users can upgrade'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.role = request.data.get('role', 'student')
        user.save()
        
        return Response({
            'message': f'Account upgraded to {user.get_role_display()}',
            'user': UserSerializer(user).data
        })

class PublicStatsView(views.APIView):
    """
    Public statistics visible to everyone (no login required).
    Shows total books, available books, categories, and borrowing statistics.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.books.models import Book, Category
        from apps.borrowing.models import BorrowRecord

        # Total number of book titles
        total_books = Book.objects.count()

        # Number of titles with at least one available copy
        available_books = Book.objects.filter(
            available_copies__gt=0
        ).count()

        # Total physical copies across all book titles
        total_copies = Book.objects.aggregate(
            total=Sum("total_copies")
        )["total"] or 0

        # Total categories
        total_categories = Category.objects.count()

        # Total borrowing records
        total_borrowings = BorrowRecord.objects.count()

        # Active borrowings: issued or overdue records
        active_borrowings = BorrowRecord.objects.filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ]
        ).count()

        # Users who borrowed a book in the last 30 days
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)

        active_users = User.objects.filter(
            borrows__issue_date__gte=thirty_days_ago.date()
        ).distinct().count()

        # Total active, email-verified users
        total_users = User.objects.filter(
            is_active=True,
            is_email_verified=True,
        ).count()

        # Top 10 categories by number of books
        categories = Category.objects.annotate(
            book_count=Count("books")
        ).order_by("-book_count")[:10]

        categories_data = [
            {
                "name": category.name,
                "count": category.book_count,
            }
            for category in categories
        ]

        return Response({
            "total_books": total_books,
            "available_books": available_books,
            "total_copies": total_copies,
            "total_categories": total_categories,
            "total_borrowings": total_borrowings,
            "active_borrowings": active_borrowings,
            "active_users": active_users,
            "total_verified_users": total_users,
            "categories": categories_data,
        })



class PublicBooksView(generics.ListAPIView):
    """
    Public book list — no login required.
    Shows all books in the library (read-only).
    """
    permission_classes = [AllowAny]
    from apps.books.serializers import BookListSerializer
    serializer_class = BookListSerializer

    def get_queryset(self):
        from apps.books.models import Book
        from django_filters.rest_framework import DjangoFilterBackend
        from rest_framework import filters

        queryset = Book.objects.all().order_by('-created_at')

        # Optional search and filter
        search = self.request.query_params.get('search', '')
        category = self.request.query_params.get('category', '')

        if search:
            queryset = queryset.filter(title__icontains=search)
        if category:
            queryset = queryset.filter(category__name__iexact=category)

        return queryset


class PublicBookDetailView(generics.RetrieveAPIView):
    """
    Public book detail view — no login required.
    """
    permission_classes = [AllowAny]
    from apps.books.serializers import BookSerializer
    serializer_class = BookSerializer
    queryset = __import__('apps.books.models', fromlist=['Book']).Book.objects.all()
    lookup_field = 'id'


class PublicDocumentationView(views.APIView):
    """
    Public documentation and about page data.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'about': {
                'title': 'AI-Based Smart Library Management System',
                'description': (
                    'The AI-Based Smart Library Management and Recommendation System '
                    'is designed to automate library operations and provide personalized '
                    'book recommendations to enhance user experience and resource accessibility.'
                ),
                'version': '1.0',
                'university': 'Mekdela Amba University',
                'department': 'Software Engineering',
                'team': [
                    {'name': 'Meseret Belay', 'id': '1401775'},
                    {'name': 'Eliyas Kindie', 'id': '1400630'},
                    {'name': 'Hana Yaregal', 'id': '1400932'},
                ],
                'advisor': 'Mr. Abebaw M.',
            },
            'features': [
                {
                    'icon': '📚',
                    'title': 'Book Catalog',
                    'description': 'Browse thousands of books across all categories.',
                },
                {
                    'icon': '🤖',
                    'title': 'AI Recommendations',
                    'description': 'Get personalized book suggestions based on your interests.',
                },
                {
                    'icon': '🔍',
                    'title': 'Fast Search',
                    'description': 'Quickly find books by title, author, category, or keyword.',
                },
                {
                    'icon': '📖',
                    'title': 'Easy Borrowing',
                    'description': 'BorrowRecord and return books with a few clicks.',
                },
                {
                    'icon': '💻',
                    'title': 'Digital Resources',
                    'description': 'Access e-books, journals, and academic papers online.',
                },
                {
                    'icon': '📊',
                    'title': 'Reports & Analytics',
                    'description': 'Track library usage and trends with detailed reports.',
                },
            ],
            'user_roles': [
                {
                    'role': 'Student',
                    'description': 'Browse, borrow, and get recommendations.',
                    'can_register': True,
                },
                {
                    'role': 'Academic Staff',
                    'description': 'Access research materials and journals.',
                    'can_register': True,
                },
                {
                    'role': 'Librarian',
                    'description': 'Manage books, users, and borrowing operations.',
                    'can_register': True,
                },
                {
                    'role': 'Digital Library Officer',
                    'description': 'Manage digital resources and e-books.',
                    'can_register': True,
                },
                {
                    'role': 'System Administrator',
                    'description': 'Full system access and configuration.',
                    'can_register': True,
                },
                {
                    'role': 'Guest',
                    'description': 'Browse public books and documentation without registering.',
                    'can_register': False,
                },
            ],
            'how_to_register': [
                'Fill in the registration form with your details.',
                'Verify your email and phone with the OTP we send.',
                'Login with your username and password.',
                'Start borrowing books and get AI recommendations!',
            ],
            'contact': {
                'email': 'library@mau.edu.et',
                'phone': '+251-XXX-XXXXXX',
                'address': 'Mekdela Amba University, Tulu Awuliya, Ethiopia',
            },
        })


class PublicRecentBooksView(generics.ListAPIView):
    """
    Public view of recently added books — no login required.
    """
    permission_classes = [AllowAny]
    from apps.books.serializers import BookListSerializer
    serializer_class = BookListSerializer

    def get_queryset(self):
        from apps.books.models import Book
        limit = int(self.request.query_params.get('limit', 10))
        return Book.objects.all().order_by('-created_at')[:limit]


class PublicPopularBooksView(generics.ListAPIView):
    """
    Public view of popular books — no login required.
    """
    permission_classes = [AllowAny]
    from apps.books.serializers import BookListSerializer
    serializer_class = BookListSerializer

    def get_queryset(self):
        from apps.books.models import Book
        limit = int(self.request.query_params.get('limit', 10))
        return Book.objects.annotate(
            borrow_count=Count('borrows')
        ).filter(borrow_count__gt=0).order_by('-borrow_count')[:limit]
        

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for admin user management.
    Provides: list, create, retrieve, update, partial_update, destroy
    """
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        # Only admin/librarian can list all users
        if user.role in ['admin', 'librarian']:
            qs = User.objects.all().order_by('-created_at')
            if not user.is_superuser:
                qs = qs.filter(is_superuser=False)
            return qs
        return User.objects.filter(id=user.id)

    @action(detail=True, methods=['get'])
    def activities(self, request, pk=None):
        """GET /api/users/users/{id}/activities/"""
        user = self.get_object()
        activities = UserActivityLog.objects.filter(user=user)[:50]
        serializer = UserActivityLogSerializer(activities, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """GET /api/users/users/statistics/"""
        if request.user.role != 'admin':
            return Response({'error': 'Admin only'}, status=403)

        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        roles_distribution = {
            role: User.objects.filter(role=role).count()
            for role, _ in User.ROLE_CHOICES
        }

        return Response({
            'total_users': User.objects.count(),
            'active_users': User.objects.filter(is_active=True).count(),
            'verified_users': User.objects.filter(is_email_verified=True).count(),
            'roles_distribution': roles_distribution,
            'new_users_this_month': User.objects.filter(created_at__gte=start_of_month).count(),
            'new_users_today': User.objects.filter(created_at__gte=start_of_today).count(),
        })

class AuthorizedUserListCreateView(generics.GenericAPIView):
    """
    List and create authorized registration records.
    Only administrators can manage these records.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        registered_accounts = User.objects.filter(
            Q(student_id__iexact=OuterRef("student_id"))
            | Q(email__iexact=OuterRef("email"))
            )
        records = (
            AuthorizedUser.objects
            .annotate(
                has_registered_account=Exists(registered_accounts)
                )
                .filter(has_registered_account=False)
                .order_by("student_id")
                .values(
                    "id",
                    "student_id",
                    "first_name",
                    "last_name",
                    "email",
                    "phone",
                    "department",
                    "role",
                    "is_authorized",
                    "imported_at",
                    "updated_at",
                    )
                    )
        return Response(list(records), status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):

        data = request.data

        student_id = str(data.get("student_id", "")).strip()
        first_name = str(data.get("first_name", "")).strip()
        last_name = str(data.get("last_name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        phone = str(data.get("phone", "")).strip()
        department = str(data.get("department", "")).strip()
        role = str(data.get("role", "student")).strip().lower()

        if not all([student_id, first_name, last_name, email]):
            return Response(
                {
                    "error": (
                        "Student ID, first name, last name, "
                        "and email are required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_roles = {
            value for value, label in AuthorizedUser.ALLOWED_ROLES
        }

        if role not in allowed_roles:
            return Response(
                {
                    "error": "Invalid role.",
                    "allowed_roles": sorted(allowed_roles),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"error": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if AuthorizedUser.objects.filter(
            student_id__iexact=student_id
        ).exists():
            return Response(
                {"error": "This student ID is already registered as authorized."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if AuthorizedUser.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": "This email already exists in authorized users."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            User.objects.filter(student_id__iexact=student_id).exists()
            or User.objects.filter(email__iexact=email).exists()
        ):
            return Response(
                {"error": "This ID or email already belongs to an account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                record = AuthorizedUser.objects.create(
                    student_id=student_id,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    department=department,
                    role=role,
                    is_authorized=True,
                )
        except IntegrityError:
            return Response(
                {"error": "The ID or email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Authorized user added successfully.",
                "user": {
                    "id": record.id,
                    "student_id": record.student_id,
                    "first_name": record.first_name,
                    "last_name": record.last_name,
                    "email": record.email,
                    "phone": record.phone,
                    "department": record.department,
                    "role": record.role,
                    "is_authorized": record.is_authorized,
                },
            },
            status=status.HTTP_201_CREATED,
        )



class AuthorizedUserDetailView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]

    def get_object(self, pk):
        try:
            record = AuthorizedUser.objects.get(pk=pk)
        except AuthorizedUser.DoesNotExist:
            return None

        linked = User.objects.filter(
            Q(student_id__iexact=record.student_id)
            | Q(email__iexact=record.email)
        ).exists()

        return "linked" if linked else record

    def patch(self, request, pk, *args, **kwargs):
        record = self.get_object(pk)

        if record is None:
            return Response(
                {"error": "Authorized user not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if record == "linked":
            return Response(
                {"error": "This record matches a registered account and cannot be edited here."},
                status=status.HTTP_409_CONFLICT,
            )

        data = request.data
        student_id = str(data.get("student_id", record.student_id)).strip()
        first_name = str(data.get("first_name", record.first_name)).strip()
        last_name = str(data.get("last_name", record.last_name)).strip()
        email = str(data.get("email", record.email)).strip().lower()
        phone = str(data.get("phone", record.phone)).strip()
        department = str(data.get("department", record.department)).strip()
        role = str(data.get("role", record.role)).strip().lower()
        is_authorized = data.get("is_authorized", record.is_authorized)

        if not all([student_id, first_name, last_name, email]):
            return Response(
                {"error": "Student ID, first name, last name, and email are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"error": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_roles = {
            value for value, label in AuthorizedUser.ALLOWED_ROLES
        }
        if role not in allowed_roles:
            return Response(
                {"error": "Invalid role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if isinstance(is_authorized, str):
            if is_authorized.lower() not in ("true", "false"):
                return Response(
                    {"error": "Authorized status must be true or false."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            is_authorized = is_authorized.lower() == "true"

        if not isinstance(is_authorized, bool):
            return Response(
                {"error": "Authorized status must be true or false."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if AuthorizedUser.objects.filter(
            student_id__iexact=student_id
        ).exclude(pk=record.pk).exists():
            return Response(
                {"error": "This student ID already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if AuthorizedUser.objects.filter(
            email__iexact=email
        ).exclude(pk=record.pk).exists():
            return Response(
                {"error": "This email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(
            Q(student_id__iexact=student_id)
            | Q(email__iexact=email)
        ).exists():
            return Response(
                {"error": "This ID or email belongs to a registered account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record.student_id = student_id
        record.first_name = first_name
        record.last_name = last_name
        record.email = email
        record.phone = phone
        record.department = department
        record.role = role
        record.is_authorized = is_authorized

        try:
            record.save()
        except IntegrityError:
            return Response(
                {"error": "The ID or email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": "Authorized user updated successfully."},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk, *args, **kwargs):
        record = self.get_object(pk)

        if record is None:
            return Response(
                {"error": "Authorized user not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if record == "linked":
            return Response(
                {"error": "This record matches a registered account and cannot be deleted here."},
                status=status.HTTP_409_CONFLICT,
            )

        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)




class AuthorizedUserCSVUploadHistoryView(generics.ListAPIView):
    """List previous authorized-user CSV imports."""

    permission_classes = [IsAdminUser]

    def list(self, request, *args, **kwargs):
        uploads = AuthorizedUserCSVUpload.objects.select_related(
            "uploaded_by"
        ).all()

        results = [
            {
                "id": upload.pk,
                "filename": upload.original_filename,
                "imported_count": upload.imported_count,
                "rejected_count": upload.rejected_count,
                "errors": upload.errors,
                "uploaded_at": upload.uploaded_at,
                "uploaded_by": (
                    upload.uploaded_by.username
                    if upload.uploaded_by
                    else None
                ),
                "download_url": request.build_absolute_uri(
                    f"/api/users/admin/authorized-users/"
                    f"csv-uploads/{upload.pk}/download/"
                ),
            }
            for upload in uploads
        ]
        return Response(results)


class AuthorizedUserCSVDownloadView(generics.GenericAPIView):
    """Download a previously uploaded CSV file."""

    permission_classes = [IsAdminUser]

    def get(self, request, pk, *args, **kwargs):
        from django.http import FileResponse
        from django.shortcuts import get_object_or_404

        upload = get_object_or_404(AuthorizedUserCSVUpload, pk=pk)

        if not upload.file:
            return Response(
                {"error": "No original CSV file is available."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            upload.file.open("rb")
            return FileResponse(
                upload.file,
                as_attachment=True,
                filename=upload.original_filename,
                content_type="text/csv",
            )
        except (OSError, ValueError):
            return Response(
                {"error": "The original CSV file could not be opened."},
                status=status.HTTP_404_NOT_FOUND,
            )
