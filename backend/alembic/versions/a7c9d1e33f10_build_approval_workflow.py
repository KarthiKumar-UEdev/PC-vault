"""build approval workflow: status column + build_comments table

Revision ID: a7c9d1e33f10
Revises: e204c45f42a1
Create Date: 2026-07-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c9d1e33f10"
down_revision: Union[str, None] = "e204c45f42a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

build_status = sa.Enum("draft", "pending", "approved", "rejected", name="build_status")


def upgrade() -> None:
    op.add_column(
        "planned_builds",
        sa.Column("status", build_status, nullable=False, server_default="draft"),
    )
    op.create_table(
        "build_comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "build_id",
            sa.String(36),
            sa.ForeignKey("planned_builds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("author_role", sa.String(20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_build_comments_build_id", "build_comments", ["build_id"])


def downgrade() -> None:
    op.drop_index("ix_build_comments_build_id", table_name="build_comments")
    op.drop_table("build_comments")
    op.drop_column("planned_builds", "status")
