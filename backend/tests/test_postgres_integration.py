"""Optional real PostgreSQL migration round-trip; local tests always test Alembic on SQLite."""

import os
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


@pytest.mark.integration
def test_real_postgres_schema_migrations(monkeypatch):
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database")
    from app.config import get_settings

    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    config = Config("alembic.ini")
    command.upgrade(config, "head")
    engine = create_engine(url)
    assert {"documents", "chunks", "conversations", "messages", "query_logs"} <= set(inspect(engine).get_table_names())
    command.check(config)
    engine.dispose()
    get_settings.cache_clear()
