import logging
import random
import string

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from .models import EmailVerification, PasswordResetToken
from .sms_utils import send_sms

logger = logging.getLogger(__name__)


def generate_otp(length=6):
    """Generate a numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(user, otp, purpose='verification'):
    """Send an OTP to the user's email address."""
    try:
        frontend_url = getattr(
            settings,
            'FRONTEND_URL',
            'http://localhost:5173',
        )

        if purpose == 'verification':
            subject = 'Verify Your Email - Library Management System'
            template = 'email/email_verification.html'
            title = 'Email Verification'
            expiry_minutes = settings.OTP_EXPIRY_MINUTES
            expires_in = f'{expiry_minutes} minutes'
        else:
            subject = 'Password Reset OTP - Library Management System'
            template = 'email/password_reset.html'
            title = 'Password Reset'

            # Password-reset expiry is controlled by its own model.
            # Keep the existing message until that expiry is verified.
            expires_in = '24 hours'

        context = {
            'user': user,
            'otp': otp,
            'title': title,
            'expires_in': expires_in,
            'frontend_url': frontend_url,
        }

        html_message = render_to_string(template, context)
        plain_message = strip_tags(html_message)

        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        email.attach_alternative(html_message, 'text/html')
        email.send(fail_silently=False)

        logger.info(
            'OTP email accepted by email backend for %s (%s)',
            user.email,
            purpose,
        )
        return True

    except Exception:
        logger.exception(
            'Failed to send OTP email to %s (%s)',
            getattr(user, 'email', 'unknown'),
            purpose,
        )
        return False


def send_otp_sms(user, otp, purpose='verification'):
    """Send an OTP by SMS."""
    try:
        if not user.phone:
            logger.warning(
                'No phone number for user %s',
                getattr(user, 'email', 'unknown'),
            )
            return False

        if purpose == 'verification':
            expiry_minutes = settings.OTP_EXPIRY_MINUTES
            message = (
                f'Library System: Your verification OTP is {otp}. '
                f'It expires in {expiry_minutes} minutes. '
                'Do not share this code.'
            )
        else:
            message = (
                f'Library System: Your password reset OTP is {otp}. '
                'It expires in 24 hours. Do not share this code.'
            )

        return bool(send_sms(user.phone, message))

    except Exception:
        logger.exception(
            'Failed to send OTP SMS to %s',
            getattr(user, 'phone', 'unknown'),
        )
        return False


def send_otp_both(user, otp, purpose='verification'):
    """
    Send the same OTP by email and SMS.

    Returns True if at least one delivery channel reports success.
    """
    email_sent = send_otp_email(user, otp, purpose)
    sms_sent = send_otp_sms(user, otp, purpose)

    logger.info(
        'OTP delivery results for %s (%s): email=%s, sms=%s',
        getattr(user, 'email', 'unknown'),
        purpose,
        email_sent,
        sms_sent,
    )

    return email_sent or sms_sent


def create_email_verification(user):
    """Create a verification OTP and deliver it by email and/or SMS."""
    verification = None

    try:
        # Remove any previously issued verification OTP.
        EmailVerification.objects.filter(user=user).delete()

        # Generate one OTP for both delivery channels.
        otp = generate_otp(6)

        verification = EmailVerification.objects.create(
            user=user,
            otp=otp,
        )

        # Accept delivery if at least one channel succeeds.
        delivered = send_otp_both(
            user,
            otp,
            purpose='verification',
        )

        if not delivered:
            verification.delete()
            logger.error(
                'OTP delivery failed through both email and SMS.'
            )
            return None

        return verification

    except Exception:
        logger.exception(
            'Error creating email verification for %s',
            getattr(user, 'email', 'unknown'),
        )

        if verification is not None:
            try:
                verification.delete()
            except Exception:
                logger.exception(
                    'Failed to clean up verification OTP.'
                )

        return None


def create_password_reset_token(user):
    """Create a password-reset OTP and send it by email and/or SMS."""
    try:
        PasswordResetToken.objects.filter(
            user=user,
            used=False,
        ).delete()

        otp = generate_otp(6)

        reset_token = PasswordResetToken.objects.create(
            user=user,
            otp=otp,
        )

        delivered = send_otp_both(
            user,
            otp,
            purpose='password_reset',
        )

        if not delivered:
            reset_token.delete()
            logger.error(
                'Password-reset OTP delivery failed through both channels.'
            )
            return None

        return reset_token

    except Exception:
        logger.exception(
            'Error creating password-reset token for %s',
            getattr(user, 'email', 'unknown'),
        )
        return None