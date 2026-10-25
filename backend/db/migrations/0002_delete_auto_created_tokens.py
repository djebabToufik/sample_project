"""
Deletes the API tokens that were created automatically for every user.

The web app now logs in with a session cookie. API tokens are only for other software and are
created on purpose in the Django admin (Auth Token > Tokens).
"""

from django.db import migrations


def delete_tokens(apps, schema_editor):
    apps.get_model('authtoken', 'Token').objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('db', '0001_initial'),
        ('authtoken', '0004_alter_tokenproxy_options'),
    ]

    operations = [
        migrations.RunPython(delete_tokens, migrations.RunPython.noop),
    ]
