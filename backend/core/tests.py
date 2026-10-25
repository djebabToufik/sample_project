"""Tests of the system checks and the migrations."""

import io

from django.core.management import call_command
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings

from .checks import check_https, check_secret_key


class ChannelLayerSettingsTest(SimpleTestCase):
    def test_redis_reads_longer_than_the_layer_waits(self):
        """Otherwise every idle WebSocket fails with 'Timeout reading from redis' (redis-py 8 default: 5 s)."""
        from channels_redis.core import RedisChannelLayer
        from django.conf import settings

        for host in settings.CHANNEL_LAYERS['default']['CONFIG']['hosts']:
            self.assertGreater(host['socket_timeout'], RedisChannelLayer.brpop_timeout)


class MigrationsTest(TestCase):
    def test_every_model_change_has_a_migration(self):
        output = io.StringIO()
        try:
            call_command(
                'makemigrations', 'db', 'state', 'users', 'apiv1', 'core', '--check', '--dry-run', stdout=output
            )
        except SystemExit:
            self.fail('Models changed without a migration (run makemigrations):\n' + output.getvalue())

    def test_verify_schema_accepts_the_migrated_database(self):
        output = io.StringIO()
        call_command('verify_schema', stdout=output)
        self.assertIn('matches', output.getvalue())

    def test_verify_schema_reports_missing_columns(self):
        with connection.cursor() as cursor:
            cursor.execute('ALTER TABLE state_product DROP COLUMN product_name')
        with self.assertRaisesMessage(Exception, 'state_product.product_name'):
            call_command('verify_schema', stdout=io.StringIO())


class SystemCheckTest(SimpleTestCase):
    @override_settings(SECRET_KEY='')
    def test_missing_secret_key_stops_startup(self):
        errors = check_secret_key(None)
        self.assertEqual([e.id for e in errors], ['oee.E001'])

    def test_secret_key_set(self):
        self.assertEqual(check_secret_key(None), [])

    @override_settings(DEBUG=False, OEE_HTTPS=False)
    def test_https_warning_in_production(self):
        self.assertEqual([w.id for w in check_https(None)], ['oee.W001'])

    @override_settings(DEBUG=False, OEE_HTTPS=True)
    def test_no_https_warning_when_enabled(self):
        self.assertEqual(check_https(None), [])
