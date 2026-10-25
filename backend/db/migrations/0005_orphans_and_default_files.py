"""
Before organization and user become required (0006): rows without them are removed, and the
default file paths ("nothing uploaded") become empty.
"""

from django.db import migrations

DEFAULT_FILES = {
    'Asset': ('photo', 'machine_images/default.jpg'),
    'MaintenancePlan': ('instructions', 'instructions/default.pdf'),
    'UserProfile': ('profile_photo', 'default.jpg'),
}


def forwards(apps, schema_editor):
    UserProfile = apps.get_model('db', 'UserProfile')
    broken = UserProfile.objects.filter(organization__isnull=True) | UserProfile.objects.filter(user__isnull=True)
    if broken.exists():
        # Deleting a profile also deletes its user account, so this is left to an administrator.
        names = ', '.join(str(p.user.username if p.user_id else p.pk) for p in broken)
        raise RuntimeError(
            f'User profiles without an organization or user: {names}. '
            'Give them an organization (Django admin) or delete them, then migrate again.'
        )

    # Assets without an organization are invisible to everyone (their events, cells, faults
    # and plans with them).
    apps.get_model('db', 'Asset').objects.filter(organization__isnull=True).delete()

    for model, (field, default) in DEFAULT_FILES.items():
        apps.get_model('db', model).objects.filter(**{field: default}).update(**{field: ''})


class Migration(migrations.Migration):
    dependencies = [
        ('db', '0004_text_fields_not_null'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
