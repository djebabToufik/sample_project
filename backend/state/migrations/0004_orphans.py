"""Before line and organization become required (0005): rows without them are removed (nobody can see them)."""

from django.db import migrations


def forwards(apps, schema_editor):
    # Events of deleted lines (the line used to be set to NULL).
    apps.get_model('state', 'Event').objects.filter(machine__isnull=True).delete()
    apps.get_model('state', 'Product').objects.filter(organization__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('db', '0005_orphans_and_default_files'),
        ('state', '0003_event_machine_created_at_index'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
