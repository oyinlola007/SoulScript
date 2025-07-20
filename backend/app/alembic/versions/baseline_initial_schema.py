"""baseline initial schema

Revision ID: baseline_initial_schema
Revises:
Create Date: 2025-07-20 08:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "baseline_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Check if tables already exist (for existing databases)
    inspector = inspect(op.get_bind())
    existing_tables = inspector.get_table_names()

    # Only create tables if they don't already exist
    if "user" not in existing_tables:
        # Create user table
        op.create_table(
            "user",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("is_superuser", sa.Boolean(), nullable=False),
            sa.Column("full_name", sa.String(length=255), nullable=True),
            sa.Column("hashed_password", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)

    if "item" not in existing_tables:
        # Create item table
        op.create_table(
            "item",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("owner_id", sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "pdfdocument" not in existing_tables:
        # Create pdfdocument table
        op.create_table(
            "pdfdocument",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("filename", sa.String(length=255), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=False),
            sa.Column("page_count", sa.Integer(), nullable=False),
            sa.Column("is_processed", sa.Boolean(), nullable=False),
            sa.Column("processing_status", sa.String(length=50), nullable=False),
            sa.Column("error_message", sa.String(length=1000), nullable=True),
            sa.Column("owner_id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "chatsession" not in existing_tables:
        # Create chatsession table (old schema - owner_id NOT NULL, no anon_session_id)
        op.create_table(
            "chatsession",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("owner_id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("conversation_summary", sa.String(length=5000), nullable=False),
            sa.Column("summary_updated_at", sa.DateTime(), nullable=False),
            sa.Column("last_summary_message_id", sa.String(), nullable=False),
            sa.Column("is_blocked", sa.Boolean(), nullable=False),
            sa.Column("blocked_reason", sa.String(length=500), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "chatmessage" not in existing_tables:
        # Create chatmessage table
        op.create_table(
            "chatmessage",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("content", sa.String(), nullable=False),
            sa.Column("role", sa.String(length=20), nullable=False),
            sa.Column("session_id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["session_id"], ["chatsession.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    if "contentfilterlog" not in existing_tables:
        # Create contentfilterlog table
        op.create_table(
            "contentfilterlog",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("content_type", sa.String(length=20), nullable=False),
            sa.Column("original_content", sa.String(length=10000), nullable=False),
            sa.Column("blocked_reason", sa.String(length=500), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("session_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["session_id"], ["chatsession.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "featureflag" not in existing_tables:
        # Create featureflag table
        op.create_table(
            "featureflag",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("description", sa.String(length=1000), nullable=False),
            sa.Column("is_enabled", sa.Boolean(), nullable=False),
            sa.Column("is_predefined", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_featureflag_name"), "featureflag", ["name"], unique=True
        )


def downgrade():
    # Drop all tables in reverse order
    inspector = inspect(op.get_bind())
    existing_tables = inspector.get_table_names()

    if "featureflag" in existing_tables:
        op.drop_index(op.f("ix_featureflag_name"), table_name="featureflag")
        op.drop_table("featureflag")
    if "contentfilterlog" in existing_tables:
        op.drop_table("contentfilterlog")
    if "chatmessage" in existing_tables:
        op.drop_table("chatmessage")
    if "chatsession" in existing_tables:
        op.drop_table("chatsession")
    if "pdfdocument" in existing_tables:
        op.drop_table("pdfdocument")
    if "item" in existing_tables:
        op.drop_table("item")
    if "user" in existing_tables:
        op.drop_index(op.f("ix_user_email"), table_name="user")
        op.drop_table("user")
