from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import PC, Part, PlannedBuild, PlannedBuildItem, TransferLog
from app.schemas import (
    BuildConvertIn,
    BuildCreate,
    BuildDetailOut,
    BuildItemCreate,
    BuildItemOut,
    BuildOut,
    BuildUpdate,
    OkOut,
    PCDetailOut,
)
from app.routers.pcs import _get_pc_or_404, _pc_detail

router = APIRouter(prefix="/builds", tags=["planner"])


def _get_build_or_404(db: Session, build_id: str) -> PlannedBuild:
    build = db.execute(
        select(PlannedBuild)
        .options(
            selectinload(PlannedBuild.items)
            .selectinload(PlannedBuildItem.part)
            .selectinload(Part.pc)
        )
        .where(PlannedBuild.id == build_id)
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if build is None:
        raise HTTPException(status_code=404, detail="Build not found")
    return build


def _build_detail(build: PlannedBuild) -> BuildDetailOut:
    out = BuildDetailOut.model_validate(build)
    out.item_count = len(build.items)
    total = Decimal("0")
    for item_out, item in zip(out.items, build.items):
        if item.part is not None:
            if item.part.purchase_price is not None:
                total += item.part.purchase_price
            item_out.part.pc_name = item.part.pc.name if item.part.pc else None
        elif item.external_price is not None:
            total += item.external_price
    out.total_cost = total
    return out


@router.get("", response_model=list[BuildOut])
def list_builds(db: Session = Depends(get_db)):
    builds = (
        db.execute(
            select(PlannedBuild)
            .options(selectinload(PlannedBuild.items))
            .order_by(PlannedBuild.created_at.desc())
        )
        .scalars()
        .all()
    )
    result = []
    for build in builds:
        out = BuildOut.model_validate(build)
        out.item_count = len(build.items)
        result.append(out)
    return result


@router.post("", response_model=BuildDetailOut, status_code=201)
def create_build(payload: BuildCreate, db: Session = Depends(get_db)):
    build = PlannedBuild(**payload.model_dump())
    db.add(build)
    db.commit()
    return _build_detail(_get_build_or_404(db, build.id))


@router.get("/{build_id}", response_model=BuildDetailOut)
def get_build(build_id: str, db: Session = Depends(get_db)):
    return _build_detail(_get_build_or_404(db, build_id))


@router.patch("/{build_id}", response_model=BuildDetailOut)
def update_build(build_id: str, payload: BuildUpdate, db: Session = Depends(get_db)):
    build = _get_build_or_404(db, build_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(build, key, value)
    db.commit()
    return _build_detail(_get_build_or_404(db, build_id))


@router.delete("/{build_id}", response_model=OkOut)
def delete_build(build_id: str, db: Session = Depends(get_db)):
    build = _get_build_or_404(db, build_id)
    db.delete(build)
    db.commit()
    return OkOut()


@router.post("/{build_id}/items", response_model=BuildItemOut, status_code=201)
def add_build_item(
    build_id: str, payload: BuildItemCreate, db: Session = Depends(get_db)
):
    build = _get_build_or_404(db, build_id)
    if payload.part_id is None and not payload.external_name:
        raise HTTPException(
            status_code=422,
            detail="Provide either part_id (inventory part) or external_name",
        )
    if payload.part_id is not None:
        part = db.get(Part, payload.part_id)
        if part is None:
            raise HTTPException(status_code=404, detail="Part not found")
        already = {i.part_id for i in build.items if i.part_id}
        if payload.part_id in already:
            raise HTTPException(status_code=409, detail="Part already in this build")
    item = PlannedBuildItem(build_id=build.id, **payload.model_dump())
    db.add(item)
    db.commit()
    fresh = db.execute(
        select(PlannedBuildItem)
        .options(selectinload(PlannedBuildItem.part).selectinload(Part.pc))
        .where(PlannedBuildItem.id == item.id)
    ).scalar_one()
    out = BuildItemOut.model_validate(fresh)
    if fresh.part is not None:
        out.part.pc_name = fresh.part.pc.name if fresh.part.pc else None
    return out


@router.delete("/{build_id}/items/{item_id}", response_model=OkOut)
def remove_build_item(build_id: str, item_id: str, db: Session = Depends(get_db)):
    item = db.execute(
        select(PlannedBuildItem).where(
            PlannedBuildItem.id == item_id, PlannedBuildItem.build_id == build_id
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Build item not found")
    db.delete(item)
    db.commit()
    return OkOut()


@router.post("/{build_id}/convert", response_model=PCDetailOut, status_code=201)
def convert_build(
    build_id: str, payload: BuildConvertIn, db: Session = Depends(get_db)
):
    """Turn a planned build into a real PC: creates the PC, moves every
    attached inventory part onto it (with transfer logs), then deletes the
    plan. External (not-yet-owned) items are dropped — buy them first."""
    build = _get_build_or_404(db, build_id)
    pc = PC(
        name=payload.name or build.name,
        description=payload.description or build.notes,
        build_date=date.today(),
    )
    db.add(pc)
    db.flush()
    for item in build.items:
        if item.part is not None:
            db.add(
                TransferLog(
                    part_id=item.part.id,
                    from_pc_id=item.part.pc_id,
                    to_pc_id=pc.id,
                )
            )
            item.part.pc_id = pc.id
    db.delete(build)
    db.commit()
    return _pc_detail(_get_pc_or_404(db, pc.id))
