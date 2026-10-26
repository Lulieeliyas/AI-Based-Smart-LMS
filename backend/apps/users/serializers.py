from rest_framework import serializers,generics
from django.contrib.auth import authenticate
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .models import User, UserActivityLog, AuthorizedUser
from django.db.models import Q
import re
import dns.resolver
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    active_borrowings_count = serializers.SerializerMethodField()
    can_borrow = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'department', 'student_id', 'profile_picture',
            'max_books_allowed', 'is_active', 'is_staff', 'is_superuser',
            'is_email_verified', 'last_login', 'created_at', 'updated_at',
            'active_borrowings_count', 'can_borrow'
        ]
        read_only_fields = [
            'id', 'username', 'role', 'last_login', 'created_at', 'updated_at',
            'is_staff', 'is_superuser', 'is_email_verified', 'max_books_allowed',
            ]
        extra_kwargs = {
            'profile_picture': {'required': False, 'allow_null': True},
            'email': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
            'phone': {'required': False},
            'department': {'required': False},
            'student_id': {'required': False},
        }

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_active_borrowings_count(self, obj):
        try:
            return obj.get_active_borrowings_count()
        except Exception:
            return 0

    def get_can_borrow(self, obj):
        try:
            return obj.can_borrow()
        except Exception:
            return True

    def validate_is_active(self, value):
        request = self.context.get('request')
        if not request or not request.user.is_staff:
            raise serializers.ValidationError(
            "Only staff administrators can change account activation."
        )
        return value


    def validate_email(self, value):
        """Ensure email uniqueness when creating or updating a user."""
        if value:
            value = value.lower().strip()

            # Exclude the user being edited, not the logged-in admin.
            users = User.objects.filter(email__iexact=value)

            if self.instance:
                users = users.exclude(pk=self.instance.pk)

            if users.exists():
                raise serializers.ValidationError(
                    "A user with this email already exists."
                )

        return value

    def validate_phone(self, value):
        """Ensure phone uniqueness when creating or updating a user."""
        if value:
            value = value.strip().replace(' ', '').replace('-', '')

            # Exclude the user being edited, not the logged-in admin.
            users = User.objects.filter(phone=value)

            if self.instance:
                users = users.exclude(pk=self.instance.pk)

            if users.exists():
                raise serializers.ValidationError(
                    "This phone number is already registered."
                )

        return value


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'department', 'is_active', 'is_email_verified',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_full_name(self, obj):
        return obj.get_full_name()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password2 = serializers.CharField(write_only=True, required=True)
    student_id = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True)
    phone = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = [
            'username',
            'student_id',
            'email',
            'phone',
            'password',
            'password2',
        ]

    def validate_username(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError(
                "Username must be at least 3 characters long."
            )

        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores."
            )

        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already taken."
            )

        return value

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "This email is already registered."
            )

        return value

    def validate_phone(self, value):
        phone = value.strip().replace(' ', '').replace('-', '')

        if not re.match(r'^(\+251|251|0)?[79]\d{8}$', phone):
            raise serializers.ValidationError(
                "Enter a valid Ethiopian phone number, "
                "such as 0912345678 or +251912345678."
            )

        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError(
                "This phone number is already registered."
            )

        return phone

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                'password': 'Passwords do not match.'
            })

        student_id = attrs['student_id'].strip()

        try:
            approved_user = AuthorizedUser.objects.get(
                student_id__iexact=student_id,
                is_authorized=True,
            )
        except AuthorizedUser.DoesNotExist:
            raise serializers.ValidationError({
                'student_id': (
                    'This ID is not approved for registration. '
                    'Please contact the library administrator.'
                )
            })

        if User.objects.filter(
            Q(student_id__iexact=approved_user.student_id)
            | Q(email__iexact=approved_user.email)
        ).exists():
            raise serializers.ValidationError({
                'student_id': (
                    'An account already exists for this approved ID.'
                )
            })

        # Preserve the approved database record for create().
        attrs['_authorized_user'] = approved_user
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        approved_user = validated_data.pop('_authorized_user')

        password = validated_data.pop('password')
        username = validated_data.pop('username')
        validated_data.pop('student_id')

        # Email and phone are user-entered contact details.
        email = validated_data.pop('email')
        phone = validated_data.pop('phone')

        # Identity and role always come from the trusted CSV roster.
        return User.objects.create_user(
            username=username,
            password=password,
            email=email,
            phone=phone,
            first_name=approved_user.first_name,
            last_name=approved_user.last_name,
            department=approved_user.department or '',
            role=approved_user.role,
            student_id=approved_user.student_id,
            is_email_verified=False,
            is_active=False,
        )


# class RegisterSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(
#         write_only=True,
#         required=True,
#         validators=[validate_password],
#     )
#     password2 = serializers.CharField(write_only=True, required=True)
#     student_id = serializers.CharField(required=True, write_only=True)

