"""Shared building blocks of the API: permissions, organization scoping, checks."""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Registers the system checks (python manage.py check).
        # Describes the session login in the API documentation.
        from . import (
            checks,  # noqa: F401
            schema,  # noqa: F401
        )
