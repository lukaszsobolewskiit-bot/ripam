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


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """GET to obtain CSRF cookie before POST login."""
        return Response({"detail": "CSRF cookie set"})

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        totp_code = request.data.get("totp_code", "")

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        if user.totp_enabled:
            if not totp_code:
                # Inform client that 2FA is required
                return Response(
                    {"detail": "2FA required", "totp_required": True},
                    status=status.HTTP_200_OK,
                )
            if not verify_totp(user.totp_secret, totp_code):
                return Response(
                    {"detail": "Invalid 2FA code", "totp_required": True},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        login(request, user)
        return Response(UserMeSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)


class TwoFactorSetupView(APIView):
    """
    GET  — generuje nowy sekret TOTP i zwraca URI do QR kodu.
           Sekret jest tymczasowo zapisywany w sesji, nie w bazie.
    POST — weryfikuje kod i aktywuje 2FA dla usera.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        secret = generate_secret()
        # Tymczasowo w sesji (nie zapisujemy w bazie przed weryfikacją)
        request.session["pending_totp_secret"] = secret
        request.session.modified = True
        uri = get_totp_uri(secret, request.user.username)
        return Response({"secret": secret, "uri": uri})

    def post(self, request):
        code   = request.data.get("code", "")
        secret = request.session.get("pending_totp_secret", "")
        if not secret:
            return Response(
                {"detail": "No pending 2FA setup. Call GET first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not verify_totp(secret, code):
            return Response(
                {"detail": "Invalid code. Try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Aktywuj 2FA
        request.user.totp_secret  = secret
        request.user.totp_enabled = True
        request.user.save(update_fields=["totp_secret", "totp_enabled"])
        del request.session["pending_totp_secret"]
        return Response({"detail": "2FA enabled successfully"})


class TwoFactorDisableView(APIView):
    """Wyłącza 2FA po potwierdzeniu hasłem i kodem TOTP."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password  = request.data.get("password", "")
        totp_code = request.data.get("totp_code", "")

        if not request.user.totp_enabled:
            return Response({"detail": "2FA is not enabled"}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(password):
            return Response({"detail": "Invalid password"}, status=status.HTTP_400_BAD_REQUEST)

        if not verify_totp(request.user.totp_secret, totp_code):
            return Response({"detail": "Invalid 2FA code"}, status=status.HTTP_400_BAD_REQUEST)

        request.user.totp_secret  = ""
        request.user.totp_enabled = False
        request.user.save(update_fields=["totp_secret", "totp_enabled"])
        return Response({"detail": "2FA disabled"})


class TwoFactorAdminDisableView(APIView):
    """Admin moze wylaczyc 2FA dowolnemu uzytkownikowi (bez kodu TOTP)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id: int):
        if not request.user.is_admin:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            target = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        target.totp_secret  = ""
        target.totp_enabled = False
        target.save(update_fields=["totp_secret", "totp_enabled"])
        return Response({"detail": f"2FA disabled for {target.username}"})


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
