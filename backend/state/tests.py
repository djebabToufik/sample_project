"""Tests of the OEE API and the live WebSockets: organization isolation, roles, events."""

import json
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest import mock
from zoneinfo import ZoneInfo

from asgiref.testing import ApplicationCommunicator
from channels.auth import AuthMiddlewareStack
from channels.routing import URLRouter
from django.db import connection
from django.test import Client, SimpleTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.testing import ApiTestCase, ApiTransactionTestCase
from db.models import EVENT_STATES

from .consumers import OeeConsumer2
from .models import Cell, Event, MachineFault, Product
from .routing import websocket_urlpatterns
from .util import calculate_oee, durations, get_missing_states, hourly_oee, open_states
from .views import EventAutoViewSet


class EventTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.line = self.make_asset(self.org, 'Line 1')
        self.line_2 = self.make_asset(self.org, 'Line 2')
        self.other_line = self.make_asset(self.other_org, 'Theirs')
        self.cell = Cell.objects.create(machine=self.line, name='Cell A')
        self.cell_line_2 = Cell.objects.create(machine=self.line_2, name='Cell B')
        self.other_cell = Cell.objects.create(machine=self.other_line, name='Their cell')
        self.other_fault = MachineFault.objects.create(machine=self.other_line, name='Their fault')
        self.other_product = Product.objects.create(organization=self.other_org, product_id='theirs')
        self.client = self.client_for(self.reporter)

    def send(self, **data):
        return self.client.post('/api/events/', {'machine': str(self.line.uuid), **data}, format='json')

    def line_states(self):
        events = Event.objects.filter(machine=self.line).order_by('created_at')
        return list(events.values_list('state', 'is_filled'))

    def test_operator_sends_events(self):
        self.assertEqual(self.send(state='on').status_code, 201)
        self.assertEqual(self.send(state='run').status_code, 201)
        self.assertEqual(self.line_states(), [('on', False), ('off', False), ('on', False), ('run', False)])
        self.line.refresh_from_db()
        self.assertEqual(self.line.state, 'run')

    def test_skipped_states_are_filled_in(self):
        self.send(state='on')
        self.assertEqual(self.send(state='stop').status_code, 201)
        filled = [(state, True) for state in get_missing_states('on', 'stop')]
        self.assertTrue(filled)
        self.assertEqual(self.line_states()[3:], filled + [('stop', False)])

    def test_event_for_another_organizations_line_is_refused(self):
        response = self.client.post('/api/events/', {'machine': str(self.other_line.uuid), 'state': 'on'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('machine', response.json())
        self.assertEqual(Event.objects.filter(machine=self.other_line).count(), 2)

    def test_related_objects_of_another_organization_are_refused(self):
        for field, value in [('cell', self.other_cell), ('fault', self.other_fault), ('product', self.other_product)]:
            with self.subTest(field=field):
                response = self.send(state='on', **{field: str(value.uuid)})
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())

    def test_cell_of_another_line_is_refused(self):
        response = self.send(state='on', cell=str(self.cell_line_2.uuid))
        self.assertEqual(response.status_code, 400)
        self.assertIn('cell', response.json())
        self.assertEqual(self.send(state='on', cell=str(self.cell.uuid)).status_code, 201)

    def test_time_and_fill_flag_are_set_by_the_server(self):
        response = self.send(state='on', created_at='2020-01-01T00:00:00Z', is_filled=True)
        self.assertEqual(response.status_code, 201)
        event = Event.objects.get(uuid=response.json()['uuid'])
        self.assertFalse(event.is_filled)
        self.assertGreater(event.created_at.year, 2020)

    def test_repeated_state_and_missing_history(self):
        self.assertEqual(self.send(state='off').status_code, 400)
        Event.objects.filter(machine=self.line).delete()
        response = self.send(state='on')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], 'No previous event found')

    def test_events_cannot_be_changed_or_deleted(self):
        event = Event.objects.filter(machine=self.line).first()
        url = f'/api/events/{event.uuid}/'
        client = self.client_for(self.admin)
        self.assertEqual(client.patch(url, {'state': 'run'}).status_code, 405)
        self.assertEqual(client.delete(url).status_code, 405)

    def test_every_state_can_follow_every_state(self):
        states = [state for state, _label in EVENT_STATES]
        for last in states:
            for new in states:
                with self.subTest(last=last, new=new):
                    get_missing_states(last, new)

    def test_breaks_are_filled_in(self):
        for state in ('on', 'run', 'break in'):
            self.assertEqual(self.send(state=state).status_code, 201)
        self.assertEqual(self.send(state='stop').status_code, 201)
        self.assertEqual(self.line_states()[-3:], [('resume break in', True), ('report', True), ('stop', False)])
        self.assertEqual(self.send(state='break out').status_code, 201)
        self.assertEqual(self.send(state='off').status_code, 201)
        self.assertEqual(self.line_states()[-1], ('off', False))

    def test_live_views_reload_once_per_event_sent(self):
        self.send(state='on')
        with mock.patch('state.models.notify_live_views') as notify:
            with self.captureOnCommitCallbacks(execute=True):
                self.send(state='stop')  # fills in several states
        self.assertGreater(Event.objects.filter(is_filled=True).count(), 1)
        notify.assert_called_once_with(self.line)

    def test_live_views_are_notified_after_the_commit(self):
        with mock.patch('state.models.notify_live_views') as notify:
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                self.send(state='on')
                notify.assert_not_called()
        self.assertEqual(len(callbacks), 1)
        notify.assert_called_once_with(self.line)

    def test_failed_save_leaves_no_filled_events(self):
        self.send(state='on')
        count = Event.objects.count()
        with mock.patch.object(EventAutoViewSet, 'perform_create', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.send(state='stop')
        self.assertEqual(Event.objects.count(), count)

    def test_event_list_shows_own_organization_only(self):
        lines = {e['machine'] for e in self.client.get('/api/events/').json()}
        self.assertEqual(lines, {str(self.line.uuid), str(self.line_2.uuid)})


class DowntimeTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.line = self.make_asset(self.org)
        self.other_line = self.make_asset(self.other_org)
        self.fault = MachineFault.objects.create(machine=self.line, name='Jam')
        self.cell = Cell.objects.create(machine=self.line, name='Cell A')
        self.client = self.client_for(self.admin)

    def get(self, **params):
        return self.client.get('/api/downtime/', params)

    def window(self, zone, before=timedelta(minutes=30), after=timedelta(minutes=30)):
        """The window from `before` ago to `after` from now, written in time zone `zone`."""
        now = timezone.now().astimezone(ZoneInfo(zone))
        return {'created_at__gte': (now - before).isoformat(), 'created_at__lte': (now + after).isoformat()}

    def record(self, state, **fields):
        return Event.objects.create(machine=self.line, state=state, **fields)

    def fault_count(self, **params):
        return self.get(machine=str(self.line.uuid), **params).json()['downtime_per_fault'][0]['count']

    def test_time_zone_of_the_dates_is_respected(self):
        self.record('fault', fault=self.fault)
        self.assertEqual(self.fault_count(**self.window('UTC')), 1)
        self.assertEqual(self.fault_count(**self.window('America/New_York')), 1)
        # A window that ended an hour ago, in another zone: nothing.
        past = self.window('Asia/Tokyo', before=timedelta(hours=2), after=-timedelta(hours=1))
        self.assertEqual(self.fault_count(**past), 0)

    @override_settings(TIME_ZONE='America/New_York')
    def test_dates_without_time_zone_are_read_in_the_server_time_zone(self):
        self.record('fault', fault=self.fault)
        now = timezone.now().astimezone(ZoneInfo('America/New_York')).replace(tzinfo=None, microsecond=0)
        params = {
            'created_at__gte': (now - timedelta(minutes=30)).isoformat(),
            'created_at__lte': (now + timedelta(minutes=30)).isoformat(),
        }
        self.assertEqual(self.fault_count(**params), 1)

    def test_missing_or_invalid_parameters_are_a_400(self):
        self.assertEqual(self.get().status_code, 400)
        self.assertEqual(self.get(machine=str(self.line.uuid)).status_code, 400)
        response = self.get(machine='not-a-uuid', created_at__gte='x', created_at__lte='y')
        self.assertEqual(response.status_code, 400)

    def test_other_organizations_line_is_refused(self):
        response = self.get(
            machine=str(self.other_line.uuid),
            created_at__gte='2026-01-01T00:00:00',
            created_at__lte='2099-01-01T00:00:00',
        )
        self.assertEqual(response.status_code, 400)

    def test_period_report(self):
        response = self.get(machine=str(self.line.uuid), **self.window('UTC'))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            set(body),
            {'oee_selected_period', 'oee_last_24h', 'machine', 'downtime_per_fault', 'downtime_per_cell'},
        )
        self.assertEqual(body['machine']['uuid'], str(self.line.uuid))
        self.assertIn('running_hour_cost', body['machine'])
        self.assertEqual(body['downtime_per_fault'], [{'uuid': str(self.fault.uuid), 'name': 'Jam', 'count': 0}])
        self.assertEqual(body['downtime_per_cell'], [{'uuid': str(self.cell.uuid), 'name': 'Cell A', 'count': 0}])

    def test_each_downtime_counts_once(self):
        other_fault = MachineFault.objects.create(machine=self.line, name='Overheat')
        MachineFault.objects.create(machine=self.other_line, name='Theirs')
        for state in ('fault', 'resume fault', 'failure', 'resume failure', 'out of order'):
            self.record(state, fault=self.fault, cell=self.cell)
        self.record('fault', fault=other_fault)
        # Filled in by the server (no time spent): not a downtime.
        self.record('fault', fault=self.fault, cell=self.cell, is_filled=True)
        # Another line's event with our fault would be refused by the API; it must not count anyway.
        Event.objects.create(machine=self.other_line, state='fault')

        body = self.get(machine=str(self.line.uuid), **self.window('UTC')).json()
        self.assertEqual([(f['name'], f['count']) for f in body['downtime_per_fault']], [('Jam', 3), ('Overheat', 1)])
        self.assertEqual([(c['name'], c['count']) for c in body['downtime_per_cell']], [('Cell A', 3)])

    def test_comparison_is_the_last_24_hours(self):
        self.record('on', created_at=timezone.now() - timedelta(hours=20))
        body = self.get(machine=str(self.line.uuid), **self.window('UTC')).json()
        self.assertAlmostEqual(body['oee_last_24h']['machine_on_duration'], 20, places=1)

    def test_queries_do_not_grow_with_the_events(self):
        product = Product.objects.create(organization=self.org, product_id='p1', ideal_cycle=1)

        def queries():
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.get(machine=str(self.line.uuid), **self.window('UTC')).status_code, 200)
            return len(captured)

        self.record('report', product=product, quantity=5)
        few = queries()
        for _ in range(10):
            self.record('report', product=product, quantity=5)
            self.record('fault', fault=self.fault)
        self.assertEqual(queries(), few)

    def test_read_only(self):
        self.assertEqual(self.client.post('/api/downtime/', {}).status_code, 405)


