from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.crypto import decrypt, encrypt
from app.database import get_db
from app.models import PC, NetworkInfo
from app.schemas import NetworkIn, NetworkOut

router = APIRouter(prefix="/pcs", tags=["network"])


def _get_pc(db: Session, pc_id: str) -> PC:
    pc = db.get(PC, pc_id)
    if pc is None:
        raise HTTPException(status_code=404, detail="PC not found")
    return pc


@router.get("/{pc_id}/network", response_model=NetworkOut)
def get_network(pc_id: str, db: Session = Depends(get_db)):
    _get_pc(db, pc_id)
    info = db.execute(
        select(NetworkInfo).where(NetworkInfo.pc_id == pc_id)
    ).scalar_one_or_none()
    if info is None:
        return NetworkOut(pc_id=pc_id, ip_address=None, mac_address=None, notes=None)
    return NetworkOut(
        pc_id=pc_id,
        ip_address=decrypt(info.ip_address),
        mac_address=decrypt(info.mac_address),
        notes=info.notes,
    )


@router.put("/{pc_id}/network", response_model=NetworkOut, dependencies=[Depends(require_admin)])
def put_network(pc_id: str, payload: NetworkIn, db: Session = Depends(get_db)):
    _get_pc(db, pc_id)
    info = db.execute(
        select(NetworkInfo).where(NetworkInfo.pc_id == pc_id)
    ).scalar_one_or_none()
    if info is None:
        info = NetworkInfo(pc_id=pc_id)
        db.add(info)
    info.ip_address = encrypt(payload.ip_address)
    info.mac_address = encrypt(payload.mac_address)
    info.notes = payload.notes
    db.commit()
    return NetworkOut(
        pc_id=pc_id,
        ip_address=payload.ip_address,
        mac_address=payload.mac_address,
        notes=payload.notes,
    )
