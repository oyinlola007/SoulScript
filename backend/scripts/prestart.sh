#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations only if they exist
if [ -d "app/alembic/versions" ] && [ "$(ls -A app/alembic/versions/*.py 2>/dev/null)" ]; then
    echo "Running migrations..."
    
    # Check if alembic_version table exists and is empty (existing DB without version control)
    if python -c "
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

try:
    engine = create_engine(os.getenv('DATABASE_URL'))
    with engine.connect() as conn:
        result = conn.execute(text('SELECT COUNT(*) FROM alembic_version'))
        count = result.fetchone()[0]
        exit(0 if count == 0 else 1)
except ProgrammingError:
    # Table doesn't exist, exit with 0 to trigger baseline stamp
    exit(0)
except Exception:
    # Other error, exit with 1 to skip baseline stamp
    exit(1)
"; then
        echo "Existing database detected without alembic version control, stamping baseline..."
        alembic stamp baseline_initial_schema
    fi
    
    alembic upgrade head
else
    echo "No migrations found, skipping alembic upgrade"
fi

# Create initial data in DB
python app/initial_data.py
