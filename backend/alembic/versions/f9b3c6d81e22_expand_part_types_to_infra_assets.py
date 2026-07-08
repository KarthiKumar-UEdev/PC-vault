"""expand part_type enum: laptops, monitors, VR, network gear & more

Revision ID: f9b3c6d81e22
Revises: d5e1a7b28c40
Create Date: 2026-07-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f9b3c6d81e22"
down_revision: Union[str, None] = "d5e1a7b28c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_TYPES = (
    "cpu", "gpu", "ram", "psu", "case", "cooler", "ssd", "hdd", "mobo", "fan",
    "other",
)
NEW_TYPES = (
    "cpu", "gpu", "ram", "psu", "case", "cooler", "ssd", "hdd", "mobo", "fan",
    "laptop", "tablet", "monitor", "vr", "peripheral", "audio", "printer",
    "camera", "ups", "router", "switch", "ap", "other",
)


def _alter_mysql(types: tuple[str, ...]) -> None:
    enum = sa.Enum(*types, name="part_type")
    op.alter_column("parts", "type", type_=enum, existing_nullable=False)
    op.alter_column(
        "planned_build_items", "external_type", type_=enum, existing_nullable=True
    )


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "mysql":
        _alter_mysql(NEW_TYPES)
    elif dialect == "postgresql":
        # native enum type — extend it in place. ADD VALUE can't run inside
        # the migration transaction, hence the autocommit block.
        added = [t for t in NEW_TYPES if t not in OLD_TYPES]
        with op.get_context().autocommit_block():
            for value in added:
                op.execute(f"ALTER TYPE part_type ADD VALUE IF NOT EXISTS '{value}'")
    # SQLite stores SQLAlchemy Enums as plain VARCHAR — nothing to alter


def downgrade() -> None:
    # MySQL only; fails if rows already use the new types — remove them first.
    # (Postgres can't drop enum values in place; restore from backup instead.)
    if op.get_bind().dialect.name == "mysql":
        _alter_mysql(OLD_TYPES)
