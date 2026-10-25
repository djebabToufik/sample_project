"""Account endpoints: session (login, logout, current user), sign-up, password reset and change."""

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django_rest_passwordreset.views import (
    ResetPasswordConfirm,
    ResetPasswordRequestToken,
    ResetPasswordValidateToken,
)
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apiv1.serializers import UserProfileSerializer
from core.authentication import SessionAuthentication
from core.organization import get_profile, is_demo_account

from .serializers import (
    AcceptInvitationSerializer,
    ChangePasswordSerializer,
    InvitationSerializer,
    LoginSerializer,
    SignupSerializer,
)


class SignupAllowed(BasePermission):
    message = 'Sign-up is disabled. Ask an administrator for an invitation.'

    def has_permission(self, request, view):
        return settings.ALLOW_SIGNUP


def session_body(request):
    """{"profile": ...} of the logged-in user; the profile is null for users without one (superusers)."""
    profile = get_profile(request.user)
    return {'profile': UserProfileSerializer(profile, context={'request': request}).data if profile else None}


@method_decorator(ensure_csrf_cookie, name='dispatch')
class SessionView(APIView):
    """GET: the logged-in user (401 when logged out). Also sets the csrftoken cookie for the next requests."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(session_body(request))


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    """POST username + password: starts a session (HttpOnly cookie) and answers like SessionView."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            return Response({'detail': 'Username or password are wrong'}, status=status.HTTP_400_BAD_REQUEST)
        # New session id and CSRF token (no session fixation).
        login(request, user)
        return Response(session_body(request))


class LogoutView(APIView):
    """POST: ends the session on the server."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationView(APIView):
    """GET ?uid=&token=: who the invitation link is for (shown on the welcome page), or 400."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'invitation'

    def get(self, request):
        serializer = InvitationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return Response(
            {
                'username': user.username,
                'first_name': user.first_name,
                'organization': user.userprofile.organization.name,
            }
        )


@method_decorator(csrf_protect, name='dispatch')
class AcceptInvitationView(APIView):
    """POST uid, token, password, password2: sets the password and logs the user in (like LoginView)."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'invitation'

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        return Response(session_body(request))


class PublicSettingsView(APIView):
    """GET: what the public pages need to know before login (e.g. whether sign-up is open)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        body = {'signup': settings.ALLOW_SIGNUP}
        if settings.DEMO_USERNAME and settings.DEMO_PASSWORD:
            body['demo'] = {'username': settings.DEMO_USERNAME, 'password': settings.DEMO_PASSWORD}
        return Response(body)


class SignupView(generics.CreateAPIView):
    """Create an account with a new organization (turned off with OEE_ALLOW_SIGNUP=False)."""

    serializer_class = SignupSerializer
    authentication_classes = []
    permission_classes = [SignupAllowed]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'signup'


DEMO_ACCOUNT_LOCKED = 'The demo account cannot be changed: it is shared by every visitor.'


class ChangePassword(generics.GenericAPIView):
    """Change the own password. Other sessions of the user end; the current one stays logged in."""

    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if is_demo_account(request.user):
            return Response({'detail': DEMO_ACCOUNT_LOCKED}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if isinstance(request.successful_authenticator, SessionAuthentication):
            update_session_auth_hash(request, user)
        return Response({'success': 'updated'}, status=status.HTTP_200_OK)


# Password reset: the package's views with their own throttle scopes (rates in settings.py).
# The request view takes its throttle from DJANGO_REST_PASSWORDRESET_THROTTLE_CLASSES.
# A new password ends every session of the user (Django checks the password hash per session).
PasswordResetRequestView = ResetPasswordRequestToken


class PasswordResetConfirmView(ResetPasswordConfirm):
    throttle_classes = [ScopedRateThrottle]


class PasswordResetValidateTokenView(ResetPasswordValidateToken):
    throttle_classes = [ScopedRateThrottle]
