"""Account endpoints, under /api/auth/ (backend/urls.py)."""

from django.urls import path

from .views import (
    AcceptInvitationView,
    ChangePassword,
    InvitationView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateTokenView,
    PublicSettingsView,
    SessionView,
    SignupView,
)

urlpatterns = [
    path('session/', SessionView.as_view(), name='session'),
    path('settings/', PublicSettingsView.as_view(), name='public-settings'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('password/', ChangePassword.as_view(), name='password-change'),
    path('invitation/', InvitationView.as_view(), name='invitation'),
    path('invitation/accept/', AcceptInvitationView.as_view(), name='invitation-accept'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('password-reset/validate-token/', PasswordResetValidateTokenView.as_view(), name='password-reset-validate'),
]
