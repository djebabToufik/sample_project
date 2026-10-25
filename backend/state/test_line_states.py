"""Tests of POST /api/line-states/: machine states sent by other software (line_states.py)."""

import itertools
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core.testing import ApiTestCase

from .line_states import MACHINE_STATES, STEP, events_to, first_event_time
from .models import Event
from .util import apply_events


class LineStateLogicTest(SimpleTestCase):
    """From the pairs open on a line to a machine state."""

    def test_examples(self):
        self.assertEqual(events_to(set(), 'run'), ['on', 'run'])
        self.assertEqual(events_to({'on', 'run'}, 'off'), ['stop', 'off'])
        self.assertEqual(events_to({'on', 'run', 'fault'}, 'off'), ['resume fault', 'stop', 'off'])
        self.assertEqual(events_to({'on', 'run', 'fault'}, 'failure'), ['resume fault', 'stop', 'failure'])
        self.assertEqual(events_to({'on'}, 'out of order'), ['off', 'out of order'])
        self.assertEqual(events_to({'out of order'}, 'run'), ['resume out of order', 'on', 'run'])
        self.assertEqual(events_to({'on', 'run'}, 'run'), [])

    def test_operator_breaks_stay_open_while_their_pair_is(self):
        self.assertEqual(events_to({'on', 'run', 'break in'}, 'run'), [])
        self.assertEqual(events_to({'on', 'run', 'break in'}, 'fault'), ['fault'])
        self.assertEqual(events_to({'on', 'run', 'break in'}, 'on'), ['resume break in', 'stop'])
        self.assertEqual(events_to({'on', 'break out'}, 'failure'), ['failure'])
        self.assertEqual(events_to({'on', 'break out'}, 'off'), ['resume break out', 'off'])

    def test_every_change_ends_with_exactly_the_wanted_pairs(self):
        """No invented faults or reports: only the pairs that change are closed or opened."""
        for start, end in itertools.product(MACHINE_STATES, repeat=2):
            with self.subTest(start=start, end=end):
                events = events_to(MACHINE_STATES[start], end)
                after = apply_events(MACHINE_STATES[start], [SimpleNamespace(state=state) for state in events])
                self.assertEqual(after, set(MACHINE_STATES[end]))
                self.assertEqual(len(events), len(MACHINE_STATES[start] ^ MACHINE_STATES[end]))

    def test_first_event_time(self):
        now = datetime(2026, 1, 1, 12, tzinfo=ZoneInfo('UTC'))
        hour_ago = now - timedelta(hours=1)
        self.assertEqual(first_event_time(hour_ago, None, now), hour_ago)
        self.assertEqual(first_event_time(hour_ago, hour_ago - timedelta(minutes=5), now), hour_ago)
        # Never at or before the line's last event, never in the future.
        self.assertEqual(first_event_time(hour_ago, hour_ago, now), hour_ago + STEP)
        minute_ago = now - timedelta(minutes=1)
        self.assertEqual(first_event_time(hour_ago, minute_ago, now), minute_ago + STEP)
        self.assertEqual(first_event_time(now + timedelta(hours=2), None, now), now)


