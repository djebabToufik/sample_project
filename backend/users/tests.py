"""Tests of the account endpoints: sign-up, login, password reset and change, rate limits."""

import re
from datetime import datetime, timedelta
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django_rest_passwordreset.models import ResetPasswordToken
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from core.testing import PASSWORD, ApiTestCase
from db.models import Organization

SIGNUP = {
    'username': 'newcomer',
    'email': 'newcomer@example.com',
    'password': 'Shift-Change-77!',
    'password2': 'Shift-Change-77!',
    'organization': 'New Plant',
}


def low_rates(**rates):
    """Rate limits for a test (DRF reads the rates once, so they are patched on the class)."""
    return mock.patch.object(ScopedRateThrottle, 'THROTTLE_RATES', rates)


class SignupTest(ApiTestCase):
    def signup(self, **changes):
        return self.client_for(None).post('/api/auth/signup/', {**SIGNUP, **changes}, format='json')

    def test_signup_creates_admin_of_a_new_organization(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('password', response.json())
        user = User.objects.get(username='newcomer')
        self.assertTrue(user.check_password(SIGNUP['password']))
        self.assertEqual(user.userprofile.type, 'Admin')
        self.assertEqual(user.userprofile.organization.name, 'New Plant')

    @override_settings(ALLOW_SIGNUP=False)
    def test_signup_can_be_turned_off(self):
        response = self.signup()
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username='newcomer').exists())

    def test_invalid_signups(self):
        cases = {
            'password2': {'password2': 'something-else'},
            'password': {'password': 'password', 'password2': 'password'},
            'email': {'email': 'ADMIN@example.com'},
            'username': {'username': 'admin'},
            'organization': {'organization': ''},
        }
        for field, changes in cases.items():
            with self.subTest(field=field):
                response = self.signup(**changes)
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())
        self.assertFalse(Organization.objects.filter(name='New Plant').exists())

    def test_signup_is_rate_limited(self):
        with low_rates(signup='2/hour'):
            self.assertEqual(self.signup(username='a1', email='a1@example.com').status_code, 201)
            self.assertEqual(self.signup(username='a2', email='a2@example.com').status_code, 201)
            self.assertEqual(self.signup(username='a3', email='a3@example.com').status_code, 429)


