from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Part
from app.schemas import PartOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/warranty", response_model=list[PartOut])
def warranty_alerts(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    today = date.today()
    cutoff = today + timedelta(days=days)
    parts = (
        db.execute(
            select(Part)
            .options(selectinload(Part.pc))
            .where(Part.warranty_expiry.is_not(None))
            .where(Part.warranty_expiry >= today)
            .where(Part.warranty_expiry <= cutoff)
            .order_by(Part.warranty_expiry.asc())
        )
        .scalars()
        .all()
    )
    out = []
    for part in parts:
        item = PartOut.model_validate(part)
        item.pc_name = part.pc.name if part.pc else None
        out.append(item)
    return out
