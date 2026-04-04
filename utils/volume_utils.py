from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import modal


VOLUME_ROOT = Path("/vol")


def run_root(run_id: str) -> Path:
    return VOLUME_ROOT / "runs" / run_id


def ensure_run_dirs(run_id: str) -> Dict[str, Path]:
    root = run_root(run_id)
    paths = {
        "root": root,
        "src": root / "src",
        "checkpoints": root / "checkpoints",
        "logs": root / "logs",
        "reports": root / "reports",
        "summaries": root / "summaries",
    }
    for p in paths.values():
        p.mkdir(parents=True, exist_ok=True)
    return paths


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")


def upload_dataset(local_path: str, remote_path: str, volume_name: str) -> str:
    vol = modal.Volume.from_name(volume_name, create_if_missing=True)
    with vol.batch_upload() as batch:
        batch.put_file(local_path, remote_path)
    return remote_path
