#!/usr/bin/env python3
"""Run backend tests with isolated PostgreSQL DB and Qdrant test collections."""

import os
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import get_settings
from sqlalchemy.engine import make_url


def main():
    name = "knowledgeos_test_" + uuid.uuid4().hex[:12]
    command = ["docker", "compose", "exec", "-T", "postgres"]
    subprocess.run(
        [*command, "createdb", "-U", "knowledgeos", name], check=True, cwd=ROOT
    )
    try:
        url = make_url(get_settings().database_url).set(
            host="127.0.0.1",
            port=int(os.environ.get("POSTGRES_PORT", "5433")),
            database=name,
        )
        environment = {
            **os.environ,
            "TEST_DATABASE_URL": url.render_as_string(hide_password=False),
            "TEST_QDRANT_URL": "http://localhost:6333",
        }
        result = subprocess.run(
            [str(ROOT / "backend/.venv/bin/python"), "-m", "pytest", "-q"],
            cwd=ROOT / "backend",
            env=environment,
            check=False,
        )
        return result.returncode
    finally:
        subprocess.run(
            [*command, "dropdb", "-U", "knowledgeos", name], check=True, cwd=ROOT
        )


if __name__ == "__main__":
    raise SystemExit(main())
