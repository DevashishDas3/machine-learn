from __future__ import annotations

import json
from typing import Any, Type, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


def extract_json_payload(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped
    if stripped.startswith("[") and stripped.endswith("]"):
        return stripped

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and start < end:
        return stripped[start : end + 1]
    raise ValueError("No JSON object found in model output.")


def parse_model_output(text: str, model_cls: Type[T]) -> T:
    payload = extract_json_payload(text)
    data: Any = json.loads(payload)
    try:
        return model_cls.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Schema validation failed: {exc}") from exc
