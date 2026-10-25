"""Views of the CMMS API. Every queryset is limited to the user's organization (OrganizationScopedMixin)."""

import logging
import mimetypes
import os
from urllib.parse import quote

from django.contrib.auth.models import User
from django.core import signing
from django.db import transaction
from django.db.models import ProtectedError
from django.http import Http404, HttpResponse
from django.utils.encoding import iri_to_uri
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import PlanLimitReached
from core.mixins import OrganizationScopedMixin
from core.organization import get_organization, is_admin, is_demo_account
from core.permissions import (
    CanUpdateAssignedMaintenance,
    IsAdminOrReadOnly,
    IsOrganizationAdmin,
)
from db.models import Asset, MaintenancePlan, UserProfile
from users.invitations import is_pending, send_invitation

from .serializers import (
    MEDIA_TOKEN_MAX_AGE_SECONDS,
    MEDIA_TOKEN_SALT,
    AssetSerializer,
    MaintenancePlanSerializer,
    MaintenancePlanSerializerWrite,
    MaintenanceProgressSerializer,
    UserInviteSerializer,
    UserProfileSerializer,
)

logger = logging.getLogger(__name__)


def user_can_access_organization(request, organization):
    user_organization = get_organization(request.user)
    return user_organization is not None and user_organization == organization


def validate_media_token(request, expected_kind, expected_uuid, expected_path):
    token = request.query_params.get("token")

    if not token:
        return False

    try:
        payload = signing.loads(
            token,
            salt=MEDIA_TOKEN_SALT,
            max_age=MEDIA_TOKEN_MAX_AGE_SECONDS,
        )
    except signing.BadSignature:
        return False

    return (
        payload.get("kind") == expected_kind
        and payload.get("uuid") == str(expected_uuid)
        and payload.get("path") == expected_path
    )


def protected_file_response(media_path, as_attachment=False):
    content_type, _encoding = mimetypes.guess_type(media_path)
    content_type = content_type or "application/octet-stream"
    filename = os.path.basename(media_path)
    disposition = "attachment" if as_attachment else "inline"

    response = HttpResponse(content_type=content_type)
    response["X-Accel-Redirect"] = iri_to_uri(f"/protected-media/{media_path}")
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Disposition"] = f"{disposition}; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"
    return response


class AssetViewSet(OrganizationScopedMixin, viewsets.ModelViewSet):
    """Assets of the organization. Members read, administrators change."""

    queryset = Asset.objects.select_related('organization', 'created_by').order_by('-created_at')
    serializer_class = AssetSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        organization = self.get_organization()
        if Asset.objects.filter(organization=organization).count() >= organization.max_assets:
            raise PlanLimitReached('You reached your max line possible')
        serializer.save(organization=organization, created_by=self.request.user)

    def perform_destroy(self, instance):
        # Its events, cells and faults go with it; its maintenance plans keep it (PROTECT).
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {
                    'detail': 'This asset has maintenance plans. '
                    'Retire it instead (status Retired), or delete its plans first.'
                }
            ) from None


class MaintenancePlanViewSet(OrganizationScopedMixin, viewsets.ModelViewSet):
    """
    Maintenance plans of the organization. Every member reads them (users and asset nested);
    administrators create and change them; other members only update status and start /
    finish times of the plans assigned to them.
    """

    # The nested asset brings its organization and creator.
    queryset = MaintenancePlan.objects.select_related(
        'asset', 'asset__organization', 'asset__created_by', 'assigned_to', 'created_by'
    )
    organization_lookup = 'asset__organization'

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return super().get_permissions()
        return [(IsOrganizationAdmin | CanUpdateAssignedMaintenance)()]

    def get_serializer_class(self):
        if self.request.method in SAFE_METHODS:
            return MaintenancePlanSerializer
        if is_admin(self.request.user):
            return MaintenancePlanSerializerWrite
        return MaintenanceProgressSerializer

    @action(detail=False)
    def mine(self, request):
        """The open plans assigned to the user (operator view)."""
        plans = self.get_queryset().filter(assigned_to=request.user).exclude(status__in=MaintenancePlan.CLOSED_STATUSES)
        return Response(self.get_serializer(plans, many=True).data)

    def perform_create(self, serializer):
        organization = self.get_organization()
        orders = (
            MaintenancePlan.objects.filter(asset__organization=organization)
            .exclude(status__in=MaintenancePlan.CLOSED_STATUSES)
            .count()
        )
        if orders >= organization.max_active_orders:
            raise PlanLimitReached('You reached your max Orders possible')
        serializer.save(created_by=self.request.user)


