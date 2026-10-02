import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def normalize_phone(phone):
    """Normalize Ethiopian phone number to E.164 format"""
    if not phone:
        return None

    phone = str(phone).strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')

    if phone.startswith('0'):
        phone = '+251' + phone[1:]
    elif not phone.startswith('+'):
        if len(phone) == 9 and phone[0] in '79':
            phone = '+251' + phone
        else:
            phone = '+' + phone

    return phone


def send_sms(phone_number, message):
    """Send SMS using the configured provider"""
    if not phone_number:
        logger.warning("No phone number provided for SMS")
        return False

    phone = normalize_phone(phone_number)
    if not phone:
        logger.error(f"Invalid phone number: {phone_number}")
        return False

    provider = getattr(settings, 'SMS_PROVIDER', 'africastalking')

    try:
        if provider == 'africastalking':
            return _send_via_africastalking(phone, message)
        elif provider == 'twilio':
            return _send_via_twilio(phone, message)
        else:
            logger.error(f"Unknown SMS provider: {provider}")
            return False
    except Exception as e:
        logger.error(f"SMS send failed to {phone}: {str(e)}")
        return False


def _send_via_africastalking(phone, message):
    """Send SMS via Africa's Talking"""
    try:
        import africastalking
        
        # ✅ Read environment from settings
        environment = getattr(settings, 'AT_ENVIRONMENT', 'sandbox')
        username = getattr(settings, 'AT_USERNAME', 'sandbox')
        api_key = getattr(settings, 'AT_API_KEY', '')
        
        logger.info(f"[AT] Initializing: username={username}, env={environment}, phone={phone}")
        
        africastalking.initialize(
            username=username,
            api_key=api_key,
            # ✅ Some SDK versions accept environment here:
            # environment=environment,  # only if your SDK version supports it
        )
        
        sms = africastalking.SMS
        sender_id = getattr(settings, 'AT_SENDER_ID', None)
        
        # ✅ In sandbox, sender_id MUST be None or it may fail
        if environment == 'sandbox':
            sender_id = None
        
        response = sms.send(
            message,
            [phone],
            sender_id=sender_id,
        )
        
        # ✅ IMPORTANT: Check the actual response, not just "no exception"
        logger.info(f"[AT] Response: {response}")
        
        # AT returns {'SMSMessageData': {'Recipients': [{'status': 'Success'|'Failed', ...}]}}
        recipients = response.get('SMSMessageData', {}).get('Recipients', [])
        if not recipients:
            logger.error(f"[AT] No recipients in response: {response}")
            return False
        
        for r in recipients:
            status_code = r.get('statusCode')
            status_msg = r.get('status')
            logger.info(f"[AT] Recipient {r.get('number')}: {status_msg} (code={status_code})")
            if status_code != 101 and status_msg != 'Success':
                # 101 = Success in AT
                logger.error(f"[AT] Delivery failed: {status_msg}")
                return False
        
        return True
    except Exception as e:
        logger.error(f"[AT] Africa's Talking error: {str(e)}", exc_info=True)
        return False


def _send_via_twilio(phone, message):
    """Send SMS via Twilio"""
    try:
        from twilio.rest import Client
        client = Client(
            getattr(settings, 'TWILIO_ACCOUNT_SID', ''),
            getattr(settings, 'TWILIO_AUTH_TOKEN', ''),
        )
        msg = client.messages.create(
            body=message,
            from_=getattr(settings, 'TWILIO_PHONE_NUMBER', ''),
            to=phone,
        )
        logger.info(f"SMS sent via Twilio to {phone}")
        return True
    except Exception as e:
        logger.error(f"Twilio error: {str(e)}")
        return False