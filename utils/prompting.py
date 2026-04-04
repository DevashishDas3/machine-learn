from __future__ import annotations

from pathlib import Path


def read_prompt(name: str) -> str:
    prompts_dir = Path(__file__).resolve().parent.parent / "prompts"
    path = prompts_dir / name
    return path.read_text(encoding="utf-8")
