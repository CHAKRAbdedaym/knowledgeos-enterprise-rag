"""Allowlisted structured application events; never serialize request bodies."""
import json
import logging
from datetime import datetime, timezone


class EventFormatter(logging.Formatter):
    def format(self, record):
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for field in ("document_id", "error_type"):
            if hasattr(record, field):
                event[field] = getattr(record, field)
        return json.dumps(event)


def configure_logging():
    logger = logging.getLogger("knowledgeos")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(EventFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
