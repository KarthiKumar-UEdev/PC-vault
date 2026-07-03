from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import PartCondition, PartType, PCStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Parts ────────────────────────────────────────────────────────────────────
class PartBase(BaseModel):
    type: PartType
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=160)
    serial_number: str | None = Field(default=None, max_length=160)
    condition: PartCondition = PartCondition.good
    purchase_date: date | None = None
    purchase_price: Decimal | None = Field(default=None, ge=0)
    warranty_expiry: date | None = None
    specs: dict | None = None
    pc_id: str | None = None


class PartCreate(PartBase):
    pass


class PartUpdate(BaseModel):
    type: PartType | None = None
    brand: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=160)
    serial_number: str | None = Field(default=None, max_length=160)
    condition: PartCondition | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = Field(default=None, ge=0)
    warranty_expiry: date | None = None
    specs: dict | None = None


class PartOut(ORMModel):
    id: str
    pc_id: str | None
    type: PartType
    brand: str
    model: str
    serial_number: str | None
    condition: PartCondition
    purchase_date: date | None
    purchase_price: Decimal | None
    warranty_expiry: date | None
    specs: dict | None
    created_at: datetime
    pc_name: str | None = None


class PartAgingOut(PartOut):
    age_days: int | None = None


class TransferIn(BaseModel):
    to_pc_id: str | None = None


class TransferLogOut(ORMModel):
    id: str
    part_id: str
    from_pc_id: str | None
    to_pc_id: str | None
    moved_at: datetime
    from_pc_name: str | None = None
    to_pc_name: str | None = None
    part_label: str | None = None


# ── PCs ──────────────────────────────────────────────────────────────────────
class PCBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    status: PCStatus = PCStatus.active
    build_date: date | None = None


class PCCreate(PCBase):
    pass


class PCUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    status: PCStatus | None = None
    build_date: date | None = None


class PCOut(ORMModel):
    id: str
    name: str
    description: str | None
    status: PCStatus
    qr_code: str
    build_date: date | None
    created_at: datetime
    part_count: int = 0
    total_value: Decimal = Decimal("0")


class PCDetailOut(PCOut):
    parts: list[PartOut] = []
    has_network_info: bool = False


# ── Network ──────────────────────────────────────────────────────────────────
class NetworkIn(BaseModel):
    ip_address: str | None = Field(default=None, max_length=100)
    mac_address: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class NetworkOut(BaseModel):
    pc_id: str
    ip_address: str | None
    mac_address: str | None
    notes: str | None


# ── Planner ──────────────────────────────────────────────────────────────────
class BuildItemCreate(BaseModel):
    part_id: str | None = None
    external_type: PartType | None = None
    external_name: str | None = Field(default=None, max_length=160)
    external_price: Decimal | None = Field(default=None, ge=0)
    external_url: str | None = Field(default=None, max_length=500)


class BuildItemOut(ORMModel):
    id: str
    build_id: str
    part_id: str | None
    external_type: PartType | None
    external_name: str | None
    external_price: Decimal | None
    external_url: str | None
    part: PartOut | None = None


class BuildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    notes: str | None = None


class BuildUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = None


class BuildOut(ORMModel):
    id: str
    name: str
    notes: str | None
    created_at: datetime
    item_count: int = 0


class BuildDetailOut(BuildOut):
    items: list[BuildItemOut] = []
    total_cost: Decimal = Decimal("0")


class BuildConvertIn(BaseModel):
    name: str | None = None
    description: str | None = None


# ── Dashboard / misc ─────────────────────────────────────────────────────────
class StatsOut(BaseModel):
    total_pcs: int
    active_pcs: int
    total_parts: int
    inventory_count: int
    total_value: Decimal
    expiring_warranties: int
    faulty_parts: int


class OkOut(BaseModel):
    ok: bool = True
