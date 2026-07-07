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


def _alter(types: tuple[str, ...]) -> None:
    # SQLite stores SQLAlchemy Enums as plain VARCHAR (no CHECK constraint),
    # so only MySQL's native ENUM columns need altering.
    if op.get_bind().dialect.name != "mysql":
        return
    enum = sa.Enum(*types, name="part_type")
    op.alter_column("parts", "type", type_=enum, existing_nullable=False)
    op.alter_column(
        "planned_build_items", "external_type", type_=enum, existing_nullable=True
    )


def upgrade() -> None:
    _alter(NEW_TYPES)


def downgrade() -> None:
    # NOTE: fails on MySQL if rows already use the new types — remove them first
    _alter(OLD_TYPES)
