#!/usr/bin/env python3
"""Local trusted-operator setup: publish ONLY a new synthetic portal handbook.

Requires local database operator access and running KnowledgeOS. Creates a random
short-lived setup admin, uses authenticated HTTP ingestion/integration endpoints,
and removes that account in finally. Never modifies the owner's admin account or
publishes historical documents. The generated integration secret stays in .env.
"""

import hashlib
import os
import secrets
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import httpx
from app.auth import hasher
from app.database import engine
from app.models import Admin, AdminSession, Document, SecurityAudit
from dotenv import dotenv_values
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session


def save_environment(name, value):
    path = ROOT / ".env"
    lines = path.read_text().splitlines() if path.exists() else []
    prefix = name + "="
    lines = [line for line in lines if not line.strip().startswith(prefix)]
    lines.append(prefix + value)
    fd, temporary = tempfile.mkstemp(prefix=".env.", dir=ROOT)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write("\n".join(lines) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    for attempt in range(30):
        try:
            if (
                httpx.get("http://localhost:8000/api/health", timeout=2).status_code
                == 200
            ):
                break
        except httpx.HTTPError:
            pass
        time.sleep(1)
    else:
        raise SystemExit(
            "Backend not ready; no setup account or permissions were changed."
        )
    configured = dotenv_values(ROOT / ".env").get("KNOWLEDGEOS_INTEGRATION_KEY")
    if configured:
        with httpx.Client(timeout=15, follow_redirects=False) as check:
            response = check.get(
                "http://localhost:8000/api/v1/capabilities",
                headers={
                    "Authorization": "Bearer " + configured,
                    "X-Employee-Subject": "synthetic-setup-verification",
                },
            )
        if response.status_code != 200:
            raise SystemExit(
                "Existing portal credential is invalid; rotate it in Admin > Integrations before rerunning."
            )
        print(
            "Existing portal credential retained; no automatic document permission changes."
        )
        return
    username = "portal-setup-" + secrets.token_hex(8)
    password = secrets.token_urlsafe(32)
    with Session(engine()) as db:
        operator = Admin(username=username, password_hash=hasher.hash(password))
        db.add(operator)
        db.commit()
        operator_id = operator.id
    try:
        with httpx.Client(
            base_url="http://localhost:8000",
            headers={"Origin": "http://localhost:8080"},
            timeout=180,
            follow_redirects=False,
        ) as client:
            response = client.post(
                "/api/auth/login", json={"username": username, "password": password}
            )
            if response.status_code != 200:
                raise RuntimeError("Temporary local setup login failed")
            client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
            path = ROOT / "data/demo_portal/atlas_employee_handbook.md"
            data = path.read_bytes()
            with Session(engine()) as db:
                document_id = db.scalar(
                    select(Document.id).where(
                        Document.sha256 == hashlib.sha256(data).hexdigest()
                    )
                )
            if document_id is None:
                response = client.post(
                    "/api/documents",
                    files={"file": (path.name, data, "text/markdown")},
                    data={
                        "category": "Synthetic portal demo",
                        "tags": "synthetic,atlas,demo",
                    },
                )
                if (
                    response.status_code != 201
                    or response.json()["status"] != "indexed"
                ):
                    raise RuntimeError(
                        "Synthetic portal handbook ingestion failed; original data was not changed"
                    )
                document_id = response.json()["id"]
            response = client.patch(
                f"/api/documents/{document_id}/access",
                json={"employee_available": True},
            )
            if response.status_code != 200:
                raise RuntimeError("Explicit demo document publication failed")
            response = client.post(
                "/api/admin/integrations",
                json={
                    "name": "Atlas fictional employee portal",
                    "allowed_origins": ["http://127.0.0.1:8090"],
                    "document_ids": [document_id],
                    "rate_limit_per_minute": 60,
                },
            )
            if response.status_code != 201:
                raise RuntimeError("Demo integration creation failed")
            integration_id = response.json()["id"]
            response = client.post(
                f"/api/admin/integrations/{integration_id}/keys",
                json={"expires_in_days": 90},
            )
            if response.status_code != 201:
                raise RuntimeError("Demo credential issuance failed")
            save_environment("KNOWLEDGEOS_INTEGRATION_KEY", response.json()["secret"])
            print(
                "Atlas portal integration configured; secret saved only to ignored .env (0600)."
            )
            print(
                "Only the new synthetic handbook was published. Original documents remain private."
            )
            print("Next: docker compose up -d --no-deps --force-recreate intranet")
    finally:
        with Session(engine()) as db:
            db.execute(
                update(SecurityAudit)
                .where(SecurityAudit.admin_id == operator_id)
                .values(admin_id=None)
            )
            db.execute(delete(AdminSession).where(AdminSession.admin_id == operator_id))
            db.execute(delete(Admin).where(Admin.id == operator_id))
            db.commit()


if __name__ == "__main__":
    main()
