from decimal import Decimal
from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.models import PC, PCStatus
from app.schemas import OkOut, PCCreate, PCDetailOut, PCOut, PCUpdate

router = APIRouter(prefix="/pcs", tags=["pcs"])
# QR landing lookup stays reachable without a login token (scanned tags
# must open on any phone) — mounted separately in main.py, before `router`
# so /pcs/qr/... never falls through to /pcs/{pc_id}.
public_router = APIRouter(prefix="/pcs", tags=["pcs"])


def _pc_out(pc: PC) -> PCOut:
    out = PCOut.model_validate(pc)
    out.part_count = len(pc.parts)
    out.total_value = sum(
        (p.purchase_price or Decimal("0") for p in pc.parts), Decimal("0")
    )
    return out


def _pc_detail(pc: PC) -> PCDetailOut:
    out = PCDetailOut.model_validate(pc)
    out.part_count = len(pc.parts)
    out.total_value = sum(
        (p.purchase_price or Decimal("0") for p in pc.parts), Decimal("0")
    )
    for part_out, part in zip(out.parts, pc.parts):
        part_out.pc_name = pc.name
    out.has_network_info = pc.network_info is not None
    return out


def _get_pc_or_404(db: Session, pc_id: str) -> PC:
    pc = db.execute(
        select(PC)
        .options(selectinload(PC.parts), selectinload(PC.network_info))
        .where(PC.id == pc_id)
        # bypass the session identity map so post-commit re-reads are current
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=404, detail="PC not found")
    return pc


@router.get("", response_model=list[PCOut])
def list_pcs(
    db: Session = Depends(get_db),
    status: PCStatus | None = None,
    search: str | None = None,
    sort: str = Query("name", pattern="^(name|build_date)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
):
    stmt = select(PC).options(selectinload(PC.parts))
    if status is not None:
        stmt = stmt.where(PC.status == status)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(PC.name.ilike(like), PC.description.ilike(like)))
    col = PC.name if sort == "name" else PC.build_date
    stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())
    pcs = db.execute(stmt).scalars().all()
    return [_pc_out(pc) for pc in pcs]


@router.post("", response_model=PCDetailOut, status_code=201, dependencies=[Depends(require_admin)])
def create_pc(payload: PCCreate, db: Session = Depends(get_db)):
    pc = PC(**payload.model_dump())
    db.add(pc)
    db.commit()
    return _get_pc_or_404(db, pc.id)


@public_router.get("/qr/{qr_code}", response_model=PCDetailOut)
def get_pc_by_qr(qr_code: str, db: Session = Depends(get_db)):
    pc = db.execute(
        select(PC)
        .options(selectinload(PC.parts), selectinload(PC.network_info))
        .where(PC.qr_code == qr_code)
    ).scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=404, detail="Unknown QR code")
    return _pc_detail(pc)


@router.get("/{pc_id}", response_model=PCDetailOut)
def get_pc(pc_id: str, db: Session = Depends(get_db)):
    return _pc_detail(_get_pc_or_404(db, pc_id))


@router.patch("/{pc_id}", response_model=PCDetailOut, dependencies=[Depends(require_admin)])
def update_pc(pc_id: str, payload: PCUpdate, db: Session = Depends(get_db)):
    pc = _get_pc_or_404(db, pc_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pc, key, value)
    db.commit()
    return _pc_detail(_get_pc_or_404(db, pc_id))


@router.delete("/{pc_id}", response_model=OkOut, dependencies=[Depends(require_admin)])
def delete_pc(pc_id: str, db: Session = Depends(get_db)):
    pc = _get_pc_or_404(db, pc_id)
    # Parts return to inventory rather than being deleted
    for part in pc.parts:
        part.pc_id = None
    db.delete(pc)
    db.commit()
    return OkOut()


@router.get("/{pc_id}/qr-image")
def get_pc_qr_image(pc_id: str, db: Session = Depends(get_db)):
    pc = _get_pc_or_404(db, pc_id)
    url = f"{settings.frontend_url.rstrip('/')}/pc/qr?t={pc.qr_code}"
    img = qrcode.make(url, box_size=10, border=2)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="pc-vault-{pc.name}.png"'
        },
    )