class UserProfileViewSet(
    OrganizationScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Members of the organization (administrators only). Creating one emails an invitation link."""

    queryset = UserProfile.objects.select_related('user', 'organization')
    serializer_class = UserProfileSerializer
    permission_classes = [IsOrganizationAdmin]

    def create(self, request, *args, **kwargs):
        organization = self.get_organization()
        if UserProfile.objects.filter(organization=organization).count() >= organization.max_users:
            raise PlanLimitReached('You reached your max users possible')

        invite = UserInviteSerializer(data=request.data)
        invite.is_valid(raise_exception=True)
        data = invite.validated_data
        try:
            # One transaction: if the email cannot be sent, the new user is rolled back.
            with transaction.atomic():
                # No password: the user sets their own through the link in the email.
                user = User.objects.create_user(
                    username=data['username'],
                    email=data['email'],
                    password=None,
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                )
                profile = UserProfile.objects.create(type=data['type'], user=user, organization=organization)
                send_invitation(request, user)
        except OSError:  # SMTP errors
            logger.exception("Invitation email could not be sent")
            return Response(
                {"detail": "The invitation email could not be sent. Please try again later."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='resend-invitation')
    def resend_invitation(self, request, pk=None):
        """A new invitation email for a user who has not set a password yet; older links stop working."""
        user = self.get_object().user
        if not is_pending(user):
            return Response({"detail": "This user has already set a password."}, status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                user.set_unusable_password()  # changes the token: links of earlier emails expire
                user.save(update_fields=['password'])
                send_invitation(request, user)
        except OSError:
            logger.exception("Invitation email could not be sent")
            return Response(
                {"detail": "The invitation email could not be sent. Please try again later."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": "Invitation sent."})

    def perform_update(self, serializer):
        if is_demo_account(self.request.user) and serializer.instance.user_id == self.request.user.id:
            raise PermissionDenied('The demo account cannot be changed: it is shared by every visitor.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user_id == request.user.id:
            return Response({"detail": "You cannot delete your own user"}, status.HTTP_400_BAD_REQUEST)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssetPhotoView(APIView):
    """An asset photo, for members of its organization or with a signed link (see serializers)."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            asset = Asset.objects.select_related("organization").get(uuid=pk)
        except Asset.DoesNotExist:
            raise Http404 from None

        if not asset.photo:
            raise Http404

        has_valid_token = validate_media_token(
            request,
            "asset_photo",
            asset.uuid,
            asset.photo.name,
        )

        if not has_valid_token and not user_can_access_organization(request, asset.organization):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        return protected_file_response(asset.photo.name)


class MaintenanceInstructionsView(APIView):
    """A plan's instructions file, for members of its organization or with a signed link."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            maintenance = MaintenancePlan.objects.select_related("asset", "asset__organization").get(uuid=pk)
        except MaintenancePlan.DoesNotExist:
            raise Http404 from None

        if not maintenance.instructions or not maintenance.asset:
            raise Http404

        has_valid_token = validate_media_token(
            request,
            "maintenance_instructions",
            maintenance.uuid,
            maintenance.instructions.name,
        )

        if not has_valid_token and not user_can_access_organization(request, maintenance.asset.organization):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        return protected_file_response(maintenance.instructions.name, as_attachment=True)
