"""Warranty expiry email alert — designed for cPanel Cron Jobs.

Standalone by design: opens its own DB connection, reads config from
backend/.env, and exits when done. It is NOT part of the web app process
(Passenger kills idle workers, so in-process schedulers like APScheduler
never fire reliably on shared hosting).

cPanel cron example (daily 08:00):
    0 8 * * * /home/USER/virtualenv/pc-vault-api/3.10/bin/python /home/USER/pc-vault-api/scripts/send_warranty_alerts.py >> /home/USER/warranty_cron.log 2>&1
"""
import smtplib
import sys
from datetime import date, timedelta
from email.message import EmailMessage
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session, selectinload  # noqa: E402

from app.config import settings  # noqa: E402
from app.models import Part  # noqa: E402


def collect_expiring(session: Session, days: int) -> list[Part]:
    today = date.today()
    cutoff = today + timedelta(days=days)
    return list(
        session.execute(
            select(Part)
            .options(selectinload(Part.pc))
            .where(Part.warranty_expiry.is_not(None))
            .where(Part.warranty_expiry >= today)
            .where(Part.warranty_expiry <= cutoff)
            .order_by(Part.warranty_expiry.asc())
        ).scalars()
    )


def build_email(parts: list[Part], days: int) -> EmailMessage:
    today = date.today()
    lines = [
        f"PC Vault — {len(parts)} part(s) with warranty expiring within {days} days:",
        "",
    ]
    for p in parts:
        left = (p.warranty_expiry - today).days
        location = p.pc.name if p.pc else "inventory"
        lines.append(
            f"  • {p.brand} {p.model} ({p.type.value.upper()}) — "
            f"expires {p.warranty_expiry.isoformat()} ({left}d left) — in {location}"
        )
    lines += ["", f"Review: {settings.frontend_url.rstrip('/')}/alerts"]

    msg = EmailMessage()
    msg["Subject"] = f"[PC Vault] {len(parts)} warranty alert(s)"
    msg["From"] = settings.smtp_from
    msg["To"] = settings.alert_email_to
    msg.set_content("\n".join(lines))
    return msg


def send(msg: EmailMessage) -> None:
    if settings.smtp_port == 465:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
        server.starttls()
    try:
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    finally:
        server.quit()


def main() -> None:
    if not settings.alert_email_to:
        print("ALERT_EMAIL_TO is not set — nothing to do.")
        return
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    with Session(engine) as session:
        parts = collect_expiring(session, settings.warranty_alert_days)
    if not parts:
        print(f"{date.today().isoformat()}: no warranties expiring within "
              f"{settings.warranty_alert_days} days.")
        return
    msg = build_email(parts, settings.warranty_alert_days)
    if "--dry-run" in sys.argv:
        print(msg)
        return
    send(msg)
    print(f"{date.today().isoformat()}: sent alert for {len(parts)} part(s) "
          f"to {settings.alert_email_to}.")


if __name__ == "__main__":
    main()
