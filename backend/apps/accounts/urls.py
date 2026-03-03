from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/",                views.LoginView.as_view(),              name="login"),
    path("auth/login/send-otp/",       views.LoginSendOTPView.as_view(),       name="login-send-otp"),
    path("auth/logout/",               views.LogoutView.as_view(),             name="logout"),
    path("auth/me/",                   views.MeView.as_view(),                 name="me"),

    # TOTP
    path("auth/2fa/setup/",            views.TwoFactorSetupView.as_view(),     name="2fa-setup"),
    path("auth/2fa/disable/",          views.TwoFactorDisableView.as_view(),   name="2fa-disable"),

    # Email 2FA
    path("auth/2fa/email/setup/",      views.Email2FASetupView.as_view(),      name="2fa-email-setup"),
    path("auth/2fa/email/disable/",    views.Email2FADisableView.as_view(),    name="2fa-email-disable"),

    # SMS 2FA
    path("auth/2fa/sms/setup/",        views.SMS2FASetupView.as_view(),        name="2fa-sms-setup"),
    path("auth/2fa/sms/disable/",      views.SMS2FADisableView.as_view(),      name="2fa-sms-disable"),

    # Admin
    path("auth/2fa/admin-disable/<int:user_id>/",
         views.TwoFactorAdminDisableView.as_view(), name="2fa-admin-disable"),

    path("auth/change-password/", views.ChangePasswordView.as_view(), name="change-password"),

    path("", include(router.urls)),
]