class LoginTest(ApiTestCase):
    def login(self, password, client=None):
        client = client or self.client_for(None)
        return client.post('/api/auth/login/', {'username': 'admin', 'password': password})

    def test_login_starts_a_session(self):
        client = self.client_for(None)
        self.assertEqual(client.get('/api/auth/session/').status_code, 401)

        response = self.login(PASSWORD, client)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['profile']['user']['username'], 'admin')
        self.assertNotIn('token', response.json())
        cookie = response.cookies['sessionid']
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Lax')

        # A reload asks for the session: still logged in.
        session = client.get('/api/auth/session/')
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.json()['profile']['type'], 'Admin')
        self.assertEqual(client.get('/api/assets/').status_code, 200)

    def test_wrong_password(self):
        response = self.login('wrong')
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('sessionid', response.cookies)

    def test_login_gets_a_new_session_id(self):
        client = self.client_for(None)
        session = client.session
        session['visited'] = True
        session.save()
        before = session.session_key
        self.login(PASSWORD, client)
        self.assertNotEqual(client.cookies['sessionid'].value, before)

    def test_user_without_profile_gets_no_profile(self):
        User.objects.create_superuser(username='root', password=PASSWORD)
        client = self.client_for(None)
        response = client.post('/api/auth/login/', {'username': 'root', 'password': PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['profile'])
        self.assertEqual(client.get('/api/assets/').status_code, 403)

    def test_logout_ends_the_session_on_the_server(self):
        client = self.client_for(None)
        self.login(PASSWORD, client)
        old_cookie = client.cookies['sessionid'].value
        self.assertEqual(client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(client.get('/api/auth/session/').status_code, 401)

        # The old cookie, copied before logout, is worthless.
        copy = self.client_for(None)
        copy.cookies['sessionid'] = old_cookie
        self.assertEqual(copy.get('/api/assets/').status_code, 401)

    def test_session_settings(self):
        self.assertEqual(settings.SESSION_COOKIE_AGE, 14 * 24 * 60 * 60)
        self.assertTrue(settings.SESSION_SAVE_EVERY_REQUEST)  # renewed while used
        self.assertTrue(settings.SESSION_COOKIE_HTTPONLY)

    def test_login_is_rate_limited(self):
        with low_rates(login='3/min'):
            for _ in range(3):
                self.assertEqual(self.login('wrong').status_code, 400)
            self.assertEqual(self.login(PASSWORD).status_code, 429)

    def test_clients_behind_the_proxy_are_limited_separately(self):
        with low_rates(login='1/min'):
            data = {'username': 'admin', 'password': 'wrong'}
            client = self.client_for(None)
            first = client.post('/api/auth/login/', data, HTTP_X_FORWARDED_FOR='10.0.0.1')
            again = client.post('/api/auth/login/', data, HTTP_X_FORWARDED_FOR='10.0.0.1')
            other = client.post('/api/auth/login/', data, HTTP_X_FORWARDED_FOR='10.0.0.2')
            self.assertEqual([first.status_code, again.status_code, other.status_code], [400, 429, 400])


class CsrfTest(ApiTestCase):
    """With the session cookie, changes need the CSRF header, which a page on another site cannot send."""

    def browser(self):
        return APIClient(enforce_csrf_checks=True)

    def csrf_token(self, client):
        client.get('/api/auth/session/')  # sets the csrftoken cookie, also when logged out
        return client.cookies['csrftoken'].value

    def test_login_needs_the_csrf_header(self):
        client = self.browser()
        data = {'username': 'admin', 'password': PASSWORD}
        refused = client.post('/api/auth/login/', data)
        self.assertEqual(refused.status_code, 403)
        self.assertIn('CSRF', refused.json()['detail'])

        response = client.post('/api/auth/login/', data, HTTP_X_CSRFTOKEN=self.csrf_token(client))
        self.assertEqual(response.status_code, 200)

    def test_changes_need_the_csrf_header(self):
        client = self.browser()
        login = {'username': 'admin', 'password': PASSWORD}
        client.post('/api/auth/login/', login, HTTP_X_CSRFTOKEN=self.csrf_token(client))
        token = client.cookies['csrftoken'].value  # renewed at login
        data = {'name': 'Line', 'ref': 'L1'}

        self.assertEqual(client.get('/api/assets/').status_code, 200)  # reading needs no header
        self.assertEqual(client.post('/api/assets/', data).status_code, 403)
        self.assertEqual(client.post('/api/assets/', data, HTTP_X_CSRFTOKEN=token).status_code, 201)
        self.assertEqual(client.post('/api/auth/logout/').status_code, 403)
        self.assertEqual(client.post('/api/auth/logout/', HTTP_X_CSRFTOKEN=token).status_code, 204)


class ApiTokenTest(ApiTestCase):
    """Other software uses an API token created in the Django admin; no CSRF header needed."""

    def test_token_created_in_the_admin_works(self):
        token = Token.objects.create(user=self.reporter)
        client = APIClient(enforce_csrf_checks=True)
        client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        line = self.make_asset(self.org)
        self.assertEqual(client.get('/api/assets/').status_code, 200)
        response = client.post('/api/events/', {'machine': str(line.uuid), 'state': 'on'}, format='json')
        self.assertEqual(response.status_code, 201)
        # The role of its user still applies.
        self.assertEqual(client.post('/api/assets/', {'name': 'x'}).status_code, 403)

    def test_users_get_no_token_automatically(self):
        self.assertFalse(Token.objects.exists())
        self.make_user(self.org, 'newcomer', 'Reporter')
        self.assertFalse(Token.objects.exists())


class PasswordResetTest(ApiTestCase):
    def request_reset(self, email):
        return self.client_for(None).post('/api/auth/password-reset/', {'email': email})

    def test_answer_does_not_reveal_whether_the_email_exists(self):
        unknown = self.request_reset('nobody@example.com')
        known = self.request_reset('admin@example.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.json(), known.json())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['admin@example.com'])

    def test_password_reset_is_rate_limited(self):
        with low_rates(**{'django-rest-passwordreset-request-token': '2/hour'}):
            self.request_reset('a@example.com')
            self.request_reset('b@example.com')
            self.assertEqual(self.request_reset('c@example.com').status_code, 429)

    def test_reset_ends_every_session(self):
        browser = self.client_for(self.admin)
        token = ResetPasswordToken.objects.create(user=self.admin)
        response = self.client_for(None).post(
            '/api/auth/password-reset/confirm/', {'token': token.key, 'password': 'New-Shift-Pass-9'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(browser.get('/api/auth/session/').status_code, 401)


class ChangePasswordTest(ApiTestCase):
    def change(self, **data):
        return self.client_for(self.reporter).post('/api/auth/password/', data)

    def test_other_sessions_end_the_current_one_stays(self):
        current = self.client_for(self.reporter)
        other_device = self.client_for(self.reporter)
        response = current.post(
            '/api/auth/password/',
            {'password': PASSWORD, 'password_1': 'New-Shift-Pass-9', 'password_2': 'New-Shift-Pass-9'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(current.get('/api/auth/session/').status_code, 200)
        self.assertEqual(other_device.get('/api/auth/session/').status_code, 401)

    def test_change_password(self):
        response = self.change(password=PASSWORD, password_1='New-Shift-Pass-9', password_2='New-Shift-Pass-9')
        self.assertEqual(response.status_code, 200)
        self.reporter.refresh_from_db()
        self.assertTrue(self.reporter.check_password('New-Shift-Pass-9'))

    def test_refused_changes(self):
        cases = {
            'password': {'password': 'wrong', 'password_1': 'New-Shift-Pass-9', 'password_2': 'New-Shift-Pass-9'},
            'password_2': {'password': PASSWORD, 'password_1': 'New-Shift-Pass-9', 'password_2': 'other'},
            'password_1': {'password': PASSWORD, 'password_1': '1234', 'password_2': '1234'},
        }
        for field, data in cases.items():
            with self.subTest(field=field):
                response = self.change(**data)
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())
        self.reporter.refresh_from_db()
        self.assertTrue(self.reporter.check_password(PASSWORD))


class InvitationTest(ApiTestCase):
    """New users get a link to set their own password: once, within OEE_INVITATION_DAYS, own organization."""

    NEW_PASSWORD = 'First-Shift-Day-1'

    def invite(self, username='bob'):
        response = self.client_for(self.admin).post(
            '/api/users/',
            {
                'username': username,
                'email': f'{username}@example.com',
                'first_name': username.title(),
                'last_name': 'Builder',
                'type': 'Reporter',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    @staticmethod
    def last_link():
        match = re.search(r'/invitation\?uid=([^&\s]+)&token=(\S+)', mail.outbox[-1].body)
        return {'uid': match[1], 'token': match[2]}

    def accept(self, link, client=None, password=NEW_PASSWORD):
        client = client or self.client_for(None)
        return client.post('/api/auth/invitation/accept/', {**link, 'password': password, 'password2': password})

    def test_invited_user_has_no_password_until_the_link_is_used(self):
        profile = self.invite()
        self.assertTrue(profile['invitation_pending'])
        self.assertFalse(User.objects.get(username='bob').has_usable_password())
        response = self.client_for(None).post('/api/auth/login/', {'username': 'bob', 'password': ''})
        self.assertEqual(response.status_code, 400)

        users = self.client_for(self.admin).get('/api/users/').json()
        pending = {p['user']['username']: p['invitation_pending'] for p in users}
        self.assertEqual(pending, {'admin': False, 'operator': False, 'bob': True})

    def test_link_shows_who_is_invited(self):
        self.invite()
        response = self.client_for(None).get('/api/auth/invitation/', self.last_link())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'username': 'bob', 'first_name': 'Bob', 'organization': 'Acme'})

    def test_accepting_sets_the_password_and_logs_in_once(self):
        self.invite()
        link = self.last_link()
        browser = self.client_for(None)
        response = self.accept(link, browser)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['profile']['user']['username'], 'bob')
        self.assertFalse(response.json()['profile']['invitation_pending'])
        self.assertEqual(browser.get('/api/auth/session/').status_code, 200)

        # The link is used up.
        self.assertEqual(self.accept(link, password='Another-Pass-77').status_code, 400)
        self.assertEqual(self.client_for(None).get('/api/auth/invitation/', link).status_code, 400)
        login = self.client_for(None).post('/api/auth/login/', {'username': 'bob', 'password': self.NEW_PASSWORD})
        self.assertEqual(login.status_code, 200)

    def test_broken_links_are_refused(self):
        self.invite()
        link = self.last_link()
        others = [
            {**link, 'token': 'not-a-token'},
            {**link, 'uid': 'garbage'},
            {**link, 'uid': urlsafe_base64_encode(force_bytes(self.admin.pk))},  # another user's id
        ]
        for broken in others:
            with self.subTest(broken=broken):
                response = self.client_for(None).get('/api/auth/invitation/', broken)
                self.assertEqual(response.status_code, 400)
                self.assertIn('not valid any more', response.json()['non_field_errors'][0])
                self.assertEqual(self.accept(broken).status_code, 400)

    def test_links_expire(self):
        self.invite()
        link = self.last_link()
        later = datetime.now() + timedelta(days=8)
        with mock.patch('django.contrib.auth.tokens.PasswordResetTokenGenerator._now', return_value=later):
            self.assertEqual(self.client_for(None).get('/api/auth/invitation/', link).status_code, 400)
            self.assertEqual(self.accept(link).status_code, 400)

    def test_weak_password_is_refused(self):
        self.invite()
        response = self.accept(self.last_link(), password='1234')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())
        self.assertFalse(User.objects.get(username='bob').has_usable_password())

    def test_accepting_needs_the_csrf_header(self):
        self.invite()
        browser = APIClient(enforce_csrf_checks=True)
        self.assertEqual(self.accept(self.last_link(), browser).status_code, 403)

    def test_resend_replaces_the_link(self):
        profile = self.invite()
        old_link = self.last_link()
        url = f"/api/users/{profile['uuid']}/resend-invitation/"
        response = self.client_for(self.admin).post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        new_link = self.last_link()
        self.assertEqual(self.client_for(None).get('/api/auth/invitation/', old_link).status_code, 400)
        self.assertEqual(self.accept(new_link).status_code, 200)
        # Accepted: nothing to resend.
        self.assertEqual(self.client_for(self.admin).post(url).status_code, 400)

    def test_resend_is_for_admins_of_the_organization(self):
        profile = self.invite()
        url = f"/api/users/{profile['uuid']}/resend-invitation/"
        self.assertEqual(self.client_for(self.reporter).post(url).status_code, 403)
        self.assertEqual(self.client_for(self.other_admin).post(url).status_code, 404)
        self.assertEqual(len(mail.outbox), 1)

    def test_invitation_endpoints_are_rate_limited(self):
        self.invite()
        link = self.last_link()
        with low_rates(invitation='2/hour'):
            client = self.client_for(None)
            client.get('/api/auth/invitation/', link)
            client.get('/api/auth/invitation/', link)
            self.assertEqual(client.get('/api/auth/invitation/', link).status_code, 429)


class PublicSettingsTest(TestCase):
    def test_public_pages_know_whether_signup_is_open(self):
        client = APIClient()
        self.assertEqual(client.get('/api/auth/settings/').json(), {'signup': True})
        with override_settings(ALLOW_SIGNUP=False):
            self.assertEqual(client.get('/api/auth/settings/').json(), {'signup': False})
