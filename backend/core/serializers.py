"""Serializers shared by the apps. They list their fields explicitly, so nothing sensitive is sent by accident."""

from django.contrib.auth.models import User
from rest_framework import serializers

from db.models import Organization


class UserSerializer(serializers.ModelSerializer):
    """Public fields of a user (never the password hash or permissions)."""

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'last_login', 'date_joined']
        read_only_fields = fields


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            'uuid',
            'created_at',
            'updated_at',
            'name',
            'subdomain',
            'max_assets',
            'max_users',
            'max_active_orders',
            'demo',
        ]
        read_only_fields = fields
