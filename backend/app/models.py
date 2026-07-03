import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class PCStatus(str, enum.Enum):
    active = "active"
    retired = "retired"
    planned = "planned"


class PartType(str, enum.Enum):
    cpu = "cpu"
    gpu = "gpu"
    ram = "ram"
    psu = "psu"
    case = "case"
    cooler = "cooler"
    ssd = "ssd"
    hdd = "hdd"
    mobo = "mobo"
    fan = "fan"
    other = "other"


class PartCondition(str, enum.Enum):
    new = "new"
    good = "good"
    fair = "fair"
    faulty = "faulty"
    rma = "rma"
    retired = "retired"


class PC(Base):
    __tablename__ = "pcs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PCStatus] = mapped_column(
        Enum(PCStatus, name="pc_status"), default=PCStatus.active, nullable=False
    )
    qr_code: Mapped[str] = mapped_column(
        String(36), unique=True, default=gen_uuid, nullable=False
    )
    build_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    parts: Mapped[list["Part"]] = relationship(back_populates="pc")
    network_info: Mapped["NetworkInfo | None"] = relationship(
        back_populates="pc", cascade="all, delete-orphan", uselist=False
    )


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    pc_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("pcs.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[PartType] = mapped_column(
        Enum(PartType, name="part_type"), nullable=False, index=True
    )
    brand: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(160), nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(160))
    condition: Mapped[PartCondition] = mapped_column(
        Enum(PartCondition, name="part_condition"),
        default=PartCondition.good,
        nullable=False,
    )
    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    warranty_expiry: Mapped[date | None] = mapped_column(Date)
    specs: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    pc: Mapped["PC | None"] = relationship(back_populates="parts")
    transfer_logs: Mapped[list["TransferLog"]] = relationship(
        back_populates="part", cascade="all, delete-orphan"
    )


class NetworkInfo(Base):
    __tablename__ = "network_info"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    pc_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pcs.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    # Fernet ciphertext — plaintext never touches the database
    ip_address: Mapped[str | None] = mapped_column(Text)
    mac_address: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    pc: Mapped["PC"] = relationship(back_populates="network_info")


class TransferLog(Base):
    __tablename__ = "transfer_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    part_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_pc_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("pcs.id", ondelete="SET NULL")
    )
    to_pc_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("pcs.id", ondelete="SET NULL")
    )
    moved_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    part: Mapped["Part"] = relationship(back_populates="transfer_logs")


class PlannedBuild(Base):
    __tablename__ = "planned_builds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    items: Mapped[list["PlannedBuildItem"]] = relationship(
        back_populates="build", cascade="all, delete-orphan"
    )


class PlannedBuildItem(Base):
    __tablename__ = "planned_build_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    build_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("planned_builds.id", ondelete="CASCADE"), nullable=False
    )
    part_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("parts.id", ondelete="SET NULL")
    )
    # part type for external (wishlist) items so the checklist can match them
    external_type: Mapped[PartType | None] = mapped_column(
        Enum(PartType, name="part_type")
    )
    external_name: Mapped[str | None] = mapped_column(String(160))
    external_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    external_url: Mapped[str | None] = mapped_column(String(500))

    build: Mapped["PlannedBuild"] = relationship(back_populates="items")
    part: Mapped["Part | None"] = relationship()
