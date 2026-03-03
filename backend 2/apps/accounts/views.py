from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import User
from .serializers import UserAdminSerializer, UserMeSerializer
from .totp import generate_secret, verify_totp, get_totp_uri
from .otp import set_otp, verify_otp as verify_otp_code, send_email_otp, send_sms_otp


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set"})

    def post(self, request):
        username  = request.data.get("username")
        password  = request.data.get("password")
        totp_code = request.data.get("totp_code", "")
        otp_code  = request.data.get("otp_code", "")
        otp_type  = request.data.get("otp_type", "")  # 'totp' | 'email' | 'sms'

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        # Determine which 2FA methods are active
        has_totp  = user.totp_enabled
        has_email = user.email_2fa_enabled
        has_sms   = user.sms_2fa_enabled
        any_2fa   = has_totp or has_email or has_sms

        if any_2fa:
            # Client has not yet provided a code — ask which methods are available
            if not totp_code and not otp_code:
                return Response({
                    "detail": "2FA required",
                    "totp_required": True,
                    "methods": {
                        "totp":  has_totp,
                        "email": has_email,
                        "sms":   has_sms,
                    },
                    "email_hint": _mask_email(user.email) if has_email else None,
                    "phone_hint": _mask_phone(user.phone_number) if has_sms else None,
                }, status=status.HTTP_200_OK)

            # Verify TOTP
            if otp_type == "totp" or totp_code:
                code = totp_code or otp_code
                if not has_totp or not verify_totp(user.totp_secret, code):
                    return Response(
                        {"detail": "Invalid TOTP code", "totp_required": True},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

            # Verify Email / SMS OTP
            elif otp_type in ("email", "sms"):
                if not verify_otp_code(user, otp_code, otp_type):
                    return Response(
                        {"detail": f"Invalid or expired {otp_type.upper()} code", "totp_required": True},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            else:
                return Response(
                    {"detail": "Specify otp_type: totp | email | sms", "totp_required": True},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        login(request, user)
        return Response(UserMeSerializer(user).data)


class LoginSendOTPView(APIView):
    """
    POST /auth/login/send-otp/
    Called after successful password verification, before code entry.
    Generates and sends Email/SMS OTP for login flow.
    Body: { username, password, otp_type: 'email'|'sms' }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        otp_type = request.data.get("otp_type")

        if otp_type not in ("email", "sms"):
            return Response({"detail": "otp_type must be 'email' or 'sms'"}, status=400)

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        code = set_otp(user, otp_type)
        try:
            if otp_type == "email":
                if not user.email:
                    return Response({"detail": "No email address on file"}, status=400)
                send_email_otp(user, code)
            else:
                if not user.phone_number:
                    return Response({"detail": "No phone number on file"}, status=400)
                send_sms_otp(user, code)
        except Exception as exc:
            return Response({"detail": f"Could not send code: {exc}"}, status=500)

        return Response({"detail": f"Code sent via {otp_type}"})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)


# ─── TOTP 2FA ─────────────────────────────────────────────────────────────────

class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        secret = generate_secret()
        request.session["pending_totp_secret"] = secret
        request.session.modified = True
        uri = get_totp_uri(secret, request.user.username)
        return Response({"secret": secret, "uri": uri})

    def post(self, request):
        code   = request.data.get("code", "")
        secret = request.session.get("pending_totp_secret", "")
        if not secret:
            return Response({"detail": "No pending 2FA setup. Call GET first."}, status=400)
        if not verify_totp(secret, code):
            return Response({"detail": "Invalid code. Try again."}, status=400)
        request.user.totp_secret  = secret
        request.user.totp_enabled = True
        request.user.save(update_fields=["totp_secret", "totp_enabled"])
        del request.session["pending_totp_secret"]
        return Response({"detail": "TOTP 2FA enabled"})


class TwoFactorDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password  = request.data.get("password", "")
        totp_code = request.data.get("totp_code", "")

        if not request.user.totp_enabled:
            return Response({"detail": "TOTP 2FA is not enabled"}, status=400)
        if not request.user.check_password(password):
            return Response({"detail": "Invalid password"}, status=400)
        if not verify_totp(request.user.totp_secret, totp_code):
            return Response({"detail": "Invalid 2FA code"}, status=400)

        request.user.totp_secret  = ""
        request.user.totp_enabled = False
        request.user.save(update_fields=["totp_secret", "totp_enabled"])
        return Response({"detail": "TOTP 2FA disabled"})


# ─── Email 2FA ────────────────────────────────────────────────────────────────

class Email2FASetupView(APIView):
    """
    POST /auth/2fa/email/setup/  — send verification code to user email
    POST /auth/2fa/email/confirm/ — confirm code and enable email 2FA
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action = request.data.get("action", "send")  # 'send' | 'confirm'

        if action == "send":
            if not request.user.email:
                return Response({"detail": "Brak adresu email na koncie. Uzupełnij email w profilu."}, status=400)
            code = set_otp(request.user, "email")
            try:
                send_email_otp(request.user, code)
            except Exception as exc:
                return Response({"detail": f"Nie można wysłać emaila: {exc}"}, status=500)
            return Response({"detail": "Kod wysłany na email"})

        elif action == "confirm":
            code = request.data.get("code", "")
            if not verify_otp_code(request.user, code, "email"):
                return Response({"detail": "Nieprawidłowy lub wygasły kod"}, status=400)
            request.user.email_2fa_enabled = True
            request.user.save(update_fields=["email_2fa_enabled"])
            return Response({"detail": "Email 2FA włączony"})

        return Response({"detail": "action must be 'send' or 'confirm'"}, status=400)


class Email2FADisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get("password", "")
        if not request.user.email_2fa_enabled:
            return Response({"detail": "Email 2FA nie jest włączony"}, status=400)
        if not request.user.check_password(password):
            return Response({"detail": "Nieprawidłowe hasło"}, status=400)
        request.user.email_2fa_enabled = False
        request.user.save(update_fields=["email_2fa_enabled"])
        return Response({"detail": "Email 2FA wyłączony"})


# ─── SMS 2FA ─────────────────────────────────────────────────────────────────

class SMS2FASetupView(APIView):
    """
    POST /auth/2fa/sms/setup/
    actions: 'set_phone', 'send', 'confirm'
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action = request.data.get("action", "send")

        if action == "set_phone":
            phone = request.data.get("phone", "").strip()
            if not phone:
                return Response({"detail": "Podaj numer telefonu"}, status=400)
            request.user.phone_number = phone
            request.user.save(update_fields=["phone_number"])
            return Response({"detail": "Numer telefonu zapisany"})

        elif action == "send":
            if not request.user.phone_number:
                return Response({"detail": "Najpierw podaj numer telefonu"}, status=400)
            code = set_otp(request.user, "sms")
            try:
                send_sms_otp(request.user, code)
            except Exception as exc:
                return Response({"detail": f"Nie można wysłać SMS: {exc}"}, status=500)
            return Response({"detail": f"Kod SMS wysłany na {_mask_phone(request.user.phone_number)}"})

        elif action == "confirm":
            code = request.data.get("code", "")
            if not verify_otp_code(request.user, code, "sms"):
                return Response({"detail": "Nieprawidłowy lub wygasły kod"}, status=400)
            request.user.sms_2fa_enabled = True
            request.user.save(update_fields=["sms_2fa_enabled"])
            return Response({"detail": "SMS 2FA włączony"})

        return Response({"detail": "action must be 'set_phone', 'send', or 'confirm'"}, status=400)


class SMS2FADisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get("password", "")
        if not request.user.sms_2fa_enabled:
            return Response({"detail": "SMS 2FA nie jest włączony"}, status=400)
        if not request.user.check_password(password):
            return Response({"detail": "Nieprawidłowe hasło"}, status=400)
        request.user.sms_2fa_enabled = False
        request.user.save(update_fields=["sms_2fa_enabled"])
        return Response({"detail": "SMS 2FA wyłączony"})


# ─── Admin ────────────────────────────────────────────────────────────────────

class TwoFactorAdminDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id: int):
        if not request.user.is_admin:
            return Response({"detail": "Forbidden"}, status=403)
        try:
            target = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        target.totp_secret        = ""
        target.totp_enabled       = False
        target.email_2fa_enabled  = False
        target.sms_2fa_enabled    = False
        target.save(update_fields=["totp_secret", "totp_enabled", "email_2fa_enabled", "sms_2fa_enabled"])
        return Response({"detail": f"All 2FA disabled for {target.username}"})


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{'*' * len(local)}@{domain}"
    return f"{local[:2]}{'*' * (len(local) - 2)}@{domain}"


def _mask_phone(phone: str) -> str:
    if not phone or len(phone) < 4:
        return "***"
    return f"{'*' * (len(phone) - 3)}{phone[-3:]}"


# ─── User management ─────────────────────────────────────────────────────────

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class UserViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = UserAdminSerializer
    queryset = User.objects.all().order_by("username")

    def destroy(self, request, *args, **kwargs):
        if self.get_object() == request.user:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
