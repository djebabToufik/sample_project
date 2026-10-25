"""
python manage.py verify_schema: checks that the database has every table and column of the models.

Runs at startup after migrate (entrypoint.sh). Before the migrations were kept in git, each container
wrote its own, so a database can be marked as migrated while it misses columns. Starting the app on
such a database would fail at random requests; this stops the start with the list of what is missing.
"""

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = 'Checks that the database has every table and column of the models.'

    def handle(self, *args, **options):
        problems = []
        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names(cursor))
            for model in apps.get_models(include_auto_created=True):
                meta = model._meta
                if not meta.managed or meta.proxy:
                    continue
                if meta.db_table not in tables:
                    problems.append(f'table {meta.db_table} ({meta.label}) is missing')
                    continue
                columns = {c.name for c in connection.introspection.get_table_description(cursor, meta.db_table)}
                problems.extend(
                    f'column {meta.db_table}.{field.column} ({meta.label}.{field.name}) is missing'
                    for field in meta.local_concrete_fields
                    if field.column not in columns
                )

        if problems:
            raise CommandError(
                'The database does not match the models:\n  - ' + '\n  - '.join(problems) + '\n'
                'Back up the database, then add the missing tables / columns with a migration '
                '(or restore the migration history) before starting the app.'
            )
        self.stdout.write(self.style.SUCCESS('Database schema matches the models.'))
