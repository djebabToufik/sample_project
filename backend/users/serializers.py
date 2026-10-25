"""Serializers of the account endpoints (login, sign-up, invitations, password change)."""

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from core.organization import ADMIN
from db.models import Organization, UserProfile

from .invitations import user_from_link


def check_password_strength(password, user, field):
    """Django's password validators (AUTH_PASSWORD_VALIDATORS), reported on `field`."""
    try:
        validate_password(password, user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({field: list(error.messages)}) from error


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class SignupSerializer(serializers.Serializer):
    """A new account: the user, their organization, and their admin profile."""

    username = serializers.CharField(
        max_length=150,
        validators=[
            UnicodeUsernameValidator(),
            UniqueValidator(User.objects.all(), message='This username is already taken.'),
        ],
    )
    email = serializers.EmailField(
        validators=[UniqueValidator(User.objects.all(), message='E-mail already exist', lookup='iexact')],
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password2 = serializers.CharField(write_only=True, trim_whitespace=False)
    organization = serializers.CharField(max_length=250, write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': "Password doesn't match"})
        check_password_strength(attrs['password'], User(username=attrs['username'], email=attrs['email']), 'password')
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data['email'],
                password=validated_data['password'],
            )
            organization = Organization.objects.create(name=validated_data['organization'])
            UserProfile.objects.create(user=user, organization=organization, type=ADMIN)
        return user


class InvitationSerializer(serializers.Serializer):
    """The uid and token of an invitation link; valid only while the invitation is open."""

    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs):
        user = user_from_link(attrs['uid'], attrs['token'])
        if user is None:
            raise serializers.ValidationError(
                'This invitation link is not valid any more. Ask your administrator for a new one.'
            )
        attrs['user'] = user
        return attrs


class AcceptInvitationSerializer(InvitationSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password2 = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': "Password doesn't match"})
        check_password_strength(attrs['password'], attrs['user'], 'password')
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        user.set_password(self.validated_data['password'])
        user.save(update_fields=['password'])
        return user


class ChangePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_1 = serializers.CharField(write_only=True, trim_whitespace=False)
    password_2 = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if not self.context['request'].user.check_password(attrs['password']):
            raise serializers.ValidationError({'password': 'Wrong password'})
        if attrs['password_1'] != attrs['password_2']:
            raise serializers.ValidationError({'password_2': 'password does not match'})
        check_password_strength(attrs['password_1'], self.context['request'].user, 'password_1')
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['password_1'])
        user.save(update_fields=['password'])
        return user
