#!/bin/sh
set -e
python manage.py migrate --noinput
# Stop here if the database misses tables or columns of the models (see core/management/commands/verify_schema.py).
python manage.py verify_schema
python manage.py collectstatic --noinput
python manage.py super_admin

# If DEMO is set to true (or 1), run the demo population command
if [ "${DEMO}" = "true" ] || [ "${DEMO}" = "1" ]; then
	echo "DEMO mode enabled — running populate_demo"
	python manage.py populate_demo || echo "populate_demo failed"
fi

exec "$@"