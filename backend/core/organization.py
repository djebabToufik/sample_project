"""Who belongs to which organization, and with which role."""

from django.conf import settings

from db.models import UserProfile

ADMIN = 'Admin'
REPORTER = 'Reporter'


def get_profile(user):
    """The user's profile, or None (logged out, or a user without a profile such as a superuser)."""
    if user is None or not user.is_authenticated:
        return None
    try:
        return user.userprofile
    except UserProfile.DoesNotExist:
        return None


def get_organization(user):
    """The organization the user works in, or None."""
    profile = get_profile(user)
    return profile.organization if profile else None


def is_admin(user):
    profile = get_profile(user)
    return profile is not None and profile.type == ADMIN


def is_demo_account(user):
    """The public demo account (settings.DEMO_USERNAME), which may not change its own account."""
    return bool(settings.DEMO_USERNAME) and getattr(user, 'username', None) == settings.DEMO_USERNAME
