#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations only if they exist
if [ -d "app/alembic/versions" ] && [ "$(ls -A app/alembic/versions/*.py 2>/dev/null)" ]; then
    echo "Running migrations..."
alembic upgrade head
else
    echo "No migrations found, skipping alembic upgrade"
fi

# Create initial data in DB
python app/initial_data.py
