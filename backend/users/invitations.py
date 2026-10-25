"""
Invitations: a new user gets an email with a personal link to set their own password.

The link carries the user id and a token from Django's password-reset token generator. The token
depends on the account's password and last login, so it stops working once the password is set,
and it expires after PASSWORD_RESET_TIMEOUT (OEE_INVITATION_DAYS). Nothing is stored for it.
"""

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from core.organization import get_profile


def is_pending(user):
    """Invited, but no password set yet."""
    return not user.has_usable_password()


def invitation_link(request, user):
    app_url = settings.APP_URL or request.build_absolute_uri('/').rstrip('/')
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f'{app_url}/invitation?uid={uid}&token={token}'


def send_invitation(request, user):
    """Emails the invitation link to `user` (raises OSError when the email cannot be sent)."""
    inviter = f'{request.user.first_name} {request.user.last_name}'.strip() or request.user.username
    days = settings.PASSWORD_RESET_TIMEOUT // (24 * 60 * 60)
    text = (
        f'Hello {user.first_name} {user.last_name},\n'
        f'You have been invited to {settings.APP_NAME} as a new user.\n'
        f'Your username is: {user.username}\n'
        f'Set your password here (the link works once and expires in {days} days):\n'
        f'{invitation_link(request, user)}\n'
    )
    send_mail(f'Invitation from: {inviter}', text, settings.EMAIL_HOST_USER, [user.email])


def user_from_link(uid, token):
    """The invited user the link belongs to, or None (broken, used or expired link)."""
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None
    if not user.is_active or not is_pending(user) or get_profile(user) is None:
        return None
    if not default_token_generator.check_token(user, token):
        return None
    return user
