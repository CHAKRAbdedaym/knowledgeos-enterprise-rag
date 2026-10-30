from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import get_settings


@lru_cache
def engine():
    url = get_settings().database_url
    return create_engine(
        url, pool_pre_ping=True, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {"connect_timeout": 5}
    )


def get_db():
    with sessionmaker(bind=engine(), expire_on_commit=False)() as session:
        yield session
