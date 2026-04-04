from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import UTC, datetime
from typing import Any, Dict


def make_run_id(prefix: str = "run") -> str:
    ts = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}-{ts}-{uuid.uuid4().hex[:8]}"


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": datetime.now(tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
