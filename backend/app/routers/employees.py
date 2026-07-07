from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_admin
from app.database import get_db
from app.models import Employee
from app.schemas import (
    EmployeeCreate,
    EmployeeDetailOut,
    EmployeeOut,
    EmployeeUpdate,
    OkOut,
)

router = APIRouter(prefix="/employees", tags=["employees"])

ADMIN = [Depends(require_admin)]


def _employee_out(emp: Employee) -> EmployeeOut:
    out = EmployeeOut.model_validate(emp)
    out.pc_count = len(emp.pcs)
    out.device_count = len(emp.parts)
    return out


def _employee_detail(emp: Employee) -> EmployeeDetailOut:
    out = EmployeeDetailOut.model_validate(emp)
    out.pc_count = len(emp.pcs)
    out.device_count = len(emp.parts)
    for pc_out, pc in zip(out.pcs, emp.pcs):
        pc_out.part_count = len(pc.parts)
        pc_out.employee_name = emp.name
    for part_out, part in zip(out.parts, emp.parts):
        part_out.employee_name = emp.name
    return out


def _get_employee_or_404(db: Session, employee_id: str) -> Employee:
    emp = db.execute(
        select(Employee)
        .options(
            selectinload(Employee.pcs),
            selectinload(Employee.parts),
        )
        .where(Employee.id == employee_id)
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.get("", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db), search: str | None = None):
    stmt = select(Employee).options(
        selectinload(Employee.pcs), selectinload(Employee.parts)
    )
    if search:
        stmt = stmt.where(Employee.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Employee.name.asc())
    employees = db.execute(stmt).scalars().all()
    return [_employee_out(e) for e in employees]


@router.post("", response_model=EmployeeDetailOut, status_code=201, dependencies=ADMIN)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    return _employee_detail(_get_employee_or_404(db, emp.id))


@router.get("/{employee_id}", response_model=EmployeeDetailOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    return _employee_detail(_get_employee_or_404(db, employee_id))


@router.patch("/{employee_id}", response_model=EmployeeDetailOut, dependencies=ADMIN)
def update_employee(employee_id: str, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = _get_employee_or_404(db, employee_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(emp, key, value)
    db.commit()
    return _employee_detail(_get_employee_or_404(db, employee_id))


@router.delete("/{employee_id}", response_model=OkOut, dependencies=ADMIN)
def delete_employee(employee_id: str, db: Session = Depends(get_db)):
    emp = _get_employee_or_404(db, employee_id)
    # gear goes back to the pool — SQLite doesn't enforce ON DELETE SET NULL
    for pc in emp.pcs:
        pc.employee_id = None
    for part in emp.parts:
        part.employee_id = None
    db.delete(emp)
    db.commit()
    return OkOut()
