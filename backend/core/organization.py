"""Who belongs to which organization, and with which role."""

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
