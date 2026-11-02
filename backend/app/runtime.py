"""Secret-free persisted administrator settings, constrained by server configuration."""

from typing import Annotated
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import Settings, get_settings
from app.models import RuntimeSettings


def effective(db, settings):
    row = db.get(RuntimeSettings, 1)
    values = row.values if row else {}
    allowed = {"default_top_k", "default_score_threshold", "llm_provider", "llm_model"}
    try:
        return Settings.model_validate(settings.model_dump() | {k: v for k, v in values.items() if k in allowed})
    except ValueError:
        raise HTTPException(
            503, "Configured generation provider is unavailable; an administrator must review server configuration."
        ) from None


def runtime_settings(db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]):
    return effective(db, settings)
