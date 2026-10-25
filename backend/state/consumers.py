"""
Live views of a line over WebSockets (routing.py): /ws/<channel>/?machine=<line uuid>.

A consumer joins the group of one line of the user's organization; a new event (models.py) tells
the group to reload, and each consumer sends its fresh data to its client. Clients only receive:
messages they send are ignored.
"""

import json
import uuid
from datetime import timedelta
from urllib.parse import parse_qs

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.utils import timezone

from core.organization import get_organization
from db.models import Asset

from .models import Event
from .serializers import EventSerializerRead
from .util import calculate_oee, hourly_oee, open_states

EVENT_RELATED = ('machine', 'cell', 'cell__machine', 'fault', 'fault__machine', 'product')


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return obj.hex
        return json.JSONEncoder.default(self, obj)


class LineConsumer(WebsocketConsumer):
    """Base: login and line checks, group membership. Subclasses build the message."""

    group_prefix = ''

    def connect(self):
        # scope['user'] comes from the session cookie (AuthMiddlewareStack in asgi.py).
        organization = get_organization(self.scope.get('user'))
        query = parse_qs(self.scope.get('query_string', b'').decode())
        machine = self.line_uuid(query.get('machine', [None])[0])
        if (
            organization is None
            or machine is None
            or not Asset.objects.filter(uuid=machine, organization=organization).exists()
        ):
            self.close(code=1011)
            return
        self.organization_uuid = str(organization.uuid)
        self.machine_uuid = machine
        self.room_group_name = f'{self.group_prefix}_{self.organization_uuid}_{self.machine_uuid}'
        async_to_sync(self.channel_layer.group_add)(self.room_group_name, self.channel_name)
        self.accept()
        self.send_message(initial=True)

    def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            async_to_sync(self.channel_layer.group_discard)(self.room_group_name, self.channel_name)

    @staticmethod
    def line_uuid(value):
        try:
            return str(uuid.UUID(str(value)))
        except ValueError:
            return None

    def line_events(self):
        return Event.objects.filter(
            machine__uuid=self.machine_uuid, machine__organization__uuid=self.organization_uuid
        ).select_related(*EVENT_RELATED)

    def oee_between(self, start, end):
        events = self.line_events().filter(created_at__gte=start, created_at__lte=end).order_by('created_at')
        return calculate_oee(events, start, end, end, open_states(self.line_events(), start))

    def hourly_oee(self):
        """OEE of each of the last 24 hours, oldest first."""
        return hourly_oee(self.line_events(), timezone.now())

    def send_message(self, initial):
        self.send(text_data=json.dumps(self.build_message(initial), cls=UUIDEncoder))

    def build_message(self, initial):
        raise NotImplementedError


class MachineConsumer(LineConsumer):
    """ws/machine-data/: the last 15 events (not filled in) and the hourly OEE."""

    group_prefix = 'data'

    def build_message(self, initial):
        events = self.line_events().filter(is_filled=False).order_by('-created_at')[:15][::-1]
        return {"data": EventSerializerRead(events, many=True).data, "oee": self.hourly_oee()}

    def data_message(self, event):
        self.send_message(initial=False)


class ReportConsumer(LineConsumer):
    """ws/machine-report/: the latest event and the hourly OEE."""

    group_prefix = 'report'

    def build_message(self, initial):
        last_event = self.line_events().order_by('-created_at').first()
        return {"data": EventSerializerRead(last_event).data, "oee": self.hourly_oee()}

    def report_message(self, event):
        self.send_message(initial=False)


class OeeConsumer2(LineConsumer):
    """ws/machine-oee/: OEE of the last 24 hours, the hourly OEE and the latest event."""

    group_prefix = 'oee'

    def build_message(self, initial):
        now = timezone.now()
        period = timedelta(hours=24)
        events = self.line_events().filter(is_filled=False).order_by('-created_at')[:1]
        return {
            "data": self.oee_between(now - period, now),
            "oee": self.hourly_oee(),
            "list": EventSerializerRead(events, many=True).data,
        }

    def oee_message(self, event):
        self.send_message(initial=False)
