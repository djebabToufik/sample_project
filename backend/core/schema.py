"""API documentation (drf-spectacular): what the generator cannot read from the code itself."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import serializers


class SessionCookieScheme(OpenApiAuthenticationExtension):
    """The web app's login: the session cookie of core.authentication.SessionAuthentication."""

    target_class = 'core.authentication.SessionAuthentication'
    name = 'cookieAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'apiKey', 'in': 'cookie', 'name': 'sessionid'}


class DetailSerializer(serializers.Serializer):
    """Body of an error answer."""

    detail = serializers.CharField()