class LineStateApiTest(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.t0 = timezone.now() - timedelta(hours=3)
        self.line = self.make_asset(self.org)
        # A new line starts with on, off at "now": move them before the times the tests send.
        for state, days in (('on', 2), ('off', 1)):
            Event.objects.filter(machine=self.line, state=state).update(created_at=self.t0 - timedelta(days=days))
        self.other_line = self.make_asset(self.other_org, 'Theirs')
        token = Token.objects.create(user=self.reporter)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

    def send(self, state, at=None, line=None, client=None):
        body = {'machine': str((line or self.line).uuid), 'state': state}
        if at is not None:
            body['occurred_at'] = at.isoformat()
        return (client or self.client).post('/api/line-states/', body, format='json')

    def events(self, since=None):
        """(state, time, is_filled) of the line, in time order."""
        events = Event.objects.filter(machine=self.line).order_by('created_at')
        if since is not None:
            events = events.filter(created_at__gte=since)
        return list(events.values_list('state', 'created_at', 'is_filled'))

    def states(self, since=None):
        return [state for state, _at, _filled in self.events(since)]

    def test_writes_the_events_at_the_time_sent(self):
        response = self.send('run', self.t0)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['changed'])
        # The event reported is the last one; the ones leading to it are filled in.
        self.assertEqual(self.events(since=self.t0), [('on', self.t0, True), ('run', self.t0 + STEP, False)])
        self.line.refresh_from_db()
        self.assertEqual(self.line.state, 'run')

    def test_one_change_closes_the_inner_pairs_first(self):
        self.send('fault', self.t0)
        self.send('off', self.t0 + timedelta(minutes=5))
        self.assertEqual(self.states(since=self.t0), ['on', 'run', 'fault', 'resume fault', 'stop', 'off'])

    def test_same_state_changes_nothing(self):
        self.send('run', self.t0)
        count = Event.objects.count()
        response = self.send('run', self.t0 + timedelta(minutes=1))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'changed': False, 'events': []})
        self.assertEqual(Event.objects.count(), count)

    def test_a_time_before_the_last_event_comes_right_after_it(self):
        self.send('run', self.t0)
        last = Event.objects.filter(machine=self.line).latest('created_at').created_at
        self.send('on', self.t0 - timedelta(hours=1))
        self.assertEqual(self.events()[-1][:2], ('stop', last + STEP))

    def test_a_time_in_the_future_becomes_now(self):
        before = timezone.now()
        self.send('run', timezone.now() + timedelta(hours=5))
        first, last = self.events()[-2][1], self.events()[-1][1]
        self.assertGreaterEqual(first, before)
        self.assertLessEqual(last, timezone.now() + STEP)

    def test_time_defaults_to_now(self):
        before = timezone.now()
        self.assertEqual(self.send('on').status_code, 201)
        self.assertGreaterEqual(self.events()[-1][1], before)

    def test_operator_break_is_kept_then_closed_with_its_pair(self):
        self.send('run', self.t0)
        Event.objects.create(machine=self.line, state='break in', created_at=self.t0 + timedelta(minutes=1))
        self.assertEqual(self.send('run', self.t0 + timedelta(minutes=2)).status_code, 200)
        self.send('off', self.t0 + timedelta(minutes=3))
        self.assertEqual(self.states(since=self.t0 + timedelta(minutes=3)), ['resume break in', 'stop', 'off'])

    def test_line_without_history(self):
        Event.objects.filter(machine=self.line).delete()
        self.assertEqual(self.send('run', self.t0).status_code, 201)
        self.assertEqual(self.states(), ['on', 'run'])

    def test_oee_uses_the_times_sent(self):
        self.send('run', self.t0)
        self.send('off', self.t0 + timedelta(minutes=30))
        period = {
            'machine': str(self.line.uuid),
            'created_at__gte': (self.t0 - timedelta(minutes=1)).isoformat(),
            'created_at__lte': (self.t0 + timedelta(hours=1)).isoformat(),
        }
        oee = self.client_for(self.admin).get('/api/downtime/', period).json()['oee_selected_period']
        self.assertAlmostEqual(oee['machine_run_duration'], 0.5, places=3)
        self.assertAlmostEqual(oee['machine_on_duration'], 0.5, places=3)

    def test_only_other_software_with_a_token(self):
        self.assertEqual(self.send('run', client=self.client_for(self.reporter)).status_code, 403)
        self.assertEqual(self.send('run', client=APIClient()).status_code, 401)

    def test_refused_input(self):
        self.assertEqual(self.send('run', line=self.other_line).status_code, 400)
        for state in ('report', 'stop', 'break in', 'nonsense'):
            with self.subTest(state=state):
                self.assertEqual(self.send(state).status_code, 400)
