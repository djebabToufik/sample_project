"""
System checks (python manage.py check). They also run before migrate and collectstatic,
so a container with a broken configuration stops at startup instead of running insecurely.
"""

from django.conf import settings
from django.core.checks import Error, Tags, Warning, register
from django.core.exceptions import ImproperlyConfigured


@register(Tags.security)
def check_secret_key(app_configs, **kwargs):
    try:
        secret_key = settings.SECRET_KEY
    except ImproperlyConfigured:
        secret_key = ''
    if not secret_key:
        return [
            Error(
                'OEE_SECRET_KEY is not set.',
                hint='Set OEE_SECRET_KEY to a long random value, for example the output of '
                '"python -c \'import secrets; print(secrets.token_urlsafe(50))\'".',
                id='oee.E001',
            )
        ]
    return []


@register(Tags.security, deploy=True)
def check_https(app_configs, **kwargs):
    if not settings.DEBUG and not settings.OEE_HTTPS:
        return [
            Warning(
                'OEE_HTTPS is off: cookies are not marked secure and no HSTS header is sent.',
                hint='Serve the app over HTTPS and set OEE_HTTPS=True.',
                id='oee.W001',
            )
        ]
    return []
