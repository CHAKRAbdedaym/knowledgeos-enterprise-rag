"""API tests use deterministic embeddings with the actual local Qdrant engine."""

import hashlib
import os
import re
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from langchain_core.embeddings import Embeddings
from qdrant_client import QdrantClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings, get_settings
from app.database import get_db
from app.main import app
from app.security import request_times
from app.retrieval import VectorService, get_vectors


class DeterministicTestEmbeddings(Embeddings):
    """Token hashing is a TEST DOUBLE, never used in the application runtime."""

    revision = "test-double-sha256-v1"

    def embed_documents(self, texts):
        vectors = []
        for text in texts:
            vector = [0.0] * 384
            for token in re.findall(r"\w+", text.lower()):
                index = int(hashlib.sha256(token.encode()).hexdigest()[:8], 16) % 384
                vector[index] += 1.0
            vectors.append(vector)
        return vectors

    def embed_query(self, text):
        return self.embed_documents([text])[0]


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path}/test.db"
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    migration = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(migration, "head")
    engine = create_engine(url, connect_args={"check_same_thread": False})
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(database_url=url, upload_dir=tmp_path / "uploads", rate_limit_per_minute=1000)
    remote = os.getenv("TEST_QDRANT_URL")
    qdrant = QdrantClient(url=remote) if remote else QdrantClient(":memory:")
    settings.qdrant_collection = "test_" + hashlib.sha256(str(tmp_path).encode()).hexdigest()[:16]
    vectors = VectorService(settings, client=qdrant, embeddings=DeterministicTestEmbeddings())

    def db_override():
        with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_vectors] = lambda: vectors
    request_times.clear()
    with TestClient(app, raise_server_exceptions=False) as test_client:
        test_client.vectors = vectors
        test_client.settings = settings
        yield test_client
    if remote and qdrant.collection_exists(settings.qdrant_collection):
        qdrant.delete_collection(settings.qdrant_collection)
    qdrant.close()
    engine.dispose()
    app.dependency_overrides.clear()
    get_settings.cache_clear()
