"""Tests of the db app's migrations."""

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [('db', '0002_delete_auto_created_tokens')]
AFTER = [('db', '0004_text_fields_not_null')]


class TextFieldsMigrationTest(TransactionTestCase):
    """NULL in the text fields of assets and maintenance plans becomes empty text, then NOT NULL."""

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        self.migrate(executor.loader.graph.leaf_nodes())

    def test_null_becomes_empty_text(self):
        old = self.migrate(BEFORE)
        organization = old.get_model('db', 'Organization').objects.create(name='Acme', subdomain='acme')
        asset = old.get_model('db', 'Asset').objects.create(
            organization=organization, name=None, ref=None, location=None
        )
        plan = old.get_model('db', 'MaintenancePlan').objects.create(asset=asset, name=None, ref=None)

        new = self.migrate(AFTER)
        asset = new.get_model('db', 'Asset').objects.get(pk=asset.pk)
        plan = new.get_model('db', 'MaintenancePlan').objects.get(pk=plan.pk)
        self.assertEqual((asset.name, asset.ref, asset.location), ('', '', ''))
        self.assertEqual((plan.name, plan.ref), ('', ''))

        with connection.cursor() as cursor:
            columns = connection.introspection.get_table_description(cursor, 'db_asset')
        nullable = {c.name: c.null_ok for c in columns}
        self.assertEqual([nullable[f] for f in ('name', 'ref', 'location')], [False, False, False])


class RequiredFieldsMigrationTest(TransactionTestCase):
    """db.0005 / state.0004: rows nobody can see are removed and default files cleared."""

    BEFORE = [('db', '0004_text_fields_not_null'), ('state', '0003_event_machine_created_at_index')]
    AFTER = [('db', '0006_required_organization_no_default_files'), ('state', '0005_required_line_and_organization')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        self.migrate(executor.loader.graph.leaf_nodes())

    def test_orphans_removed_and_default_files_cleared(self):
        old = self.migrate(self.BEFORE)
        org = old.get_model('db', 'Organization').objects.create(name='Acme', subdomain='acme')
        Asset = old.get_model('db', 'Asset')
        asset = Asset.objects.create(organization=org, name='Line', photo='machine_images/default.jpg')
        uploaded = Asset.objects.create(organization=org, name='Own photo', photo='machine_images/mine.jpg')
        orphan = Asset.objects.create(organization=None, name='Orphan')
        plan = old.get_model('db', 'MaintenancePlan').objects.create(
            asset=asset, instructions='instructions/default.pdf'
        )
        Event = old.get_model('state', 'Event')
        Event.objects.create(machine=None, state='on')
        Event.objects.create(machine=orphan, state='on')
        kept = Event.objects.create(machine=asset, state='on')
        Product = old.get_model('state', 'Product')
        Product.objects.create(organization=None, product_id='lost')

        new = self.migrate(self.AFTER)
        Asset = new.get_model('db', 'Asset')
        self.assertEqual(set(Asset.objects.values_list('name', flat=True)), {'Line', 'Own photo'})
        self.assertEqual(Asset.objects.get(pk=asset.pk).photo.name, '')
        self.assertEqual(Asset.objects.get(pk=uploaded.pk).photo.name, 'machine_images/mine.jpg')
        self.assertEqual(new.get_model('db', 'MaintenancePlan').objects.get(pk=plan.pk).instructions.name, '')
        self.assertEqual(list(new.get_model('state', 'Event').objects.values_list('pk', flat=True)), [kept.pk])
        self.assertFalse(new.get_model('state', 'Product').objects.exists())

    def test_profile_without_organization_stops_the_migration(self):
        old = self.migrate(self.BEFORE)
        user = old.get_model('auth', 'User').objects.create(username='lost')
        old.get_model('db', 'UserProfile').objects.create(user=user, organization=None)
        with self.assertRaisesMessage(RuntimeError, 'lost'):
            self.migrate(self.AFTER)
        # Fixed by an administrator: the migration goes through.
        old.get_model('db', 'UserProfile').objects.all().delete()
