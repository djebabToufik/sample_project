import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a superuser if none exist (idempotent)."

    def handle(self, *args, **options):
        User = get_user_model()

        # Check if any superuser already exists
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(self.style.SUCCESS("Superuser already exists. Skipping."))
            return

        username = os.getenv("OEE_SUPERUSER_USERNAME")
        email = os.getenv("OEE_SUPERUSER_EMAIL", "")
        password = os.getenv("OEE_SUPERUSER_PASSWORD")

        if not username or not password:
            self.stdout.write(
                self.style.WARNING(
                    "OEE_SUPERUSER_USERNAME / OEE_SUPERUSER_PASSWORD not set. Skipping superuser creation."
                )
            )
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser: {username}"))
