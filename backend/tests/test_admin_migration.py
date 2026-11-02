from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models import Document, Chunk, Message, QueryLog, Admin


def test_upgrade_preserves_existing_corpus_and_history(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path}/legacy.db"
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "0001_initial")
    engine = create_engine(url)
    from sqlalchemy import MetaData, Table
    from datetime import datetime, timezone

    meta = MetaData()
    tables = {name: Table(name, meta, autoload_with=engine) for name in ["documents", "chunks", "conversations", "messages", "query_logs"]}
    now = datetime.now(timezone.utc)
    with engine.begin() as db:
        db.execute(
            tables["documents"]
            .insert()
            .values(
                id="legacy-doc",
                title="Synthetic legacy",
                filename="legacy.md",
                category="People",
                tags=[],
                status="indexed",
                sha256="a" * 64,
                size_bytes=12,
                text="legacy text",
                pages=[],
                chunk_count=1,
                page_count=1,
                updated_at=now,
                embedding_revision="preserved",
                created_at=now,
            )
        )
        db.execute(
            tables["chunks"]
            .insert()
            .values(id="legacy-vector", document_id="legacy-doc", text="legacy text", page=None, start_offset=0, end_offset=11)
        )
        db.execute(tables["conversations"].insert().values(id="legacy-conversation", title="Existing history", created_at=now))
        db.execute(
            tables["messages"]
            .insert()
            .values(
                id="legacy-message",
                conversation_id="legacy-conversation",
                role="user",
                content="Existing question",
                sources=[],
                created_at=now,
            )
        )
        db.execute(
            tables["query_logs"]
            .insert()
            .values(
                id="legacy-query",
                question="Existing question",
                mode="retrieval_only",
                latency_ms=1,
                matched_chunks=1,
                document_ids=["legacy-doc"],
                created_at=now,
            )
        )
    command.upgrade(config, "head")
    command.check(config)
    with Session(engine) as db:
        assert db.get(Document, "legacy-doc").sha256 == "a" * 64
        assert db.get(Document, "legacy-doc").embedding_revision == "preserved"
        assert db.get(Chunk, "legacy-vector").text == "legacy text"
        assert db.get(Message, "legacy-message").content == "Existing question"
        assert db.get(QueryLog, "legacy-query").question == "Existing question"
        assert db.scalar(select(func.count()).select_from(Admin)) == 0
    engine.dispose()
    get_settings.cache_clear()
