"""Tests of the CMMS API: invitations, login, organization isolation, roles, uploads."""

import io
import shutil
import tempfile
from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from PIL import Image
from rest_framework.test import APIClient

from core.testing import ApiTestCase, find_keys
from db.models import Asset, MaintenancePlan, Organization, UserProfile
from state.models import Cell, Event, MachineFault


class UserInvitationEmailTest(TestCase):
    """Inviting a user emails a link (no password) with the configured product name and app URL."""

    def setUp(self):
        org = Organization.objects.create(name="Acme", subdomain="acme", max_users=10)
        admin = User.objects.create_user(username="admin", password="x", first_name="Ada", last_name="Lovelace")
        UserProfile.objects.create(user=admin, organization=org, type="Admin")
        self.client = APIClient()
        self.client.force_login(admin)

    def invite(self):
        return self.client.post(
            "/api/users/",
            {
                "username": "bob",
                "email": "bob@example.com",
                "first_name": "Bob",
                "last_name": "Builder",
                "type": "Reporter",
            },
            format="json",
        )

    @override_settings(APP_NAME="Acme Maintenance", APP_URL="https://acme.example.com")
    def test_email_uses_configured_name_and_url(self):
        response = self.invite()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, "Invitation from: Ada Lovelace")
        self.assertEqual(message.to, ["bob@example.com"])
        self.assertIn("Hello Bob Builder,", message.body)
        self.assertIn("invited to Acme Maintenance", message.body)
        self.assertIn("Your username is: bob", message.body)
        self.assertIn("https://acme.example.com/invitation?uid=", message.body)
        self.assertNotIn("password is", message.body.lower())

    @override_settings(APP_URL="", ALLOWED_HOSTS=["app.customer.com"])
    def test_email_falls_back_to_request_host(self):
        self.client.defaults["HTTP_HOST"] = "app.customer.com"
        response = self.invite()

        self.assertEqual(response.status_code, 201)
        self.assertIn("http://app.customer.com/invitation?uid=", mail.outbox[0].body)

    def test_failed_email_leaves_no_user_behind(self):
        with (
            mock.patch("users.invitations.send_mail", side_effect=OSError("SMTP down")),
            self.assertLogs("apiv1.views", level="ERROR") as logs,
        ):
            response = self.invite()

        self.assertIn("Invitation email could not be sent", logs.output[0])

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="bob").exists())

    def test_existing_username_sends_no_email(self):
        User.objects.create_user(username="bob", password="x")
        response = self.invite()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_existing_email_is_refused(self):
        User.objects.create_user(username="robert", email="BOB@example.com", password="x")
        response = self.invite()

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.json())


class LoginRequiredTest(ApiTestCase):
    """Without a token the API answers 401, never data and never a server error."""

    def test_anonymous_requests_get_401(self):
        client = self.client_for(None)
        for path in [
            '/api/assets/',
            '/api/maintenance-plans/',
            '/api/maintenance-plans/mine/',
            '/api/users/',
            '/api/events/',
            '/api/cells/',
            '/api/faults/',
            '/api/products/',
            '/api/downtime/',
        ]:
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 401)
        self.assertEqual(client.post('/api/auth/password/', {}).status_code, 401)

    def test_user_without_organization_is_refused(self):
        user = User.objects.create_user(username='loner', password='x')
        client = APIClient()
        client.force_login(user)
        self.assertEqual(client.get('/api/assets/').status_code, 403)
        # The login flow reads the session: no profile, not an error.
        response = client.get('/api/auth/session/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'profile': None})

    def test_removed_endpoints(self):
        client = self.client_for(None)
        self.assertEqual(client.post('/api/token/', {'username': 'admin', 'password': 'x'}).status_code, 404)
        self.assertEqual(client.get('/api-auth/login/').status_code, 404)
        self.assertEqual(client.post('/api/api-token-auth/', {'username': 'admin', 'password': 'x'}).status_code, 404)
        # The old paths of the API (before /api/ without v1 / v2).
        for path in ['/api/v1/assets/', '/api/v2/events/', '/api/v1/my-profile/', '/api/password_reset/']:
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 404)


