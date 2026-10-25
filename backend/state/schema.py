"""Shapes of the OEE endpoints' answers, for the API documentation (they build plain dicts)."""

from rest_framework import serializers

from .serializers import AssetEventSerializer


class OeeSummarySerializer(serializers.Serializer):
    """OEE of a period: ratios from 0 to 1 (null without data), the OEE in percent, durations in hours."""

    availability = serializers.FloatField(allow_null=True)
    performance = serializers.FloatField(allow_null=True)
    quality = serializers.FloatField(allow_null=True)
    oee = serializers.FloatField(allow_null=True, help_text='Percent, 0-100.')
    machine_on_duration = serializers.FloatField()
    machine_run_duration = serializers.FloatField()
    machine_break_in_duration = serializers.FloatField()
    machine_break_out_duration = serializers.FloatField()
    machine_failure_duration = serializers.FloatField()
    machine_fault_duration = serializers.FloatField()
    out_of_order_duration = serializers.FloatField()


class DowntimeCountSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    name = serializers.CharField()
    count = serializers.IntegerField()


class DowntimeSerializer(serializers.Serializer):
    oee_selected_period = OeeSummarySerializer()
    oee_last_24h = OeeSummarySerializer()
    machine = AssetEventSerializer()
    downtime_per_fault = DowntimeCountSerializer(many=True)
    downtime_per_cell = DowntimeCountSerializer(many=True)


class WrittenEventSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    state = serializers.CharField()
    created_at = serializers.DateTimeField()


class LineStateResultSerializer(serializers.Serializer):
    changed = serializers.BooleanField(help_text='False when the line already was in that state.')
    events = WrittenEventSerializer(many=True)
