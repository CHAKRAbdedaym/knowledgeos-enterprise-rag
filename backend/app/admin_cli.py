"""Create an administrator interactively. Never accepts passwords in arguments/env."""

import argparse
import getpass
import sys
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import hasher
from app.database import engine
from app.models import Admin


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username")
    args = parser.parse_args()
    if not sys.stdin.isatty():
        parser.error("Use an interactive terminal for hidden password entry.")
    username = (args.username or input("Administrator username: ")).strip().lower()
    if not username or len(username) > 160:
        parser.error("Username must contain 1–160 characters.")
    with Session(engine()) as db:
        if db.scalar(select(Admin.id).where(Admin.username == username)):
            parser.error("This administrator already exists; no changes made.")
        password = getpass.getpass("Password (at least 12 characters): ")
        if not 12 <= len(password) <= 1024:
            parser.error("Use 12–1024 characters.")
        if password != getpass.getpass("Confirm password: "):
            parser.error("Passwords do not match.")
        db.add(Admin(username=username, password_hash=hasher.hash(password)))
        del password
        db.commit()
    print("Administrator created. Sign in using the browser.")


if __name__ == "__main__":
    main()