#     class Meta:
#         model = User
#         fields = [
#             'username',
#             'student_id',
#             'password',
#             'password2',
#         ]

#     def validate_username(self, value):
#         value = value.strip()

#         if User.objects.filter(username__iexact=value).exists():
#             raise serializers.ValidationError(
#                 "This username is already taken."
#             )

#         if len(value) < 3:
#             raise serializers.ValidationError(
#                 "Username must be at least 3 characters long."
#             )

#         if not re.match(r'^[a-zA-Z0-9_]+$', value):
#             raise serializers.ValidationError(
#                 "Username can only contain letters, numbers, and underscores."
#             )

#         return value

#     def validate(self, attrs):
#         if attrs['password'] != attrs['password2']:
#             raise serializers.ValidationError({
#                 "password": "Passwords do not match."
#             })

#         student_id = attrs['student_id'].strip()

#         try:
#             approved_user = AuthorizedUser.objects.get(
#                 student_id__iexact=student_id,
#                 is_authorized=True,
#             )
#         except AuthorizedUser.DoesNotExist:
#             raise serializers.ValidationError({
#                 "student_id": (
#                     "This ID is not approved for registration. "
#                     "Please contact the library administrator."
#                 )
#             })

#         # Do not allow multiple accounts for the same approved identity.
#         already_registered = User.objects.filter(
#             Q(student_id__iexact=approved_user.student_id)
#             | Q(email__iexact=approved_user.email)
#         ).exists()

#         if already_registered:
#             raise serializers.ValidationError({
#                 "student_id": (
#                     "An account already exists for this approved ID."
#                 )
#             })

#         # Pass the trusted database record to create().
#         attrs['_authorized_user'] = approved_user
#         return attrs

#     def create(self, validated_data):
#         validated_data.pop('password2')
#         approved_user = validated_data.pop('_authorized_user')

#         password = validated_data.pop('password')
#         username = validated_data.pop('username')
#         validated_data.pop('student_id')

#         # All identity details and the role come from the approved roster.
#         user = User.objects.create_user(
#             username=username,
#             password=password,
#             email=approved_user.email,
#             first_name=approved_user.first_name,
#             last_name=approved_user.last_name,
#             role=approved_user.role,
#             phone=approved_user.phone or '',
#             department=approved_user.department or '',
#             student_id=approved_user.student_id,
#             is_email_verified=False,
#             is_active=False,
#         )

        return user


# class RegisterSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
#     password2 = serializers.CharField(write_only=True, required=True)

#     class Meta:
#         model = User
#         fields = [
#             'username', 'email', 'password', 'password2',
#             'first_name', 'last_name', 'role', 'phone', 'department', 'student_id'
#         ]
#         extra_kwargs = {
#             'first_name': {'required': False},
#             'last_name': {'required': False},
#             'phone': {'required': True},
#             'department': {'required': False},
#             'student_id': {'required': False},
#             'role': {'required': False},
#         }

#     def validate_phone(self, value):
#         """Validate Ethiopian phone number"""
#         if not value:
#             raise serializers.ValidationError("Phone number is required for SMS verification.")

#         phone = value.strip().replace(' ', '').replace('-', '')

#         if not re.match(r'^(\+251|251|0)?[79]\d{8}$', phone):
#             raise serializers.ValidationError(
#                 "Please enter a valid Ethiopian phone number (e.g., 0912345678 or +251912345678)."
#             )

#         if User.objects.filter(phone=phone).exists():
#             raise serializers.ValidationError("This phone number is already registered.")

#         return phone

#     def validate_email(self, value):
#         """Validate email format, domain existence, and uniqueness"""
#         value = value.lower().strip()

#         try:
#             validate_email(value)
#         except ValidationError:
#             raise serializers.ValidationError("Please enter a valid email address.")

#         if '@' not in value:
#             raise serializers.ValidationError("Email must contain @ symbol.")

#         local_part, domain = value.rsplit('@', 1)

#         if len(local_part) < 2:
#             raise serializers.ValidationError("Email username is too short.")
#         if '..' in value:
#             raise serializers.ValidationError("Email cannot have consecutive dots.")
#         if local_part.startswith('.') or local_part.endswith('.'):
#             raise serializers.ValidationError("Email username cannot start or end with a dot.")

#         if '.' not in domain:
#             raise serializers.ValidationError("Email domain is not valid.")
#         tld = domain.split('.')[-1]
#         if len(tld) < 2:
#             raise serializers.ValidationError("Email must have a valid domain (e.g., .com, .org, .edu).")

