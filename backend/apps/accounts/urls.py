from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/",            views.LoginView.as_view(),              name="login"),
    path("auth/logout/",           views.LogoutView.as_view(),             name="logout"),
    path("auth/me/",               views.MeView.as_view(),                 name="me"),
    path("auth/2fa/setup/",        views.TwoFactorSetupView.as_view(),     name="2fa-setup"),
    path("auth/2fa/disable/",      views.TwoFactorDisableView.as_view(),   name="2fa-disable"),
    path("auth/2fa/admin-disable/<int:user_id>/",
         views.TwoFactorAdminDisableView.as_view(), name="2fa-admin-disable"),
    path("", include(router.urls)),
]
