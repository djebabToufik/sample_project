"""Helpers for the API tests: organizations, users with a role, logged-in clients."""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from db.models import Asset, MaintenancePlan, Organization, UserProfile

PASSWORD = 'Plant-Floor-2026!'

# No Redis needed: live updates and rate limits run in memory during tests.
TEST_SETTINGS = {
    'CHANNEL_LAYERS': {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
    'CACHES': {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
}


def find_keys(data, key):
    """Every value stored under `key` anywhere in a nested response."""
    found = []
    if isinstance(data, dict):
        for name, value in data.items():
            if name == key:
                found.append(value)
            found.extend(find_keys(value, key))
    elif isinstance(data, list):
        for item in data:
            found.extend(find_keys(item, key))
    return found


class ApiTestMixin:
    """Two organizations (ours and another), each with an admin; ours also has a reporter."""

    def setUp(self):
        cache.clear()
        self.org = self.make_org('Acme')
        self.admin = self.make_user(self.org, 'admin', 'Admin')
        self.reporter = self.make_user(self.org, 'operator', 'Reporter')
        self.other_org = self.make_org('Other')
        self.other_admin = self.make_user(self.other_org, 'other_admin', 'Admin')

    @staticmethod
    def make_org(name):
        return Organization.objects.create(
            name=name, subdomain=name.lower(), max_assets=50, max_users=50, max_active_orders=500
        )

    @staticmethod
    def make_user(org, username, role='Admin'):
        user = User.objects.create_user(
            username=username,
            email=f'{username}@example.com',
            password=PASSWORD,
            first_name=username.title(),
            last_name='Tester',
        )
        UserProfile.objects.create(user=user, organization=org, type=role)
        return user

    @staticmethod
    def make_asset(org, name='Line 1'):
        # Creating an asset also records its first events (on, off).
        return Asset.objects.create(organization=org, name=name, ref=name)

    @staticmethod
    def make_plan(asset, assigned_to=None, **fields):
        return MaintenancePlan.objects.create(
            asset=asset, assigned_to=assigned_to, name=fields.pop('name', 'Check'), **fields
        )

    @staticmethod
    def client_for(user=None):
        """An API client logged in as `user` with a session (anonymous for None)."""
        client = APIClient()
        if user is not None:
            client.force_login(user)
        return client


@override_settings(**TEST_SETTINGS)
class ApiTestCase(ApiTestMixin, TestCase):
    pass


@override_settings(**TEST_SETTINGS)
class ApiTransactionTestCase(ApiTestMixin, TransactionTestCase):
    """For code that reads the database from other threads (WebSocket consumers)."""
