from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import PC, Part, PartCondition, PartType, TransferLog
from app.schemas import (
    OkOut,
    PartAgingOut,
    PartCreate,
    PartOut,
    PartUpdate,
    TransferIn,
    TransferLogOut,
)

router = APIRouter(prefix="/parts", tags=["parts"])


def _part_out(part: Part) -> PartOut:
    out = PartOut.model_validate(part)
    out.pc_name = part.pc.name if part.pc else None
    return out


def _get_part_or_404(db: Session, part_id: str) -> Part:
    part = db.execute(
        select(Part)
        .options(selectinload(Part.pc))
        .where(Part.id == part_id)
        # bypass the session identity map so post-commit re-reads are current
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if part is None:
        raise HTTPException(status_code=404, detail="Part not found")
    return part


@router.get("", response_model=list[PartOut])
def list_parts(
    db: Session = Depends(get_db),
    type: PartType | None = None,
    condition: PartCondition | None = None,
    pc_id: str | None = None,
    in_inventory: bool | None = None,
    search: str | None = None,
    sort: str = Query("age", pattern="^(age|price|warranty_expiry)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
):
    stmt = select(Part).options(selectinload(Part.pc))
    if type is not None:
        stmt = stmt.where(Part.type == type)
    if condition is not None:
        stmt = stmt.where(Part.condition == condition)
    if pc_id is not None:
        stmt = stmt.where(Part.pc_id == pc_id)
    if in_inventory:
        stmt = stmt.where(Part.pc_id.is_(None))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                Part.brand.ilike(like),
                Part.model.ilike(like),
                Part.serial_number.ilike(like),
            )
        )
    col = {
        "age": Part.purchase_date,
        "price": Part.purchase_price,
        "warranty_expiry": Part.warranty_expiry,
    }[sort]
    stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())
    parts = db.execute(stmt).scalars().all()
    return [_part_out(p) for p in parts]


# NOTE: declared before /parts/{part_id} so "aging" isn't matched as an id
@router.get("/aging", response_model=list[PartAgingOut])
def parts_aging(db: Session = Depends(get_db)):
    parts = (
        db.execute(
            select(Part)
            .options(selectinload(Part.pc))
            .order_by(Part.purchase_date.asc())
        )
        .scalars()
        .all()
    )
    today = date.today()
    result: list[PartAgingOut] = []
    for part in parts:
        out = PartAgingOut.model_validate(part)
        out.pc_name = part.pc.name if part.pc else None
        out.age_days = (
            (today - part.purchase_date).days if part.purchase_date else None
        )
        result.append(out)
    return result


@router.post("", response_model=PartOut, status_code=201)
def create_part(payload: PartCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("pc_id"):
        pc = db.get(PC, data["pc_id"])
        if pc is None:
            raise HTTPException(status_code=404, detail="Target PC not found")
    part = Part(**data)
    db.add(part)
    db.flush()
    if part.pc_id:
        # Direct assignment on creation still leaves an audit trail
        db.add(TransferLog(part_id=part.id, from_pc_id=None, to_pc_id=part.pc_id))
    db.commit()
    return _part_out(_get_part_or_404(db, part.id))


@router.get("/{part_id}", response_model=PartOut)
def get_part(part_id: str, db: Session = Depends(get_db)):
    return _part_out(_get_part_or_404(db, part_id))


@router.patch("/{part_id}", response_model=PartOut)
def update_part(part_id: str, payload: PartUpdate, db: Session = Depends(get_db)):
    part = _get_part_or_404(db, part_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(part, key, value)
    db.commit()
    return _part_out(_get_part_or_404(db, part_id))


@router.delete("/{part_id}", response_model=OkOut)
def delete_part(part_id: str, db: Session = Depends(get_db)):
    part = _get_part_or_404(db, part_id)
    db.delete(part)
    db.commit()
    return OkOut()


@router.post("/{part_id}/transfer", response_model=PartOut)
def transfer_part(part_id: str, payload: TransferIn, db: Session = Depends(get_db)):
    part = _get_part_or_404(db, part_id)
    to_pc_id = payload.to_pc_id
    if to_pc_id is not None:
        target = db.get(PC, to_pc_id)
        if target is None:
            raise HTTPException(status_code=404, detail="Target PC not found")
    if to_pc_id == part.pc_id:
        return _part_out(part)  # no-op, don't pollute the log
    db.add(
        TransferLog(part_id=part.id, from_pc_id=part.pc_id, to_pc_id=to_pc_id)
    )
    part.pc_id = to_pc_id
    db.commit()
    return _part_out(_get_part_or_404(db, part_id))


@router.get("/{part_id}/history", response_model=list[TransferLogOut])
def part_history(part_id: str, db: Session = Depends(get_db)):
    part = _get_part_or_404(db, part_id)
    logs = (
        db.execute(
            select(TransferLog)
            .where(TransferLog.part_id == part.id)
            .order_by(TransferLog.moved_at.desc(), TransferLog.id)
        )
        .scalars()
        .all()
    )
    pc_ids = {pid for log in logs for pid in (log.from_pc_id, log.to_pc_id) if pid}
    names: dict[str, str] = {}
    if pc_ids:
        rows = db.execute(select(PC.id, PC.name).where(PC.id.in_(pc_ids))).all()
        names = {row.id: row.name for row in rows}
    out: list[TransferLogOut] = []
    for log in logs:
        item = TransferLogOut.model_validate(log)
        item.from_pc_name = names.get(log.from_pc_id) if log.from_pc_id else None
        item.to_pc_name = names.get(log.to_pc_id) if log.to_pc_id else None
        item.part_label = f"{part.brand} {part.model}"
        out.append(item)
    return out
