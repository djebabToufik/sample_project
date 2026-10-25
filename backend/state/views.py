"""Views of the OEE API. Every queryset is limited to the user's organization (OrganizationScopedMixin)."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import OrganizationScopedMixin, ReadWriteSerializerMixin
from core.permissions import IsAdminOrReadOnly, IsOtherSoftware
from db.models import Asset

from .line_states import record_machine_state
from .models import Cell, Event, MachineFault, Product
from .serializers import (
    AssetEventSerializer,
    CellSerializer,
    CellSerializerRead,
    DowntimeQuerySerializer,
    EventSerializer,
    LineStateSerializer,
    MachineFaultSerializer,
    MachineFaultSerializerRead,
    ProductSerializer,
)
from .util import allowed_to_skip_fill, calculate_oee, get_missing_states, open_states

EVENT_RELATED = ('machine', 'machine__organization', 'cell', 'cell__machine', 'fault', 'fault__machine', 'product')


class ProductViewSet(OrganizationScopedMixin, viewsets.ModelViewSet):
    """Products of the organization. Members read, administrators change."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(organization=self.get_organization())


class CellViewSet(ReadWriteSerializerMixin, OrganizationScopedMixin, viewsets.ModelViewSet):
    """Cells of the organization's lines (?machine=<uuid> to filter). Members read, administrators change."""

    queryset = Cell.objects.select_related('machine')
    read_serializer_class = CellSerializerRead
    serializer_class = CellSerializer
    organization_lookup = 'machine__organization'
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['machine']


class MachineFaultViewSet(ReadWriteSerializerMixin, OrganizationScopedMixin, viewsets.ModelViewSet):
    """Faults of the organization's lines (?machine=<uuid> to filter). Members read, administrators change."""

    queryset = MachineFault.objects.select_related('machine')
    read_serializer_class = MachineFaultSerializerRead
    serializer_class = MachineFaultSerializer
    organization_lookup = 'machine__organization'
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['machine']


# A downtime starts with one of these events (counted once: not its resume, not filled-in events).
DOWNTIME_STARTS = ('fault', 'failure', 'out of order')


class DowntimeViewSet(OrganizationScopedMixin, viewsets.GenericViewSet):
    """
    GET ?machine=&created_at__gte=&created_at__lte=: the OEE of a line in a period and in the
    last 24 hours, the line itself (energy and cost rates), and its downtimes per fault and per cell.
    """

    # Only what calculate_oee reads: a month of events stays light.
    queryset = (
        Event.objects.select_related('product')
        .only('state', 'created_at', 'quantity', 'scrap', 'product', 'product__ideal_cycle')
        .order_by('created_at')
    )
    organization_lookup = 'machine__organization'

    def list(self, request):
        query = DowntimeQuerySerializer(data=request.query_params, context=self.get_serializer_context())
        query.is_valid(raise_exception=True)
        machine = query.validated_data['machine']
        now = timezone.now()
        from_date = query.validated_data['created_at__gte']
        to_date = min(query.validated_data['created_at__lte'], now)

        line_events = self.get_queryset().filter(machine=machine)
        day_ago = now - timedelta(hours=24)
        last_day = line_events.filter(created_at__gte=day_ago, created_at__lte=now)
        period = line_events.filter(created_at__gte=from_date, created_at__lte=to_date)

        downtimes = Q(
            event__state__in=DOWNTIME_STARTS,
            event__is_filled=False,
            event__created_at__gte=from_date,
            event__created_at__lte=to_date,
        )

        def per(objects):
            """[{uuid, name, count}] of the line's faults or cells, zeros included."""
            objects = objects.filter(machine=machine).annotate(count=Count('event', filter=downtimes))
            return [{'uuid': o.uuid, 'name': o.name, 'count': o.count} for o in objects.order_by('created_at')]

        return Response(
            {
                'oee_selected_period': calculate_oee(
                    period, from_date, to_date, now, open_states(line_events, from_date)
                ),
                'oee_last_24h': calculate_oee(last_day, day_ago, now, now, open_states(line_events, day_ago)),
                'machine': AssetEventSerializer(machine, context=self.get_serializer_context()).data,
                'downtime_per_fault': per(MachineFault.objects),
                'downtime_per_cell': per(Cell.objects),
            },
            status=status.HTTP_200_OK,
        )


class EventAutoViewSet(
    OrganizationScopedMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Line events. Sending one fills in the states the line skipped since the last event
    (e.g. run → fault also records stop). Events are never changed or deleted.
    """

    queryset = Event.objects.select_related(*EVENT_RELATED).order_by('-created_at')
    serializer_class = EventSerializer
    organization_lookup = 'machine__organization'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        machine, new_state = data['machine'], data['state']

        # One event at a time per line: the row lock makes a second request wait until this
        # one is saved, so it compares against the right last state.
        with transaction.atomic():
            Asset.objects.select_for_update().filter(pk=machine.pk).first()
            last_event = Event.objects.filter(machine=machine).order_by('-created_at').first()
            if last_event is None:
                return Response({'detail': 'No previous event found'}, status=status.HTTP_400_BAD_REQUEST)

            last_state = last_event.state
            if last_state == new_state and last_state != 'report':
                return Response({'detail': 'No state replication allowed'}, status=status.HTTP_400_BAD_REQUEST)

            if last_state not in allowed_to_skip_fill.get(new_state, ()):
                for state in get_missing_states(last_state, new_state):
                    Event.objects.create(**{**data, 'state': state, 'is_filled': True})

            self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class LineStateView(APIView):
    """
    POST {machine, state, occurred_at?}: the state a line's machine is in (off, out of order, on, failure, run,
    fault), sent by other software with an API token (e.g. the gateway). The server writes the events that lead
    there (see line_states.py). 201 with the new events, or 200 with none when the line already is in that state.
    """

    permission_classes = [IsOtherSoftware]

    def post(self, request):
        serializer = LineStateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        events = record_machine_state(data['machine'], data['state'], data.get('occurred_at') or timezone.now())
        body = {
            'changed': bool(events),
            'events': [{'uuid': e.uuid, 'state': e.state, 'created_at': e.created_at} for e in events],
        }
        return Response(body, status=status.HTTP_201_CREATED if events else status.HTTP_200_OK)
