"""
OTP (One-Time Password) helpers for Email and SMS 2FA.

Email:  Uses Django's built-in email backend (configure EMAIL_* in settings).
SMS:    Pluggable — implement send_sms() for your provider (Twilio, SMSAPI, etc.).
        By default it logs the code to console (useful in dev / when no SMS gateway).
"""
import logging
import random
import string
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)

OTP_LENGTH  = 6
OTP_EXPIRES = 10  # minutes


def generate_otp() -> str:
    """Generate a random 6-digit numeric OTP."""
    return ''.join(random.choices(string.digits, k=OTP_LENGTH))


def set_otp(user, otp_type: str) -> str:
    """Generate and store OTP on the user. Returns the code."""
    code = generate_otp()
    user.otp_code    = code
    user.otp_type    = otp_type
    user.otp_expires = timezone.now() + timedelta(minutes=OTP_EXPIRES)
    user.save(update_fields=['otp_code', 'otp_type', 'otp_expires'])
    return code


def verify_otp(user, code: str, otp_type: str) -> bool:
    """Verify OTP code. Returns True on success and clears the stored code."""
    if not user.otp_code or user.otp_type != otp_type:
        return False
    if not user.otp_expires or timezone.now() > user.otp_expires:
        return False
    if user.otp_code != code.strip():
        return False
    # Clear after successful use
    user.otp_code    = ''
    user.otp_type    = ''
    user.otp_expires = None
    user.save(update_fields=['otp_code', 'otp_type', 'otp_expires'])
    return True


# ─── Email ────────────────────────────────────────────────────────────────────

def send_email_otp(user, code: str):
    """Send OTP via email. Uses Django's EMAIL_* settings."""
    subject = '[SobNet] Twój kod weryfikacyjny 2FA'
    body = (
        f'Cześć {user.first_name or user.username},\n\n'
        f'Twój jednorazowy kod weryfikacyjny:\n\n'
        f'    {code}\n\n'
        f'Kod jest ważny przez {OTP_EXPIRES} minut.\n\n'
        f'Jeśli nie prosiłeś o ten kod, zignoruj tę wiadomość.\n\n'
        f'-- SobNet'
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sobnet.local'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info('Email OTP sent to %s', user.email)
    except Exception as exc:
        logger.error('Failed to send email OTP to %s: %s', user.email, exc)
        raise


# ─── SMS ─────────────────────────────────────────────────────────────────────

def send_sms_otp(user, code: str):
    """
    Send OTP via SMS.

    Configure your SMS gateway by setting SMS_BACKEND in Django settings:

    Option 1 — Twilio (pip install twilio):
        SMS_BACKEND = 'twilio'
        TWILIO_ACCOUNT_SID = 'ACxxx'
        TWILIO_AUTH_TOKEN  = 'xxx'
        TWILIO_FROM_NUMBER = '+48xxxxxxxxx'

    Option 2 — SMSApi.pl (pip install smsapi-python-client):
        SMS_BACKEND = 'smsapi'
        SMSAPI_TOKEN = 'xxx'
        SMSAPI_FROM  = 'SOBNET'

    Default (no config): logs code to console.
    """
    message = f'[SobNet] Kod 2FA: {code}  (wazny {OTP_EXPIRES} min)'
    backend = getattr(settings, 'SMS_BACKEND', 'console')

    if backend == 'twilio':
        _send_twilio(user.phone_number, message)
    elif backend == 'smsapi':
        _send_smsapi(user.phone_number, message)
    else:
        # Console fallback — print code so dev can see it
        logger.warning(
            '⚠️  SMS_BACKEND not configured — SMS OTP for %s (%s): %s',
            user.username, user.phone_number, code,
        )
        print(f'\n[DEV] SMS OTP → {user.phone_number}: {code}\n')


def _send_twilio(phone: str, message: str):
    try:
        from twilio.rest import Client  # type: ignore
        from django.conf import settings as s
        client = Client(s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN)
        client.messages.create(body=message, from_=s.TWILIO_FROM_NUMBER, to=phone)
        logger.info('SMS OTP sent via Twilio to %s', phone)
    except ImportError:
        raise RuntimeError('Twilio not installed. Run: pip install twilio')
    except Exception as exc:
        logger.error('Twilio SMS failed to %s: %s', phone, exc)
        raise


def _send_smsapi(phone: str, message: str):
    try:
        from smsapi.client import SmsApiPlClient  # type: ignore
        from django.conf import settings as s
        client = SmsApiPlClient(access_token=s.SMSAPI_TOKEN)
        client.sms.send(
            to=phone,
            message=message,
            sender=getattr(s, 'SMSAPI_FROM', 'SOBNET'),
        )
        logger.info('SMS OTP sent via SMSApi to %s', phone)
    except ImportError:
        raise RuntimeError('smsapi-python-client not installed. Run: pip install smsapi-python-client')
    except Exception as exc:
        logger.error('SMSApi send failed to %s: %s', phone, exc)
        raise
