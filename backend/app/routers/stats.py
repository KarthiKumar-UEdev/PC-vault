from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PC, Part, PartCondition, PCStatus, TransferLog
from app.schemas import StatsOut, TransferLogOut

router = APIRouter(tags=["dashboard"])


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    cutoff = today + timedelta(days=30)
    total_pcs = db.scalar(select(func.count(PC.id))) or 0
    active_pcs = (
        db.scalar(select(func.count(PC.id)).where(PC.status == PCStatus.active)) or 0
    )
    total_parts = db.scalar(select(func.count(Part.id))) or 0
    inventory_count = (
        db.scalar(
            select(func.count(Part.id))
            .where(Part.pc_id.is_(None))
            .where(Part.employee_id.is_(None))
        )
        or 0
    )
    total_value = db.scalar(select(func.sum(Part.purchase_price))) or Decimal("0")
    expiring = (
        db.scalar(
            select(func.count(Part.id))
            .where(Part.warranty_expiry.is_not(None))
            .where(Part.warranty_expiry >= today)
            .where(Part.warranty_expiry <= cutoff)
        )
        or 0
    )
    faulty = (
        db.scalar(
            select(func.count(Part.id)).where(
                Part.condition.in_([PartCondition.faulty, PartCondition.rma])
            )
        )
        or 0
    )
    return StatsOut(
        total_pcs=total_pcs,
        active_pcs=active_pcs,
        total_parts=total_parts,
        inventory_count=inventory_count,
        total_value=total_value,
        expiring_warranties=expiring,
        faulty_parts=faulty,
    )


@router.get("/transfers/recent", response_model=list[TransferLogOut])
def recent_transfers(db: Session = Depends(get_db), limit: int = 10):
    logs = (
        db.execute(
            select(TransferLog)
            .order_by(TransferLog.moved_at.desc())
            .limit(min(limit, 50))
        )
        .scalars()
        .all()
    )
    pc_ids = {pid for log in logs for pid in (log.from_pc_id, log.to_pc_id) if pid}
    names: dict[str, str] = {}
    if pc_ids:
        rows = db.execute(select(PC.id, PC.name).where(PC.id.in_(pc_ids))).all()
        names = {row.id: row.name for row in rows}
    out = []
    for log in logs:
        item = TransferLogOut.model_validate(log)
        item.from_pc_name = names.get(log.from_pc_id) if log.from_pc_id else None
        item.to_pc_name = names.get(log.to_pc_id) if log.to_pc_id else None
        if log.part:
            item.part_label = f"{log.part.brand} {log.part.model}"
        out.append(item)
    return out
