"""
Text fields of assets and maintenance plans: empty text ('') instead of NULL.

Data only; 0004 then makes the columns NOT NULL. Two migrations because PostgreSQL refuses to
alter a table in the same transaction that updated its rows (pending trigger events).
"""

from django.db import migrations

FIELDS = {
    'Asset': ['name', 'ref', 'location'],
    'MaintenancePlan': ['name', 'ref'],
}


def null_to_empty(apps, schema_editor):
    for model_name, fields in FIELDS.items():
        model = apps.get_model('db', model_name)
        for field in fields:
            model.objects.filter(**{f'{field}__isnull': True}).update(**{field: ''})


class Migration(migrations.Migration):
    dependencies = [
        ('db', '0002_delete_auto_created_tokens'),
    ]

    operations = [
        migrations.RunPython(null_to_empty, migrations.RunPython.noop),
    ]
