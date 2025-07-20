"""baseline initial schema

Revision ID: baseline_initial_schema
Revises:
Create Date: 2025-07-20 08:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "baseline_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # This is a baseline migration for the existing production schema
    # All tables already exist in production, so this migration is a no-op
    # It serves to mark the current state as the baseline for future migrations
    pass


def downgrade():
    # This is a baseline migration, so downgrade is also a no-op
    pass
