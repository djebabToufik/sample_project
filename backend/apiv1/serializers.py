"""Serializers of the CMMS API. Fields are listed explicitly; users are only sent with their public fields."""

from django.contrib.auth.models import User
from django.core import signing
from django.urls import reverse
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from core.fields import OrganizationPrimaryKeyRelatedField
from core.organization import ADMIN, REPORTER
from core.serializers import OrganizationSerializer, UserSerializer
from core.validators import IMAGE_UPLOAD_VALIDATORS, PDF_UPLOAD_VALIDATORS
from db.models import Asset, MaintenancePlan, UserProfile

MEDIA_TOKEN_MAX_AGE_SECONDS = 60 * 30
MEDIA_TOKEN_SALT = "protected-media"


def build_protected_media_url(_request, route_name, route_kwargs, token_payload):
    token = signing.dumps(token_payload, salt=MEDIA_TOKEN_SALT)
    path = reverse(route_name, kwargs=route_kwargs)
    return f"{path}?token={token}"


def build_asset_photo_url(request, asset):
    return build_protected_media_url(
        request,
        "asset-photo",
        {"pk": asset.uuid},
        {
            "kind": "asset_photo",
            "uuid": str(asset.uuid),
            "path": asset.photo.name,
        },
    )


def build_maintenance_instructions_url(request, maintenance):
    return build_protected_media_url(
        request,
        "maintenance-instructions",
        {"pk": maintenance.uuid},
        {
            "kind": "maintenance_instructions",
            "uuid": str(maintenance.uuid),
            "path": maintenance.instructions.name,
        },
    )


class UserProfileSerializer(serializers.ModelSerializer):
    """A member of the organization. Only the role and the photo can be changed."""

    user = UserSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)
    profile_photo = serializers.ImageField(required=False, validators=IMAGE_UPLOAD_VALIDATORS)
    # Invited, but no password set yet (the invitation can be sent again).
    invitation_pending = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['uuid', 'created_at', 'updated_at', 'user', 'organization', 'profile_photo', 'type']
        fields += ['invitation_pending']
        read_only_fields = ['uuid', 'created_at', 'updated_at']

    def get_invitation_pending(self, profile):
        return profile.user is not None and not profile.user.has_usable_password()

    def validate_type(self, value):
        request = self.context.get('request')
        if self.instance and request and self.instance.user_id == request.user.id and value != ADMIN:
            raise serializers.ValidationError('You cannot remove your own administrator role.')
        return value


class UserInviteSerializer(serializers.Serializer):
    """A new user invited into the organization (the view creates the account and sends the email)."""

    username = serializers.CharField(
        max_length=150,
        validators=[UniqueValidator(User.objects.all(), message='This username is already taken.')],
    )
    email = serializers.EmailField(
        validators=[UniqueValidator(User.objects.all(), message='E-mail already exist', lookup='iexact')],
    )
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    type = serializers.ChoiceField(choices=[ADMIN, REPORTER])


class AssetSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    photo = serializers.ImageField(required=False, validators=IMAGE_UPLOAD_VALIDATORS)

    class Meta:
        model = Asset
        fields = [
            'uuid',
            'organization',
            'name',
            'ref',
            'created_by',
            'created_at',
            'last_updated_at',
            'photo',
            'purchase_date',
            'asset_type',
            'location',
            'serial_number',
            'warranty_expiration_date',
            'running_hour_consumption_kw',
            'on_hour_consumption_kw',
            'running_hour_cost',
            'on_hour_cost',
            'cost',
            'current_value',
            'status',
            'state',
        ]
        # `state` follows the line events (state/models.py), it is not edited directly.
        read_only_fields = ['uuid', 'created_at', 'last_updated_at', 'state']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")

        if instance.photo:
            representation["photo"] = build_asset_photo_url(request, instance)

        return representation


MAINTENANCE_FIELDS = [
    'uuid',
    'created_at',
    'updated_at',
    'name',
    'ref',
    'created_by',
    'assigned_to',
    'asset',
    'planned_starting_date',
    'planned_finished',
    'started_at',
    'finished_at',
    'instructions',
    'type',
    'priority',
    'status',
    'estimated_cost',
]


class MaintenancePlanSerializer(serializers.ModelSerializer):
    """Read: users and the asset as nested objects."""

    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    asset = AssetSerializer(read_only=True)

    class Meta:
        model = MaintenancePlan
        fields = MAINTENANCE_FIELDS
        read_only_fields = MAINTENANCE_FIELDS

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")

        if instance.instructions:
            representation["instructions"] = build_maintenance_instructions_url(
                request,
                instance,
            )

        return representation


class MaintenancePlanSerializerWrite(serializers.ModelSerializer):
    """Create / change a plan (administrators). Asset and assignee must belong to the organization."""

    asset = OrganizationPrimaryKeyRelatedField(queryset=Asset.objects.all())
    assigned_to = OrganizationPrimaryKeyRelatedField(
        queryset=User.objects.all(),
        organization_lookup='userprofile__organization',
        required=False,
        allow_null=True,
    )
    instructions = serializers.FileField(required=False, validators=PDF_UPLOAD_VALIDATORS)

    class Meta:
        model = MaintenancePlan
        fields = MAINTENANCE_FIELDS
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'created_by']


class MaintenanceProgressSerializer(serializers.ModelSerializer):
    """What an operator changes on a plan assigned to them: start, pause, finish, cancel."""

    class Meta:
        model = MaintenancePlan
        fields = ['uuid', 'status', 'started_at', 'finished_at']
        read_only_fields = ['uuid']
