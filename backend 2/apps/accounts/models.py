from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.VIEWER)

    # TOTP (Google Authenticator / Aegis / Authy)
    totp_secret  = models.CharField(max_length=64, blank=True, default='')
    totp_enabled = models.BooleanField(default=False)

    # Email 2FA
    email_2fa_enabled = models.BooleanField(default=False)

    # SMS 2FA
    phone_number    = models.CharField(max_length=30, blank=True, default='')
    sms_2fa_enabled = models.BooleanField(default=False)

    # Shared OTP storage (for email / SMS codes)
    otp_code    = models.CharField(max_length=8, blank=True, default='')
    otp_expires = models.DateTimeField(null=True, blank=True)
    otp_type    = models.CharField(max_length=10, blank=True, default='')  # 'email' | 'sms'

    class Meta:
        db_table = "accounts_user"

    def __str__(self):
        return self.username

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_editor(self):
        return self.role in (self.Role.ADMIN, self.Role.EDITOR)

    @property
    def any_2fa_enabled(self):
        return self.totp_enabled or self.email_2fa_enabled or self.sms_2fa_enabled
