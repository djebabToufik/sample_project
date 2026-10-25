"""Serializers of the OEE API. Related ids are limited to the user's organization."""

from rest_framework import serializers

from apiv1.serializers import build_asset_photo_url
from core.fields import OrganizationPrimaryKeyRelatedField
from core.organization import get_organization
from db.models import Asset

from .line_states import MACHINE_STATES
from .models import Cell, Event, MachineFault, Product


class AssetEventSerializer(serializers.ModelSerializer):
    """A line as nested in cells, faults and events."""

    class Meta:
        model = Asset
        fields = [
            'uuid',
            'name',
            'ref',
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
        read_only_fields = fields

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")

        if instance.photo:
            representation["photo"] = build_asset_photo_url(request, instance)

        return representation


def line_field(**kwargs):
    """A line (asset) of the user's organization."""
    return OrganizationPrimaryKeyRelatedField(queryset=Asset.objects.all(), **kwargs)


class CellSerializer(serializers.ModelSerializer):
    machine = line_field()

    class Meta:
        model = Cell
        fields = ['uuid', 'created_at', 'updated_at', 'machine', 'name']
        read_only_fields = ['uuid', 'created_at', 'updated_at']


class MachineFaultSerializer(serializers.ModelSerializer):
    machine = line_field()

    class Meta:
        model = MachineFault
        fields = ['uuid', 'created_at', 'updated_at', 'name', 'machine']
        read_only_fields = ['uuid', 'created_at', 'updated_at']


class CellSerializerRead(serializers.ModelSerializer):
    machine = AssetEventSerializer(read_only=True)

    class Meta:
        model = Cell
        fields = ['uuid', 'created_at', 'updated_at', 'machine', 'name']
        read_only_fields = fields


class MachineFaultSerializerRead(serializers.ModelSerializer):
    machine = AssetEventSerializer(read_only=True)

    class Meta:
        model = MachineFault
        fields = ['uuid', 'created_at', 'updated_at', 'name', 'machine']
        read_only_fields = fields


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'uuid',
            'created_at',
            'updated_at',
            'organization',
            'product_id',
            'product_name',
            'ideal_cycle',
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'organization']
        # The (organization, product_id) rule is checked in validate_product_id: the organization
        # comes from the user, not from the request.
        validators = []

    def validate_product_id(self, value):
        request = self.context['request']
        products = Product.objects.filter(organization=get_organization(request.user), product_id=value)
        if self.instance is not None:
            products = products.exclude(pk=self.instance.pk)
        if products.exists():
            raise serializers.ValidationError('A product with this id already exists.')
        return value


EVENT_FIELDS = [
    'uuid',
    'created_at',
    'updated_at',
    'machine',
    'state',
    'product',
    'cell',
    'fault',
    'quantity',
    'scrap',
    'is_filled',
]


class EventSerializer(serializers.ModelSerializer):
    """A line event sent by an operator. Cell and fault must belong to the same line."""

    machine = line_field()
    product = OrganizationPrimaryKeyRelatedField(queryset=Product.objects.all(), required=False, allow_null=True)
    cell = OrganizationPrimaryKeyRelatedField(
        queryset=Cell.objects.all(),
        organization_lookup='machine__organization',
        required=False,
        allow_null=True,
    )
    fault = OrganizationPrimaryKeyRelatedField(
        queryset=MachineFault.objects.all(),
        organization_lookup='machine__organization',
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Event
        fields = EVENT_FIELDS
        # The time is the server's; filled events are only created by the server.
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'is_filled']

    def validate(self, attrs):
        machine = attrs.get('machine')
        errors = {}
        for name in ('cell', 'fault'):
            related = attrs.get(name)
            if related is not None and machine is not None and related.machine_id != machine.pk:
                errors[name] = f'This {name} belongs to another line.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class EventSerializerRead(serializers.ModelSerializer):
    machine = AssetEventSerializer(read_only=True)
    cell = CellSerializerRead(read_only=True)
    fault = MachineFaultSerializerRead(read_only=True)
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Event
        fields = EVENT_FIELDS
        read_only_fields = EVENT_FIELDS


class DowntimeQuerySerializer(serializers.Serializer):
    """Query parameters of /api/downtime/."""

    # ISO dates with a time zone (what the web app sends, e.g. 2026-10-23T06:00:00.000Z).
    # Dates without one (e.g. 2026-10-23T08:00:00, from other clients) are read in TIME_ZONE.
    DATE_FORMATS = ['iso-8601', '%Y-%m-%dT%H:%M:%S']

    machine = line_field()
    created_at__gte = serializers.DateTimeField(input_formats=DATE_FORMATS)
    created_at__lte = serializers.DateTimeField(input_formats=DATE_FORMATS)


class LineStateSerializer(serializers.Serializer):
    """POST /api/line-states/: the state a line's machine is in, and since when (default: now)."""

    machine = line_field()
    state = serializers.ChoiceField(choices=list(MACHINE_STATES))
    occurred_at = serializers.DateTimeField(required=False)
