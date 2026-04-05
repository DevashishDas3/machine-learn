from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List

from schemas import TuningHistoryRecord

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNS_LOCAL_DIR = _PROJECT_ROOT / "runs_local"
HISTORY_DIR = RUNS_LOCAL_DIR / "history"


def runs_local_root() -> Path:
    return RUNS_LOCAL_DIR


class RunEventLogger:
    """Append-only JSONL on the machine running `modal run` (local process)."""

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self.dir = RUNS_LOCAL_DIR / run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.events_path = self.dir / "events.jsonl"

    def emit(self, event: str, **data: Any) -> None:
        line: Dict[str, Any] = {
            "ts": datetime.now(tz=UTC).isoformat(),
            "run_id": self.run_id,
            "event": event,
            **data,
        }
        with self.events_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")

    def write_state(self, snapshot: Dict[str, Any]) -> None:
        path = self.dir / "state.json"
        path.write_text(
            json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8"
        )


def list_run_ids() -> List[str]:
    if not RUNS_LOCAL_DIR.exists():
        return []
    return sorted(
        (p.name for p in RUNS_LOCAL_DIR.iterdir() if p.is_dir()), reverse=True
    )


def load_events_jsonl(run_id: str) -> List[Dict[str, Any]]:
    path = RUNS_LOCAL_DIR / run_id / "events.jsonl"
    if not path.exists():
        return []
    out: List[Dict[str, Any]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        if raw.strip():
            out.append(json.loads(raw))
    return out


def sanitize_approach_name(approach_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", approach_name.strip().lower()).strip("-")
    return slug or "approach"


def approach_history_path(approach_name: str) -> Path:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    return HISTORY_DIR / f"{sanitize_approach_name(approach_name)}.jsonl"


def append_tuning_history_record(record: TuningHistoryRecord) -> Path:
    path = approach_history_path(record.approach_name)
    with path.open("a", encoding="utf-8") as f:
        f.write(record.model_dump_json() + "\n")
    return path


def load_tuning_history(
    approach_name: str, limit: int | None = None
) -> List[TuningHistoryRecord]:
    path = approach_history_path(approach_name)
    if not path.exists():
        return []

    records: List[TuningHistoryRecord] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            records.append(TuningHistoryRecord.model_validate_json(line))
        except Exception:  # noqa: BLE001
            continue

    if limit is None or limit <= 0:
        return records
    return records[-limit:]