class NoSensitiveDataTest(ApiTestCase):
    """Users appear with their public fields only: never password hashes or permissions."""

    def setUp(self):
        super().setUp()
        asset = self.make_asset(self.org)
        asset.created_by = self.admin
        asset.save()
        plan = self.make_plan(asset, assigned_to=self.reporter)
        plan.created_by = self.admin
        plan.save()

    def test_no_password_hash_anywhere(self):
        client = self.client_for(self.admin)
        for path in [
            '/api/users/',
            '/api/auth/session/',
            '/api/assets/',
            '/api/maintenance-plans/',
            '/api/maintenance-plans/mine/',
        ]:
            with self.subTest(path=path):
                response = client.get(path)
                self.assertEqual(response.status_code, 200)
                for key in ('password', 'is_superuser', 'is_staff', 'user_permissions', 'groups'):
                    self.assertEqual(find_keys(response.json(), key), [], key)

    def test_users_keep_their_public_fields(self):
        response = self.client_for(self.admin).get('/api/maintenance-plans/')
        plan = response.json()[0]
        self.assertEqual(plan['assigned_to']['username'], 'operator')
        self.assertEqual(plan['created_by']['id'], self.admin.id)
        self.assertEqual(plan['asset']['name'], 'Line 1')


class OrganizationIsolationTest(ApiTestCase):
    """Data of another organization can't be seen, changed, deleted or linked to."""

    def setUp(self):
        super().setUp()
        self.asset = self.make_asset(self.org, 'Ours')
        self.other_asset = self.make_asset(self.other_org, 'Theirs')
        self.other_plan = self.make_plan(self.other_asset, assigned_to=self.other_admin)
        self.client = self.client_for(self.admin)

    def test_lists_only_show_own_organization(self):
        names = [a['name'] for a in self.client.get('/api/assets/').json()]
        self.assertEqual(names, ['Ours'])
        self.assertEqual(self.client.get('/api/maintenance-plans/').json(), [])
        users = [p['user']['username'] for p in self.client.get('/api/users/').json()]
        self.assertCountEqual(users, ['admin', 'operator'])

    def test_other_organization_objects_are_not_found(self):
        other_profile = self.other_admin.userprofile
        for path in [
            f'/api/assets/{self.other_asset.uuid}/',
            f'/api/maintenance-plans/{self.other_plan.uuid}/',
            f'/api/users/{other_profile.uuid}/',
        ]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)
                self.assertEqual(self.client.patch(path, {'name': 'x'}).status_code, 404)
                self.assertEqual(self.client.delete(path).status_code, 404)
        self.assertEqual(self.client.get(f'/api/maintenance-plans/{self.other_plan.uuid}/').status_code, 404)
        self.assertTrue(Asset.objects.filter(pk=self.other_asset.pk).exists())
        self.assertTrue(MaintenancePlan.objects.filter(pk=self.other_plan.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.other_admin.pk).exists())

    def test_plan_cannot_use_another_organizations_asset_or_user(self):
        response = self.client.post('/api/maintenance-plans/', {'name': 'x', 'asset': str(self.other_asset.uuid)})
        self.assertEqual(response.status_code, 400)
        self.assertIn('asset', response.json())

        response = self.client.post(
            '/api/maintenance-plans/',
            {
                'name': 'x',
                'asset': str(self.asset.uuid),
                'assigned_to': self.other_admin.id,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('assigned_to', response.json())
        self.assertFalse(MaintenancePlan.objects.filter(asset=self.asset).exists())

    def test_plan_cannot_be_moved_to_another_organization(self):
        plan = self.make_plan(self.asset)
        url = f'/api/maintenance-plans/{plan.uuid}/'
        response = self.client.patch(url, {'asset': str(self.other_asset.uuid)})
        self.assertEqual(response.status_code, 400)
        plan.refresh_from_db()
        self.assertEqual(plan.asset, self.asset)

    def test_created_objects_belong_to_own_organization(self):
        response = self.client.post(
            '/api/assets/', {'name': 'New', 'ref': 'N1', 'organization': str(self.other_org.uuid)}
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Asset.objects.get(name='New').organization, self.org)

        response = self.client.post(
            '/api/maintenance-plans/',
            {
                'name': 'Mine',
                'asset': str(self.asset.uuid),
                'assigned_to': self.reporter.id,
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(MaintenancePlan.objects.get(name='Mine').created_by, self.admin)

    def test_asset_limit(self):
        self.org.max_assets = 1
        self.org.save()
        response = self.client.post('/api/assets/', {'name': 'Too many', 'ref': 'X'})
        self.assertEqual(response.status_code, 402)


class RolesTest(ApiTestCase):
    """Reporters (operators) can do what the operator view needs, and nothing more."""

    def setUp(self):
        super().setUp()
        self.asset = self.make_asset(self.org)
        self.my_plan = self.make_plan(self.asset, assigned_to=self.reporter, name='Mine')
        self.other_plan = self.make_plan(self.asset, assigned_to=self.admin, name='Theirs')
        self.client = self.client_for(self.reporter)

    def test_reporter_reads_what_the_operator_view_needs(self):
        for path in [
            '/api/assets/',
            '/api/maintenance-plans/mine/',
            '/api/maintenance-plans/',
            '/api/cells/',
            '/api/faults/',
            '/api/products/',
        ]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)
        plans = [p['name'] for p in self.client.get('/api/maintenance-plans/mine/').json()]
        self.assertEqual(plans, ['Mine'])

    def test_reporter_updates_progress_of_own_plan_only(self):
        url = f'/api/maintenance-plans/{self.my_plan.uuid}/'
        response = self.client.patch(
            url, {'status': 'In Progress', 'started_at': '2026-10-23T08:00:00Z', 'name': 'Renamed'}
        )
        self.assertEqual(response.status_code, 200)
        self.my_plan.refresh_from_db()
        self.assertEqual(self.my_plan.status, 'In Progress')
        self.assertEqual(self.my_plan.name, 'Mine')  # other fields are not theirs to change

        response = self.client.patch(f'/api/maintenance-plans/{self.other_plan.uuid}/', {'status': 'Completed'})
        self.assertEqual(response.status_code, 403)
        self.other_plan.refresh_from_db()
        self.assertEqual(self.other_plan.status, 'Pending')

    def test_reporter_cannot_administer(self):
        asset_url = f'/api/assets/{self.asset.uuid}/'
        line = str(self.asset.uuid)
        attempts = [
            ('get', '/api/users/', None),
            ('post', '/api/users/', {'username': 'x'}),
            ('post', '/api/assets/', {'name': 'x'}),
            ('patch', asset_url, {'name': 'x'}),
            ('delete', asset_url, None),
            ('post', '/api/maintenance-plans/', {'name': 'x', 'asset': line}),
            ('delete', f'/api/maintenance-plans/{self.my_plan.uuid}/', None),
            ('post', '/api/cells/', {'name': 'x', 'machine': line}),
            ('post', '/api/faults/', {'name': 'x', 'machine': line}),
            ('post', '/api/products/', {'product_id': 'p1'}),
        ]
        for method, path, data in attempts:
            with self.subTest(method=method, path=path):
                self.assertEqual(getattr(self.client, method)(path, data).status_code, 403)

    def test_reporter_cannot_make_themselves_admin(self):
        profile = self.reporter.userprofile
        response = self.client.patch(f'/api/users/{profile.uuid}/', {'type': 'Admin'})
        self.assertEqual(response.status_code, 403)
        profile.refresh_from_db()
        self.assertEqual(profile.type, 'Reporter')

    def test_admin_cannot_remove_own_role_or_user(self):
        client = self.client_for(self.admin)
        profile = self.admin.userprofile
        response = client.patch(f'/api/users/{profile.uuid}/', {'type': 'Reporter'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(client.delete(f'/api/users/{profile.uuid}/').status_code, 400)

    def test_admin_changes_role_and_removes_users(self):
        client = self.client_for(self.admin)
        profile = self.reporter.userprofile
        response = client.patch(f'/api/users/{profile.uuid}/', {'type': 'Admin'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.delete(f'/api/users/{profile.uuid}/').status_code, 204)
        self.assertFalse(User.objects.filter(username='operator').exists())


def png_file(name='photo.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (2, 2), 'red').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


class UploadTest(ApiTestCase):
    """Photos must be images and instructions PDFs, within the size limit."""

    def setUp(self):
        super().setUp()
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        self.asset = self.make_asset(self.org)
        self.client = self.client_for(self.admin)

    def patch_asset(self, upload):
        with self.settings(MEDIA_ROOT=self.media_root):
            return self.client.patch(f'/api/assets/{self.asset.uuid}/', {'photo': upload}, format='multipart')

    def test_photo_must_be_an_image(self):
        script = SimpleUploadedFile('photo.html', b'<script>alert(1)</script>', content_type='text/html')
        self.assertEqual(self.patch_asset(script).status_code, 400)
        disguised = SimpleUploadedFile('photo.png', b'<script>alert(1)</script>', content_type='image/png')
        self.assertEqual(self.patch_asset(disguised).status_code, 400)

    def test_valid_photo_is_accepted(self):
        self.assertEqual(self.patch_asset(png_file()).status_code, 200)

    @override_settings(MAX_UPLOAD_SIZE_MB=0)
    def test_size_limit(self):
        response = self.patch_asset(png_file())
        self.assertEqual(response.status_code, 400)
        self.assertIn('too large', str(response.json()))

    def test_instructions_must_be_pdf(self):
        plan = self.make_plan(self.asset)
        upload = SimpleUploadedFile('instructions.html', b'<html></html>', content_type='text/html')
        with self.settings(MEDIA_ROOT=self.media_root):
            response = self.client.patch(
                f'/api/maintenance-plans/{plan.uuid}/', {'instructions': upload}, format='multipart'
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn('instructions', response.json())


class MaintenanceStatusTest(ApiTestCase):
    """The asset status follows its plans; closed plans don't count against the order limit."""

    def setUp(self):
        super().setUp()
        self.asset = self.make_asset(self.org)
        self.client = self.client_for(self.admin)

    def asset_status(self):
        self.asset.refresh_from_db()
        return self.asset.status

    def test_asset_stays_under_maintenance_while_any_plan_is_in_progress(self):
        first = self.make_plan(self.asset, status='In Progress')
        second = self.make_plan(self.asset, status='In Progress')
        self.assertEqual(self.asset_status(), 'Under Maintenance')

        first.status = 'Completed'
        first.save()
        self.assertEqual(self.asset_status(), 'Under Maintenance')

        second.delete()
        self.assertEqual(self.asset_status(), 'Active')

    def test_retired_asset_keeps_its_status(self):
        self.asset.status = 'Retired'
        self.asset.save()
        self.make_plan(self.asset, status='In Progress')
        self.assertEqual(self.asset_status(), 'Retired')

    def test_asset_with_plans_is_not_deleted(self):
        self.make_plan(self.asset, status='Completed')
        response = self.client.delete(f'/api/assets/{self.asset.uuid}/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Retire it instead', response.json()['detail'])
        self.assertTrue(Asset.objects.filter(pk=self.asset.pk).exists())

    def test_deleting_an_asset_deletes_its_events_cells_and_faults(self):
        Cell.objects.create(machine=self.asset, name='A')
        MachineFault.objects.create(machine=self.asset, name='Jam')
        self.assertEqual(Event.objects.filter(machine=self.asset).count(), 2)  # on, off at creation
        self.assertEqual(self.client.delete(f'/api/assets/{self.asset.uuid}/').status_code, 204)
        self.assertFalse(Event.objects.exists() or Cell.objects.exists() or MachineFault.objects.exists())

    def test_nothing_uploaded_means_no_file(self):
        self.assertIsNone(self.client.get(f'/api/assets/{self.asset.uuid}/').json()['photo'])
        plan = self.make_plan(self.asset)
        self.assertIsNone(self.client.get(f'/api/maintenance-plans/{plan.uuid}/').json()['instructions'])
        self.assertEqual(self.client.get(f'/api/assets/{self.asset.uuid}/photo/').status_code, 404)

    def test_closed_plans_do_not_count_as_active_orders(self):
        self.org.max_active_orders = 1
        self.org.save()
        self.make_plan(self.asset, status='Completed')
        self.make_plan(self.asset, status='Cancelled')

        def create():
            return self.client.post('/api/maintenance-plans/', {'name': 'New', 'asset': str(self.asset.uuid)})

        self.assertEqual(create().status_code, 201)
        self.assertEqual(create().status_code, 402)


class ListQueriesTest(ApiTestCase):
    def test_maintenance_list_queries_do_not_grow_with_the_plans(self):
        client = self.client_for(self.admin)

        def queries():
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(client.get('/api/maintenance-plans/').status_code, 200)
            return len(captured)

        asset = Asset.objects.create(organization=self.org, name='A', created_by=self.admin)
        self.make_plan(asset, assigned_to=self.reporter)
        few = queries()
        for i in range(5):
            line = Asset.objects.create(organization=self.org, name=f'L{i}', created_by=self.admin)
            self.make_plan(line, assigned_to=self.reporter)
        self.assertEqual(queries(), few)
