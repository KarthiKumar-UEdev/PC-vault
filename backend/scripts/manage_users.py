"""Manage login accounts from the server shell.

Works anywhere the backend runs (local dev, cPanel SSH) — no API call needed,
so you can always recover a forgotten password.

Usage (from the backend/ directory, venv active):
    python scripts/manage_users.py list
    python scripts/manage_users.py add "Karthi Kumar" --role admin --password ctpl
    python scripts/manage_users.py add manager2 --role manager   # prompts for password
    python scripts/manage_users.py set-password "Karthi Kumar"   # prompts, hidden input
    python scripts/manage_users.py set-role rohit admin
    python scripts/manage_users.py rename "Old Name" "New Name"
    python scripts/manage_users.py delete rohit

Notes:
- Roles: admin (full control) | manager (view + approve builds).
- Changing a password instantly invalidates that user's existing sessions.
- Usernames are matched case-insensitively at login.
"""
import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select  # noqa: E402

from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User  # noqa: E402

ROLES = ("admin", "manager")


def _find(db, username: str) -> User | None:
    return db.execute(
        select(User).where(func.lower(User.username) == username.strip().lower())
    ).scalar_one_or_none()


def _read_password(args) -> str:
    if getattr(args, "password", None):
        return args.password
    pw = getpass.getpass("New password: ")
    confirm = getpass.getpass("Repeat it: ")
    if pw != confirm:
        sys.exit("Passwords don't match — nothing changed.")
    if len(pw) < 8:
        sys.exit("Password must be at least 8 characters.")
    return pw


def cmd_list(db, _args) -> None:
    users = db.execute(select(User).order_by(User.role, User.username)).scalars().all()
    if not users:
        print("No users — auth is disabled (open dev mode).")
        print("Add one with:  python scripts/manage_users.py add <name> --role admin")
        return
    width = max(len(u.username) for u in users)
    for u in users:
        print(f"{u.username:<{width}}  {u.role:<8}  created {u.created_at:%Y-%m-%d}")


def cmd_add(db, args) -> None:
    if _find(db, args.username):
        sys.exit(f"User '{args.username}' already exists.")
    password = _read_password(args)
    db.add(User(username=args.username.strip(), password_hash=hash_password(password), role=args.role))
    db.commit()
    print(f"Added {args.role} '{args.username}'.")


def cmd_set_password(db, args) -> None:
    user = _find(db, args.username)
    if user is None:
        sys.exit(f"No user named '{args.username}'.")
    user.password_hash = hash_password(_read_password(args))
    db.commit()
    print(f"Password updated for '{user.username}' — their old sessions are now invalid.")


def cmd_set_role(db, args) -> None:
    user = _find(db, args.username)
    if user is None:
        sys.exit(f"No user named '{args.username}'.")
    user.role = args.role
    db.commit()
    print(f"'{user.username}' is now a {args.role}.")


def cmd_rename(db, args) -> None:
    user = _find(db, args.username)
    if user is None:
        sys.exit(f"No user named '{args.username}'.")
    clash = _find(db, args.new_username)
    if clash is not None and clash.id != user.id:
        sys.exit(f"'{args.new_username}' is already taken.")
    user.username = args.new_username.strip()
    db.commit()
    print(f"Renamed to '{user.username}'.")


def cmd_delete(db, args) -> None:
    user = _find(db, args.username)
    if user is None:
        sys.exit(f"No user named '{args.username}'.")
    admins = db.execute(select(func.count(User.id)).where(User.role == "admin")).scalar_one()
    if user.role == "admin" and admins <= 1:
        sys.exit("Refusing: that is the only admin account. Add another admin first.")
    db.delete(user)
    db.commit()
    print(f"Deleted '{args.username}'.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="show all accounts")

    p = sub.add_parser("add", help="create an account")
    p.add_argument("username")
    p.add_argument("--role", choices=ROLES, required=True)
    p.add_argument("--password", help="omit to be prompted with hidden input")

    p = sub.add_parser("set-password", help="reset a password")
    p.add_argument("username")
    p.add_argument("--password", help="omit to be prompted with hidden input")

    p = sub.add_parser("set-role", help="switch admin <-> manager")
    p.add_argument("username")
    p.add_argument("role", choices=ROLES)

    p = sub.add_parser("rename", help="change a username")
    p.add_argument("username")
    p.add_argument("new_username")

    p = sub.add_parser("delete", help="remove an account")
    p.add_argument("username")

    args = parser.parse_args()
    handlers = {
        "list": cmd_list,
        "add": cmd_add,
        "set-password": cmd_set_password,
        "set-role": cmd_set_role,
        "rename": cmd_rename,
        "delete": cmd_delete,
    }
    db = SessionLocal()
    try:
        handlers[args.command](db, args)
    finally:
        db.close()


if __name__ == "__main__":
    main()
