"""employees table + employee assignment on pcs and parts

Revision ID: b8a4e2f95c17
Revises: f9b3c6d81e22
Create Date: 2026-07-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8a4e2f95c17"
down_revision: Union[str, None] = "f9b3c6d81e22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "employees",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("title", sa.String(120)),
        sa.Column("email", sa.String(160)),
        sa.Column("department", sa.String(120)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_employees_name", "employees", ["name"])
    # batch mode: SQLite can't ALTER in a foreign key — this rebuilds the
    # table there and is a plain ALTER on MySQL
    for table in ("pcs", "parts"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("employee_id", sa.String(36)))
            batch.create_foreign_key(
                f"fk_{table}_employee_id",
                "employees",
                ["employee_id"],
                ["id"],
                ondelete="SET NULL",
            )
        op.create_index(f"ix_{table}_employee_id", table, ["employee_id"])


def downgrade() -> None:
    for table in ("parts", "pcs"):
        op.drop_index(f"ix_{table}_employee_id", table_name=table)
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"fk_{table}_employee_id", type_="foreignkey")
            batch.drop_column("employee_id")
    op.drop_index("ix_employees_name", table_name="employees")
    op.drop_table("employees")
