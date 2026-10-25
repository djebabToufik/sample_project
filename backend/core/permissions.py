"""
Permission classes of the API.

Data of other organizations is hidden by the views' querysets (see mixins.py), so these
classes only decide who may call a view at all, and with which methods.
"""

from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .organization import get_organization, is_admin


class IsOrganizationMember(BasePermission):
    """Logged in and linked to an organization (the default for every view)."""

    message = 'Your account is not linked to an organization.'

    def has_permission(self, request, view):
        return get_organization(request.user) is not None


class IsOrganizationAdmin(IsOrganizationMember):
    """An administrator of the organization."""

    message = 'Only administrators can do this.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and is_admin(request.user)


class IsAdminOrReadOnly(IsOrganizationMember):
    """Every member can read; only administrators can create, change or delete."""

    message = 'Only administrators can change this.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in SAFE_METHODS or is_admin(request.user)


class IsOtherSoftware(IsOrganizationMember):
    """A member authenticated with an API token (other software, e.g. the gateway), not the web app's session."""

    message = 'Only other software with an API token can do this.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and isinstance(
            request.successful_authenticator, TokenAuthentication
        )


class CanUpdateAssignedMaintenance(IsOrganizationMember):
    """A member may update (PATCH) the maintenance plans assigned to them."""

    message = 'You can only update maintenance plans assigned to you.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.method == 'PATCH'

    def has_object_permission(self, request, view, obj):
        return obj.assigned_to_id == request.user.id
