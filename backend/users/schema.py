"""Shapes of the account endpoints' answers, for the API documentation (they build plain dicts)."""

from rest_framework import serializers

from apiv1.serializers import UserProfileSerializer


class SessionSerializer(serializers.Serializer):
    profile = UserProfileSerializer(allow_null=True, help_text='Null for users without a profile (superusers).')


class InvitationInfoSerializer(serializers.Serializer):
    username = serializers.CharField()
    first_name = serializers.CharField()
    organization = serializers.CharField()


class DemoAccountSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class PublicSettingsSerializer(serializers.Serializer):
    signup = serializers.BooleanField(help_text='Whether new accounts can sign up.')
    demo = DemoAccountSerializer(required=False, help_text='Only on a public demo: the shared account.')


class PasswordChangedSerializer(serializers.Serializer):
    success = serializers.CharField()