class LineSetupTest(ApiTestCase):
    """Cells, faults and products: members read, administrators change, own organization only."""

    def setUp(self):
        super().setUp()
        self.line = self.make_asset(self.org)
        self.other_line = self.make_asset(self.other_org)
        self.client = self.client_for(self.admin)

    def test_admin_creates_cells_and_faults_on_own_lines_only(self):
        for path in ['/api/cells/', '/api/faults/']:
            with self.subTest(path=path):
                ok = self.client.post(path, {'name': 'A', 'machine': str(self.line.uuid)})
                self.assertEqual(ok.status_code, 201)
                refused = self.client.post(path, {'name': 'B', 'machine': str(self.other_line.uuid)})
                self.assertEqual(refused.status_code, 400)
        self.assertFalse(Cell.objects.filter(machine=self.other_line).exists())

    def test_cells_and_faults_of_other_organizations_are_hidden(self):
        Cell.objects.create(machine=self.other_line, name='Theirs')
        other_fault = MachineFault.objects.create(machine=self.other_line, name='Theirs')
        self.assertEqual(self.client.get('/api/cells/').json(), [])
        self.assertEqual(self.client.get('/api/faults/').json(), [])
        self.assertEqual(self.client.delete(f'/api/faults/{other_fault.uuid}/').status_code, 404)

    def test_cells_filter_by_line(self):
        Cell.objects.create(machine=self.line, name='Mine')
        response = self.client.get('/api/cells/', {'machine': str(self.line.uuid)})
        self.assertEqual([c['name'] for c in response.json()], ['Mine'])

    def test_products_belong_to_own_organization(self):
        response = self.client.post(
            '/api/products/',
            {
                'product_id': 'P-1',
                'product_name': 'Widget',
                'organization': str(self.other_org.uuid),
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Product.objects.get(product_id='P-1').organization, self.org)
        Product.objects.create(organization=self.other_org, product_id='P-2')
        ids = [p['product_id'] for p in self.client.get('/api/products/').json()]
        self.assertEqual(ids, ['P-1'])

    def test_product_ids_are_unique_per_organization(self):
        Product.objects.create(organization=self.other_org, product_id='P-100')
        response = self.client.post('/api/products/', {'product_id': 'P-100', 'product_name': 'Ours'})
        self.assertEqual(response.status_code, 201)  # another organization's id doesn't block it

        response = self.client.post('/api/products/', {'product_id': 'P-100', 'product_name': 'Again'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('product_id', response.json())

        product = Product.objects.get(organization=self.org, product_id='P-100')
        response = self.client.patch(
            f'/api/products/{product.uuid}/', {'product_id': 'P-100', 'product_name': 'Renamed'}
        )
        self.assertEqual(response.status_code, 200)


class LiveSocketTest(ApiTransactionTestCase):
    """WebSockets log in with the session cookie, accept own lines only, ignore client messages."""

    application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))

    def setUp(self):
        super().setUp()
        self.line = self.make_asset(self.org)
        self.other_line = self.make_asset(self.other_org)
        browser = Client()
        browser.force_login(self.reporter)
        self.cookie = f"sessionid={browser.cookies['sessionid'].value}"

    async def connect(self, query, cookie=None):
        """Opens /ws/machine-data/?<query> with `cookie`; returns the communicator and what the server
        sent once connected: the line's data, or a close whose code tells the client not to retry."""
        scope = {
            'type': 'websocket',
            'path': '/ws/machine-data/',
            'query_string': query.encode(),
            'headers': [(b'cookie', cookie.encode())] if cookie else [],
            'subprotocols': [],
        }
        communicator = ApplicationCommunicator(self.application, scope)
        await communicator.send_input({'type': 'websocket.connect'})
        self.assertEqual((await communicator.receive_output(timeout=10))['type'], 'websocket.accept')
        return communicator, await communicator.receive_output(timeout=10)

    async def close(self, communicator):
        await communicator.send_input({'type': 'websocket.disconnect', 'code': 1000})
        await communicator.wait(timeout=5)

    async def test_refuses_missing_or_wrong_session_as_not_logged_in(self):
        for cookie in [None, 'sessionid=forged']:
            communicator, answer = await self.connect(f'machine={self.line.uuid}', cookie)
            self.assertEqual(answer, {'type': 'websocket.close', 'code': 4401}, cookie)
            await self.close(communicator)

    async def test_refuses_other_organizations_line_as_forbidden(self):
        for machine in [self.other_line.uuid, 'not-a-uuid', '']:
            communicator, answer = await self.connect(f'machine={machine}', self.cookie)
            self.assertEqual(answer, {'type': 'websocket.close', 'code': 4403}, machine)
            await self.close(communicator)

    async def test_sends_line_data_and_ignores_client_messages(self):
        communicator, answer = await self.connect(f'machine={self.line.uuid}', self.cookie)
        self.assertEqual(answer['type'], 'websocket.send')
        first = json.loads(answer['text'])
        self.assertEqual([e['state'] for e in first['data']], ['on', 'off'])
        self.assertEqual(len(first['oee']), 24)

        await communicator.send_input({'type': 'websocket.receive', 'text': json.dumps({'message': 'fake'})})
        self.assertTrue(await communicator.receive_nothing(timeout=0.5))
        await self.close(communicator)


START = datetime(2026, 1, 1, 8, 0, tzinfo=ZoneInfo('UTC'))


def at(minutes):
    return START + timedelta(minutes=minutes)


def event(state, minutes, quantity=0, scrap=0, ideal_cycle=None):
    product = SimpleNamespace(ideal_cycle=ideal_cycle) if ideal_cycle is not None else None
    return SimpleNamespace(state=state, created_at=at(minutes), quantity=quantity, scrap=scrap, product=product)


class OeeCalculationTest(SimpleTestCase):
    """calculate_oee on hand-made timelines; the period is 08:00-10:00 (120 minutes)."""

    def oee(self, events, open_at_start=(), end=120, now=None):
        return calculate_oee(events, START, at(end), now or at(end), open_at_start)

    def test_states_open_at_the_start_count_from_the_start(self):
        result = self.oee([event('stop', 60)], open_at_start={'on', 'run'})
        self.assertEqual(result['machine_on_duration'], 2)
        self.assertEqual(result['machine_run_duration'], 1)

    def test_open_states_count_until_now_at_most(self):
        result = self.oee([event('on', 0), event('run', 30)], now=at(90))
        self.assertEqual(result['machine_on_duration'], 1.5)
        self.assertEqual(result['machine_run_duration'], 1)

    def test_repeated_starts_and_unmatched_ends_change_nothing(self):
        events = [event('resume fault', 5), event('fault', 30), event('fault', 40), event('resume fault', 60)]
        self.assertEqual(self.oee(events, open_at_start={'on', 'run'})['machine_fault_duration'], 0.5)

    def test_ratios(self):
        # Runs 2 h with a 30 min fault, 45 pieces of 1 min each (3 scrap): ideal 0.75 h of 1.5 h running.
        events = [
            event('fault', 30),
            event('resume fault', 60),
            event('report', 100, quantity=45, scrap=3, ideal_cycle=1),
        ]
        result = self.oee(events, open_at_start={'on', 'run'})
        self.assertAlmostEqual(result['availability'], 0.75)
        self.assertAlmostEqual(result['performance'], 0.5)
        self.assertAlmostEqual(result['quality'], 42 / 45)
        self.assertAlmostEqual(result['oee'], 0.75 * 0.5 * 42 / 45 * 100)

    def test_breaks_while_running_are_not_planned_time(self):
        result = self.oee([event('break in', 0), event('resume break in', 60)], open_at_start={'on', 'run'})
        self.assertEqual(result['machine_break_in_duration'], 1)
        self.assertEqual(result['availability'], 1)

    def test_failure_is_lost_planned_time(self):
        result = self.oee([event('failure', 0), event('resume failure', 60), event('run', 60)], open_at_start={'on'})
        self.assertEqual(result['availability'], 0.5)

    def test_idle_line_has_no_oee(self):
        result = self.oee([], open_at_start={'on'})
        self.assertEqual(result['machine_on_duration'], 2)
        self.assertEqual([result[k] for k in ('availability', 'performance', 'quality', 'oee')], [None] * 4)

    def test_running_without_production_is_zero(self):
        result = self.oee([], open_at_start={'on', 'run'})
        self.assertEqual((result['performance'], result['quality'], result['oee']), (0, None, 0))


class OeeFromDatabaseTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.line = self.make_asset(self.org)
        self.events = Event.objects.filter(machine=self.line)
        self.events.delete()  # the on / off recorded on creation: each test writes its own timeline

    def record(self, state, created_at):
        Event.objects.create(machine=self.line, state=state, created_at=created_at)

    def test_open_states(self):
        now = timezone.now()
        self.record('on', now - timedelta(hours=3))
        self.record('run', now - timedelta(hours=2))
        self.record('stop', now - timedelta(hours=1))
        self.assertEqual(open_states(self.events, now - timedelta(minutes=90)), {'on', 'run'})
        self.assertEqual(open_states(self.events, now), {'on'})

    def test_hourly_oee_knows_the_state_before_each_hour(self):
        now = timezone.now()
        self.record('on', now - timedelta(hours=30))
        self.record('run', now - timedelta(hours=26))
        self.record('stop', now - timedelta(hours=2, minutes=30))
        hours = hourly_oee(self.events, now)
        self.assertEqual(len(hours), 24)
        self.assertEqual([h['machine_run_duration'] for h in hours[:21]], [1] * 21)
        self.assertAlmostEqual(hours[21]['machine_run_duration'], 0.5)
        self.assertEqual(hours[22]['machine_run_duration'], 0)
        self.assertEqual({h['machine_on_duration'] for h in hours}, {1})

    def test_durations_across_a_daylight_saving_change(self):
        # Berlin clocks went back at 03:00 on 2026-10-25: 00:00 to 06:00 local time is 7 hours.
        berlin = ZoneInfo('Europe/Berlin')
        start = datetime(2026, 10, 25, 0, tzinfo=berlin)
        end = datetime(2026, 10, 25, 6, tzinfo=berlin)
        self.assertEqual(durations([], start, end, {'on'})['machine_on_duration'], 7)

    def test_downtime_counts_states_open_before_the_period(self):
        now = timezone.now()
        self.record('on', now - timedelta(days=2))
        period = {
            'machine': str(self.line.uuid),
            'created_at__gte': (now - timedelta(hours=10)).isoformat(),
            'created_at__lte': now.isoformat(),
        }
        body = self.client_for(self.admin).get('/api/downtime/', period).json()
        self.assertAlmostEqual(body['oee_selected_period']['machine_on_duration'], 10, places=2)
        self.assertIsNone(body['oee_selected_period']['oee'])


class EventIndexTest(ApiTestCase):
    def test_events_are_indexed_by_line_and_time(self):
        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(cursor, Event._meta.db_table)
        index = constraints.get('event_machine_created_at')
        self.assertIsNotNone(index)
        self.assertEqual(index['columns'], ['machine_id', 'created_at'])
        self.assertTrue(index['index'])


class LiveOeeMessageTest(ApiTestCase):
    def test_oee_covers_the_last_24_hours_on_connect_and_on_updates(self):
        line = self.make_asset(self.org)
        Event.objects.filter(machine=line).delete()
        Event.objects.create(machine=line, state='on', created_at=timezone.now() - timedelta(hours=20))
        consumer = OeeConsumer2()
        consumer.organization_uuid, consumer.machine_uuid = str(self.org.uuid), str(line.uuid)
        for initial in (True, False):
            with self.subTest(initial=initial):
                data = consumer.build_message(initial)['data']
                self.assertAlmostEqual(data['machine_on_duration'], 20, places=1)