#         blocked_domains = [
#             'tempmail.com', 'throwaway.com', 'guerrillamail.com',
#             'mailinator.com', '10minutemail.com', 'temp-mail.org',
#             'fakeinbox.com', 'trashmail.com', 'yopmail.com',
#             'example.com', 'example.org', 'example.net',
#             'test.com', 'test.org', 'localhost', 'invalid.com',
#             'fake.com', 'dummy.com', 'maildrop.cc', 'sharklasers.com',
#             'getnada.com', 'dispostable.com', 'mintemail.com',
#             'guerrillamailblock.com', 'grr.la', 'tempinbox.com',
#             'spamgourmet.com', 'trashmail.net', 'mailnesia.com',
#             'gmial.com', 'gmai.com', 'gamil.com', 'gmaill.com',
#             'yaho.com', 'yahooo.com', 'outlok.com', 'outloo.com',
#             'tempr.email', 'discard.email', 'mailcatch.com',
#             'mailexpire.com', 'mailforspam.com', 'spambox.us',
#             'spamfree24.org', 'tempemail.net', 'tempail.com',
#             'throwawaymail.com', 'wegwerfmail.de', 'trash-mail.com',
#             'mytrashmail.com', 'notreal.com', 'notanemail.com',
#             'random.com', 'asdf.com', 'qwerty.com', 'abc.com',
#             'xyz.com', 'foo.com', 'bar.com', 'domain.com',
#             'email.com', 'test.test', 'sample.com', 'noemail.com',
#         ]

#         if domain in blocked_domains:
#             typo_map = {
#                 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com',
#                 'gamil.com': 'gmail.com', 'gmaill.com': 'gmail.com',
#                 'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com',
#                 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com',
#                 'gmail.con': 'gmail.com', 'gmail.comm': 'gmail.com',
#                 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
#                 'hotmil.com': 'hotmail.com', 'yaho.com': 'yahoo.com',
#                 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
#                 'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
#                 'outlook.co': 'outlook.com',
#             }
#             if domain in typo_map:
#                 raise serializers.ValidationError(
#                     f"Did you mean {local_part}@{typo_map[domain]}? Please use a real email address."
#                 )
#             raise serializers.ValidationError(
#                 "This email domain is not allowed. Please use a real email address."
#             )

#         # Check MX records (domain can receive email)
#         try:
#             mx_records = dns.resolver.resolve(domain, 'MX')
#             if not mx_records:
#                 raise serializers.ValidationError(
#                     "This email domain cannot receive emails. Please use a real, working email."
#                 )
#         except dns.resolver.NXDOMAIN:
#             raise serializers.ValidationError(
#                 "This email domain does not exist. Please check your email address."
#             )
#         except dns.resolver.NoAnswer:
#             try:
#                 dns.resolver.resolve(domain, 'A')
#             except Exception:
#                 raise serializers.ValidationError(
#                     "This email domain cannot receive emails. Please use a real, working email."
#                 )
#         except (dns.resolver.Timeout, Exception):
#             pass

#         if User.objects.filter(email__iexact=value).exists():
#             raise serializers.ValidationError(
#                 "A user with this email already exists. Please login or use a different email."
#             )

#         return value

#     def validate_username(self, value):
#         if User.objects.filter(username__iexact=value).exists():
#             raise serializers.ValidationError("This username is already taken.")

#         if len(value) < 3:
#             raise serializers.ValidationError("Username must be at least 3 characters long.")

#         if not re.match(r'^[a-zA-Z0-9_]+$', value):
#             raise serializers.ValidationError(
#                 "Username can only contain letters, numbers, and underscores."
#             )

#         return value

#     def validate(self, attrs):
#         if attrs['password'] != attrs['password2']:
#             raise serializers.ValidationError({"password": "Passwords do not match."})
#         return attrs

#     def create(self, validated_data):
#         validated_data.pop('password2')

#         if 'role' not in validated_data:
#             validated_data['role'] = 'student'

#         # ✅ Account starts UNVERIFIED and INACTIVE
#         # The account will only become usable after OTP verification
#         validated_data['is_email_verified'] = False
#         validated_data['is_active'] = False

#         user = User.objects.create_user(**validated_data)
#         return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(**data)
        if user and user.is_active:
            # Log login activity
            try:
                request = self.context.get('request')
                UserActivityLog.objects.create(
                    user=user,
                    action='login',
                    ip_address=request.META.get('REMOTE_ADDR') if request else None,
                    user_agent=request.META.get('HTTP_USER_AGENT') if request else None
                )
            except Exception:
                pass
            return user
        raise serializers.ValidationError("Incorrect Credentials")


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(
        required=True, min_length=8, validators=[validate_password]
    )

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Incorrect old password")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.lower().strip()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True, max_length=6)
    new_password = serializers.CharField(
        required=True, min_length=8, validators=[validate_password]
    )

    def validate_email(self, value):
        return value.lower().strip()


class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.lower().strip()


class UserActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserActivityLog
        fields = ['id', 'user', 'user_name', 'action', 'description', 'ip_address', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserStatisticsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    active_users = serializers.IntegerField()
    verified_users = serializers.IntegerField()
    roles_distribution = serializers.DictField()
    new_users_this_month = serializers.IntegerField()
    new_users_today = serializers.IntegerField()
