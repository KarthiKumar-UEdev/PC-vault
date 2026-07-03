"""Seed the database with sample data: 3 PCs and ~15 parts.

Usage (from the backend/ directory, venv active):
    python scripts/seed.py           # refuses to run if PCs already exist
    python scripts/seed.py --force   # wipes and re-seeds all tables
"""
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select  # noqa: E402

from app.crypto import encrypt  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    PC,
    Base,
    NetworkInfo,
    Part,
    PartCondition,
    PartType,
    PCStatus,
    PlannedBuild,
    PlannedBuildItem,
    TransferLog,
)

TODAY = date.today()


def d(days_ago: int) -> date:
    return TODAY - timedelta(days=days_ago)


def main() -> None:
    force = "--force" in sys.argv
    # Convenience for SQLite dev; on MySQL run `alembic upgrade head` first
    # (create_all is a no-op for tables that already exist).
    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        if db.execute(select(PC).limit(1)).first() is not None:
            if not force:
                print("Database already contains PCs — pass --force to re-seed.")
                return
            for table in (
                PlannedBuildItem,
                PlannedBuild,
                TransferLog,
                NetworkInfo,
                Part,
                PC,
            ):
                db.execute(delete(table))
            db.commit()

        skyven = PC(
            name="Skyven",
            description="Primary gaming rig — RGB everything, lives in the office.",
            status=PCStatus.active,
            build_date=d(400),
        )
        elite18 = PC(
            name="Elite18",
            description="Living-room HTPC / light gaming, compact ITX build.",
            status=PCStatus.active,
            build_date=d(800),
        )
        workstation = PC(
            name="Workstation-173",
            description="Old render node, retired after PSU scare. Parts donor.",
            status=PCStatus.retired,
            build_date=d(1600),
        )
        db.add_all([skyven, elite18, workstation])
        db.flush()

        # Prices in Indian Rupees (INR)
        parts = [
            # ── Skyven ──────────────────────────────────────────────────
            Part(pc_id=skyven.id, type=PartType.cpu, brand="AMD",
                 model="Ryzen 7 7800X3D", serial_number="9HX3D-77421-AA",
                 condition=PartCondition.good, purchase_date=d(400),
                 purchase_price=Decimal("38999"), warranty_expiry=TODAY + timedelta(days=695),
                 specs={"cores": 8, "threads": 16, "boost_ghz": 5.0, "socket": "AM5"}),
            Part(pc_id=skyven.id, type=PartType.gpu, brand="NVIDIA",
                 model="RTX 4080 Super FE", serial_number="NV4080S-119203",
                 condition=PartCondition.good, purchase_date=d(380),
                 purchase_price=Decimal("94999"), warranty_expiry=TODAY + timedelta(days=25),
                 specs={"vram_gb": 16, "tdp_w": 320, "ports": "3x DP, 1x HDMI"}),
            Part(pc_id=skyven.id, type=PartType.mobo, brand="ASUS",
                 model="ROG Strix X670E-F", serial_number="ASX670E-55102",
                 condition=PartCondition.good, purchase_date=d(400),
                 purchase_price=Decimal("32499"), warranty_expiry=TODAY + timedelta(days=330),
                 specs={"socket": "AM5", "form_factor": "ATX", "wifi": "6E"}),
            Part(pc_id=skyven.id, type=PartType.ram, brand="G.Skill",
                 model="Trident Z5 Neo 32GB DDR5-6000", serial_number="GSK-Z5N-32-01",
                 condition=PartCondition.new, purchase_date=d(90),
                 purchase_price=Decimal("10499"), warranty_expiry=TODAY + timedelta(days=3560),
                 specs={"capacity_gb": 32, "speed": "DDR5-6000", "cl": 30}),
            Part(pc_id=skyven.id, type=PartType.psu, brand="Corsair",
                 model="RM850x Shift", serial_number="CRS-850X-99231",
                 condition=PartCondition.good, purchase_date=d(400),
                 purchase_price=Decimal("11799"), warranty_expiry=TODAY + timedelta(days=3250),
                 specs={"watts": 850, "rating": "80+ Gold", "modular": "full", "aka": "SMPS"}),
            Part(pc_id=skyven.id, type=PartType.ssd, brand="Samsung",
                 model="990 Pro 2TB", serial_number="S990P-2T-40182",
                 condition=PartCondition.good, purchase_date=d(400),
                 purchase_price=Decimal("14499"), warranty_expiry=TODAY + timedelta(days=1425),
                 specs={"capacity_tb": 2, "interface": "PCIe 4.0 NVMe", "read_mbps": 7450}),
            Part(pc_id=skyven.id, type=PartType.case, brand="NZXT",
                 model="H510 Flow", serial_number="NZXT-H510F-00812",
                 condition=PartCondition.good, purchase_date=d(400),
                 purchase_price=Decimal("6499"), warranty_expiry=TODAY + timedelta(days=330),
                 specs={"form_factor": "ATX mid-tower", "side_panel": "tempered glass"}),
            # ── Elite18 ─────────────────────────────────────────────────
            Part(pc_id=elite18.id, type=PartType.cpu, brand="Intel",
                 model="Core i5-12400", serial_number="INT12400-33871",
                 condition=PartCondition.good, purchase_date=d(800),
                 purchase_price=Decimal("15299"), warranty_expiry=TODAY + timedelta(days=295),
                 specs={"cores": 6, "threads": 12, "boost_ghz": 4.4, "socket": "LGA1700"}),
            Part(pc_id=elite18.id, type=PartType.mobo, brand="ASRock",
                 model="B660M-ITX/ac", serial_number="ASR-B660M-71C",
                 condition=PartCondition.good, purchase_date=d(800),
                 purchase_price=Decimal("9799"), warranty_expiry=d(70),
                 specs={"socket": "LGA1700", "form_factor": "mITX"}),
            Part(pc_id=elite18.id, type=PartType.ram, brand="Crucial",
                 model="16GB DDR4-3200", serial_number="CRU-16-3200-B2",
                 condition=PartCondition.good, purchase_date=d(800),
                 purchase_price=Decimal("3199"), warranty_expiry=TODAY + timedelta(days=12),
                 specs={"capacity_gb": 16, "speed": "DDR4-3200"}),
            Part(pc_id=elite18.id, type=PartType.ssd, brand="WD",
                 model="SN770 1TB", serial_number="WD-SN770-88410",
                 condition=PartCondition.good, purchase_date=d(600),
                 purchase_price=Decimal("6299"), warranty_expiry=TODAY + timedelta(days=1220),
                 specs={"capacity_tb": 1, "interface": "PCIe 4.0 NVMe"}),
            Part(pc_id=elite18.id, type=PartType.case, brand="Cooler Master",
                 model="NR200", serial_number="CM-NR200-44107",
                 condition=PartCondition.good, purchase_date=d(800),
                 purchase_price=Decimal("7499"), warranty_expiry=d(70),
                 specs={"form_factor": "mITX", "volume_l": 18.25}),
            # ── Workstation-173 ─────────────────────────────────────────
            Part(pc_id=workstation.id, type=PartType.cpu, brand="Intel",
                 model="Xeon E5-2690 v4", serial_number="XE2690V4-00113",
                 condition=PartCondition.fair, purchase_date=d(1600),
                 purchase_price=Decimal("16999"), warranty_expiry=d(500),
                 specs={"cores": 14, "threads": 28, "socket": "LGA2011-3"}),
            Part(pc_id=workstation.id, type=PartType.psu, brand="EVGA",
                 model="SuperNOVA 750 G2", serial_number="EVGA-750G2-5521",
                 condition=PartCondition.faulty, purchase_date=d(1600),
                 purchase_price=Decimal("8999"), warranty_expiry=d(140),
                 specs={"watts": 750, "rating": "80+ Gold", "note": "clicks under load", "aka": "SMPS"}),
            Part(pc_id=workstation.id, type=PartType.hdd, brand="Seagate",
                 model="IronWolf 8TB", serial_number="SGIW8T-30012",
                 condition=PartCondition.good, purchase_date=d(1100),
                 purchase_price=Decimal("16499"), warranty_expiry=TODAY + timedelta(days=8),
                 specs={"capacity_tb": 8, "rpm": 7200, "use": "archive"}),
            # ── Inventory (unassigned) ──────────────────────────────────
            Part(pc_id=None, type=PartType.gpu, brand="AMD",
                 model="RX 6700 XT", serial_number="AMD6700XT-2281",
                 condition=PartCondition.good, purchase_date=d(900),
                 purchase_price=Decimal("26999"), warranty_expiry=d(170),
                 specs={"vram_gb": 12, "tdp_w": 230}),
            Part(pc_id=None, type=PartType.ram, brand="Kingston",
                 model="Fury Beast 16GB DDR5-5200", serial_number="KFB-16-52-X1",
                 condition=PartCondition.new, purchase_date=d(30),
                 purchase_price=Decimal("4499"), warranty_expiry=TODAY + timedelta(days=3620),
                 specs={"capacity_gb": 16, "speed": "DDR5-5200"}),
            Part(pc_id=None, type=PartType.cooler, brand="Noctua",
                 model="NH-D15", serial_number="NOC-D15-77543",
                 condition=PartCondition.good, purchase_date=d(700),
                 purchase_price=Decimal("8499"), warranty_expiry=TODAY + timedelta(days=1490),
                 specs={"type": "air", "fans": 2, "height_mm": 165}),
            Part(pc_id=None, type=PartType.ssd, brand="Crucial",
                 model="MX500 500GB", serial_number="CRU-MX500-1174",
                 condition=PartCondition.rma, purchase_date=d(1300),
                 purchase_price=Decimal("3799"), warranty_expiry=TODAY + timedelta(days=520),
                 specs={"capacity_gb": 500, "interface": "SATA", "note": "RMA in progress — bad sectors"}),
        ]
        db.add_all(parts)
        db.flush()

        # Initial assignment logs + a realistic move (GPU pulled from
        # Workstation-173 into inventory when it was retired)
        for part in parts:
            if part.pc_id is not None:
                db.add(TransferLog(part_id=part.id, from_pc_id=None,
                                   to_pc_id=part.pc_id,
                                   moved_at=part.purchase_date))
        rx6700 = next(p for p in parts if p.model == "RX 6700 XT")
        fury_beast = next(p for p in parts if "Fury Beast" in p.model)
        db.add(TransferLog(part_id=rx6700.id, from_pc_id=None,
                           to_pc_id=workstation.id, moved_at=d(900)))
        db.add(TransferLog(part_id=rx6700.id, from_pc_id=workstation.id,
                           to_pc_id=None, moved_at=d(120)))

        db.add(NetworkInfo(pc_id=skyven.id,
                           ip_address=encrypt("192.168.1.42"),
                           mac_address=encrypt("A4:B1:C2:D3:E4:F5"),
                           notes="Static lease on the office switch, port 3."))
        db.add(NetworkInfo(pc_id=elite18.id,
                           ip_address=encrypt("192.168.1.87"),
                           mac_address=encrypt("0C:9D:92:11:22:33"),
                           notes="Wi-Fi 6E, 5GHz band only."))

        nebula = PlannedBuild(
            name="Project Nebula",
            notes="Budget 1440p build for the guest room, reuse inventory where possible.",
        )
        db.add(nebula)
        db.flush()
        db.add_all([
            PlannedBuildItem(build_id=nebula.id, part_id=rx6700.id),
            PlannedBuildItem(build_id=nebula.id, part_id=fury_beast.id),
            PlannedBuildItem(build_id=nebula.id, part_id=None,
                             external_type=PartType.cpu,
                             external_name="AMD Ryzen 5 7600",
                             external_price=Decimal("18499"),
                             external_url="https://www.amazon.in/dp/B0BMQHsample"),
            PlannedBuildItem(build_id=nebula.id, part_id=None,
                             external_type=PartType.case,
                             external_name="Fractal Pop Mini Air",
                             external_price=Decimal("6599"),
                             external_url="https://mdcomputers.in/p/sample"),
        ])

        db.commit()
        print(f"Seeded: 3 PCs, {len(parts)} parts, 2 network records, "
              f"1 planned build.")
        print(f"  Skyven         qr={skyven.qr_code}")
        print(f"  Elite18        qr={elite18.qr_code}")
        print(f"  Workstation-173 qr={workstation.qr_code}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
