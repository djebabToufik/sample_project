"""Tests of the populate_demo command (demo plant created on first start with DEMO=true)."""

from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from db.models import Asset, MaintenancePlan, UserProfile

from .models import Event


class PopulateDemoTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        get_user_model().objects.create_superuser(username='admin', password='x')
        call_command('populate_demo', stdout=StringIO())

    def states(self, line):
        """The line's states in time order, without the production reports."""
        events = Event.objects.filter(machine=line).exclude(state='report').order_by('created_at')
        return list(events.values_list('state', flat=True))

    def test_three_lines_with_their_maintenance_plans(self):
        lines = Asset.objects.order_by('name')
        self.assertEqual([line.name for line in lines], ['Extrusion line 1', 'Extrusion line 2', 'Extrusion line 3'])
        for line in lines:
            self.assertEqual(MaintenancePlan.objects.filter(asset=line).count(), 5)
            self.assertTrue(Event.objects.filter(machine=line, state='report').exists())

    def test_each_line_replays_whole_cycles_from_another_start(self):
        sequences = [self.states(line) for line in Asset.objects.order_by('name')]
        for states in sequences:
            # Every line starts switched on and ends switched off, with the same recorded hours.
            self.assertEqual(states[0], 'on')
            self.assertIn(states[-1], ('off', 'resume out of order'))
            self.assertEqual(sorted(states), sorted(sequences[0]))
        self.assertEqual(len({tuple(states) for states in sequences}), 3)

    def test_runs_once(self):
        output = StringIO()
        call_command('populate_demo', stdout=output)
        self.assertIn('skipping', output.getvalue())
        self.assertEqual(Asset.objects.count(), 3)


@override_settings(DEMO_USERNAME='demo', DEMO_PASSWORD='demo-pass')
class PublicDemoAccountTest(TestCase):
    """On a public demo the plant belongs to a normal account, not to the superuser."""

    @classmethod
    def setUpTestData(cls):
        get_user_model().objects.create_superuser(username='admin', password='x')
        call_command('populate_demo', stdout=StringIO())

    def test_demo_account_administers_the_plant_without_django_admin(self):
        demo = get_user_model().objects.get(username='demo')
        self.assertTrue(demo.check_password('demo-pass'))
        self.assertFalse(demo.is_superuser or demo.is_staff)
        self.assertEqual(UserProfile.objects.get(user=demo).type, 'Admin')
        self.assertFalse(UserProfile.objects.filter(user__username='admin').exists())
