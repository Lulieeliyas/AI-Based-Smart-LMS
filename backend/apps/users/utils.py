from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from .models import EmailVerification, PasswordResetToken
from .sms_utils import send_sms
import logging
import random
import string

logger = logging.getLogger(__name__)


def generate_otp(length=6):
    """Generate a random 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(user, otp, purpose='verification'):
    """Send OTP via email"""
    try:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

        if purpose == 'verification':
            subject = 'Verify Your Email - Library Management System'
            template = 'email/email_verification.html'
            title = 'Email Verification'
        else:
            subject = 'Password Reset OTP - Library Management System'
            template = 'email/password_reset.html'
            title = 'Password Reset'

        context = {
            'user': user,
            'otp': otp,
            'title': title,
            'expires_in': '24 hours',
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
        email.attach_alternative(html_message, "text/html")
        email.send(fail_silently=False)

        logger.info(f"OTP email sent to {user.email} for {purpose}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {user.email}: {str(e)}")
        return False


def send_otp_sms(user, otp, purpose='verification'):
    """Send OTP via SMS"""
    try:
        if not user.phone:
            logger.warning(f"No phone number for user {user.email}")
            return False

        if purpose == 'verification':
            message = (
                f"Library System: Your verification OTP is {otp}. "
                f"It expires in 24 hours. Do not share this code."
            )
        else:
            message = (
                f"Library System: Your password reset OTP is {otp}. "
                f"It expires in 24 hours. Do not share this code."
            )

        return send_sms(user.phone, message)
    except Exception as e:
        logger.error(f"Failed to send OTP SMS to {user.phone}: {str(e)}")
        return False


def send_otp_both(user, otp, purpose='verification'):
    """Send the SAME OTP via BOTH email and SMS"""
    email_sent = send_otp_email(user, otp, purpose)
    sms_sent = send_otp_sms(user, otp, purpose)

    logger.info(
        f"OTP delivery for {user.email}: email={email_sent}, sms={sms_sent}"
    )
    return email_sent or sms_sent


def create_email_verification(user):
    """Create verification OTP and send via BOTH email and SMS"""
    try:
        # Delete old verification
        EmailVerification.objects.filter(user=user).delete()

        # ✅ Generate ONE OTP for both channels
        otp = generate_otp(6)

        verification = EmailVerification.objects.create(user=user, otp=otp)

        # ✅ Send the SAME OTP via email AND SMS
        send_otp_both(user, otp, purpose='verification')

        return verification
    except Exception as e:
        logger.error(f"Error in create_email_verification: {str(e)}")
        return None


def create_password_reset_token(user):
    """Create password reset OTP and send via BOTH email and SMS"""
    try:
        PasswordResetToken.objects.filter(user=user, used=False).delete()

        # ✅ ONE OTP for both channels
        otp = generate_otp(6)
        reset_token = PasswordResetToken.objects.create(user=user, otp=otp)

        # ✅ Send the SAME OTP via email AND SMS
        send_otp_both(user, otp, purpose='password_reset')

        return reset_token
    except Exception as e:
        logger.error(f"Error in create_password_reset_token: {str(e)}")
        raise