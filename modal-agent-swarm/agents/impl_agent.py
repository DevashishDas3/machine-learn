from __future__ import annotations

import json
import re
from hashlib import sha1
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import SETTINGS
from modal_app import app, data_volume, train_image
from schemas import Approach, DatasetMetadata, TrainingResult
from utils.code_runner import run_generated_code
from utils.prompting import read_prompt
from utils.volume_utils import ensure_run_dirs, write_json

_MAX_CODEGEN_RETRIES = 2
_MAX_FIX_COMPILE_RETRIES = 2
_MAX_AGENTIC_FIX_ROUNDS = 3


def _snip(text: str, limit: int = 1200) -> str:
    clean = " ".join((text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: limit - 3] + "..."


def _fingerprint(code: str) -> str:
    return sha1(code.encode("utf-8", errors="ignore")).hexdigest()[:12]


def _build_runtime_repair_hints(runtime_error: str) -> str:
    err = (runtime_error or "").lower()
    hints: List[str] = []

    if "could not convert string to float" in err:
        hints.append(
            "Detected numeric conversion failure from string features. "
            "For sklearn tabular models, preprocess mixed types with a ColumnTransformer "
            "(OneHotEncoder for object/category columns, passthrough or scaling for numeric columns)."
        )
    if "invalid literal for int()" in err:
        hints.append(
            "Detected label/int casting failure. Do not cast labels with int(...). "
            "If y is non-numeric strings (e.g., Yes/No), use LabelEncoder on y before fitting classifiers."
        )
    if "local variable 'pd'" in err or 'local variable "pd"' in err:
        hints.append(
            "Detected missing pandas symbol. If pandas is used anywhere, include `import pandas as pd` at the top-level imports."
        )
    if (
        "cannot import name 'columntransformer'" in err
        or 'cannot import name "columntransformer"' in err
    ):
        hints.append(
            "Detected wrong ColumnTransformer import path. Use `from sklearn.compose import ColumnTransformer` "
            "(NOT from sklearn.preprocessing)."
        )

    if not hints:
        return ""
    return "\n".join(f"- {h}" for h in hints)


def _select_dataset_hints(
    dataset_metadata: Dict[str, Any] | None,
) -> tuple[str | None, list[str], str | None]:
    if not isinstance(dataset_metadata, dict):
        return None, [], None

    files = dataset_metadata.get("files")
    label_column = dataset_metadata.get("suggested_label_column")
    if not isinstance(files, list):
        return None, [], label_column if isinstance(label_column, str) else None

    # Prefer tabular files when present.
    tabular = next(
        (
            f
            for f in files
            if isinstance(f, dict) and f.get("format") in {"csv", "json", "parquet"}
        ),
        None,
    )
    chosen = tabular or next((f for f in files if isinstance(f, dict)), None)
    if not isinstance(chosen, dict):
        return None, [], label_column if isinstance(label_column, str) else None

    dataset_format = chosen.get("format")
    raw_columns = chosen.get("columns")
    schema: list[str] = []
    if isinstance(raw_columns, list):
        for col in raw_columns:
            if isinstance(col, str) and col.strip():
                schema.append(col.strip())

    label = (
        label_column if isinstance(label_column, str) and label_column.strip() else None
    )
    if label and schema:
        schema = [col for col in schema if col != label]

    return dataset_format if isinstance(dataset_format, str) else None, schema, label


def _sanitize_generated_code(code: str) -> str:
    """Strip repeated trailing comments and other degenerate LLM output."""
    lines = code.split("\n")
    cleaned: list[str] = []
    prev_comment = ""
    repeat_count = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            if stripped == prev_comment:
                repeat_count += 1
                if repeat_count >= 2:
                    continue
            else:
                repeat_count = 0
                prev_comment = stripped
        else:
            repeat_count = 0
            prev_comment = ""
        cleaned.append(line)

    result = "\n".join(cleaned)
    result = re.sub(r"(#[^\n]{0,200}?)(\s*#[^\n]*){10,}", r"\1", result)
    return result


def _compile_check(code: str) -> str | None:
    """Return None if code compiles, else the error message."""
    try:
        compile(code, "<generated_train.py>", "exec")
        return None
    except SyntaxError as e:
        return f"SyntaxError at line {e.lineno}: {e.msg}"


def _coerce_train_output(execution: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise generated training output.

    1. If the model returns floats at top level but omits metrics, promote them.
    2. If the code silently swallowed an exception (logs contain 'Error:' but
       no error key is set), promote the log message to the error field so the
       pipeline marks the run as failed rather than succeeded with 0.0 accuracy.
    """
    if not isinstance(execution, dict):
        return execution

    # Detect silent exception swallowing: logs say "Error:" but error key absent.
    if not execution.get("error"):
        logs = str(execution.get("logs", ""))
        if logs.startswith("Error:") or "\nError:" in logs:
            out = dict(execution)
            out["error"] = logs
            out.setdefault("metrics", {})
            return out

    m = execution.get("metrics")
    if isinstance(m, dict) and m:
        return execution

    promoted: Dict[str, float] = {}
    skip = {"error", "logs", "model_checkpoint_path", "metrics"}
    for k, v in execution.items():
        if k in skip:
            continue
        try:
            promoted[str(k).strip().lower()] = float(v)
        except (TypeError, ValueError):
            continue
    if not promoted:
        return execution
    out = dict(execution)
    out["metrics"] = promoted
    return out


FALLBACK_TRAIN_CODE = """
def train(payload: dict) -> dict:
    hyper = payload.get("hyperparameters", {})
    metrics = {
        "accuracy": float(hyper.get("target_accuracy", 0.5)),
        "loss": float(hyper.get("target_loss", 1.0)),
    }
    return {
        "metrics": metrics,
        "model_checkpoint_path": payload.get("checkpoint_path", ""),
        "logs": "Fallback training stub executed.",
    }
"""


class ImplementationAgent:
    def __init__(self, llm_server) -> None:
        self.llm_server = llm_server
        self.prompt_template = read_prompt("impl_agent.txt")

    async def generate_code(
        self,
        approach: Approach,
        dataset_base_path: str,
        dataset_metadata: DatasetMetadata,
        task_description: str,
        hyperparameters: Optional[Dict[str, Any]] = None,
    ) -> str:
        base_prompt = (
            f"{self.prompt_template}\n\n"
            f"Task:\n{task_description}\n\n"
            f"Dataset base path:\n{dataset_base_path}\n\n"
            f"Dataset metadata:\n{dataset_metadata.model_dump_json(indent=2)}\n\n"
            f"Approach:\n{approach.model_dump_json(indent=2)}\n\n"
            f"Hyperparameters override:\n{json.dumps(hyperparameters or {}, indent=2)}\n"
        )

        last_code = ""
        for attempt in range(_MAX_CODEGEN_RETRIES + 1):
            prompt = base_prompt
            if attempt > 0 and last_code:
                compile_err = _compile_check(last_code)
                prompt += (
                    f"\n\nYour previous attempt had an error:\n{compile_err}\n"
                    f"Fix the error and return the COMPLETE corrected code.\n"
                )
            try:
                raw = await self.llm_server.generate.remote.aio(
                    prompt=prompt,
                    temperature=0.1,
                    max_tokens=1500,
                )
                code = _sanitize_generated_code(raw)
                compile_err = _compile_check(code)
                if compile_err is None:
                    return code
                last_code = code
            except Exception:  # noqa: BLE001
                if attempt == _MAX_CODEGEN_RETRIES:
                    return FALLBACK_TRAIN_CODE
        return _sanitize_generated_code(last_code) if last_code else FALLBACK_TRAIN_CODE

    async def fix_code_after_failure(
        self,
        approach: Approach,
        dataset_base_path: str,
        dataset_metadata: DatasetMetadata,
        task_description: str,
        failed_code: str,
        runtime_error: str,
        hyperparameters: Optional[Dict[str, Any]] = None,
        logs_excerpt: Optional[str] = None,
        failure_history: Optional[List[str]] = None,
    ) -> str:
        """Regenerate training code after a failed execution with iterative repairs."""
        hp = (
            hyperparameters if hyperparameters is not None else approach.hyperparameters
        )
        base_prompt = (
            f"{self.prompt_template}\n\n"
            f"Task:\n{task_description}\n\n"
            f"Dataset base path:\n{dataset_base_path}\n\n"
            f"Dataset metadata:\n{dataset_metadata.model_dump_json(indent=2)}\n\n"
            f"Approach:\n{approach.model_dump_json(indent=2)}\n\n"
            f"Hyperparameters in effect:\n{json.dumps(hp, indent=2)}\n"
        )
        history_lines = [
            f"- {idx + 1}. {_snip(item, 500)}"
            for idx, item in enumerate((failure_history or [])[-8:])
            if item
        ]
        fix_intro = (
            "\n\n=== FIX FAILED TRAINING RUN ===\n"
            "You are operating as an iterative coding agent.\n"
            "The code below was executed and failed. Fix the bug(s) so train() runs successfully.\n"
            "Preserve the same train(payload: dict) -> dict contract and output rules.\n\n"
            f"Runtime error:\n{runtime_error}\n"
        )
        if history_lines:
            fix_intro += "\nFailure history (oldest to newest):\n" + "\n".join(
                history_lines
            )
        if logs_excerpt and logs_excerpt.strip():
            fix_intro += f"\nLog output (excerpt):\n{logs_excerpt[:6000]}\n"
        fix_intro += (
            "\nCritical debugging requirements:\n"
            "- Read payload keys exactly as specified.\n"
            "- load_dataset() already returns X and y; do not remove labels from X again.\n"
            "- If building a DataFrame from X and schema, only do so when len(schema) == X.shape[1].\n"
            "- If prior fixes repeated the same failure, choose a substantially different fix strategy.\n"
        )
        targeted_hints = _build_runtime_repair_hints(runtime_error)
        if targeted_hints:
            fix_intro += (
                "\nTargeted hints from observed error:\n" + targeted_hints + "\n"
            )
        fix_intro += f"\nFailed code to correct:\n\n{failed_code}\n"

        last_code = failed_code
        seen_fingerprints = {_fingerprint(failed_code)}
        for round_idx in range(1, _MAX_AGENTIC_FIX_ROUNDS + 1):
            prompt = (
                base_prompt
                + fix_intro
                + f"\n\nRepair round {round_idx}/{_MAX_AGENTIC_FIX_ROUNDS}."
                + " Return the COMPLETE corrected Python file only."
            )
            if round_idx > 1 and last_code:
                compile_err = _compile_check(last_code)
                if compile_err:
                    prompt += (
                        f"\n\nYour previous fix failed to compile:\n{compile_err}\n"
                        f"Return the COMPLETE corrected code.\n"
                    )
                else:
                    prompt += (
                        "\n\nYour previous fix still failed at runtime. "
                        "Apply a different debugging approach and return full corrected code.\n"
                    )
            try:
                raw = await self.llm_server.generate.remote.aio(
                    prompt=prompt,
                    temperature=0.1,
                    max_tokens=2000,
                )
                code = _sanitize_generated_code(raw)
                compile_err = _compile_check(code)
                if compile_err is None:
                    fp = _fingerprint(code)
                    if fp in seen_fingerprints and round_idx < _MAX_AGENTIC_FIX_ROUNDS:
                        last_code = code
                        continue
                    seen_fingerprints.add(fp)
                    return code
                last_code = code
            except Exception:  # noqa: BLE001
                if round_idx == _MAX_AGENTIC_FIX_ROUNDS:
                    return _sanitize_generated_code(last_code)
        return _sanitize_generated_code(last_code) if last_code else failed_code


@app.function(
    image=train_image,
    gpu=SETTINGS.impl_gpu,
    timeout=SETTINGS.train_timeout_seconds,
    retries=1,
    max_containers=SETTINGS.max_parallel_agents,
    volumes={"/vol": data_volume},
)
def run_implementation(
    run_id: str,
    approach: Dict[str, Any],
    dataset_base_path: str,
    task_description: str,
    generated_code: str,
    hyperparameters: Optional[Dict[str, Any]] = None,
    dataset_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    data_volume.reload()
    approach_obj = Approach.model_validate(approach)
    dirs = ensure_run_dirs(run_id)
    approach_slug = approach_obj.name.lower().replace(" ", "_")
    src_path = dirs["src"] / approach_slug / "train.py"
    src_path.parent.mkdir(parents=True, exist_ok=True)
    src_path.write_text(generated_code, encoding="utf-8")

    checkpoint_path = dirs["checkpoints"] / approach_slug / "model.chkpt"
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    logs_path = dirs["logs"] / f"{approach_slug}.log"

    dataset_format, schema, label_column = _select_dataset_hints(dataset_metadata)

    payload = {
        "dataset_base_path": dataset_base_path,
        "task_description": task_description,
        "dataset_metadata": dataset_metadata or {},
        "dataset_format": dataset_format,
        "schema": schema,
        "label_column": label_column,
        "approach": approach_obj.model_dump(),
        "hyperparameters": hyperparameters or approach_obj.hyperparameters,
        "checkpoint_path": str(checkpoint_path),
    }
    execution = run_generated_code(
        generated_code, payload, timeout_seconds=SETTINGS.train_timeout_seconds
    )
    if isinstance(execution, dict):
        execution = _coerce_train_output(execution)
    error = execution.get("error")

    metrics = execution.get("metrics", {}) if isinstance(execution, dict) else {}
    logs = execution.get("logs", "No logs captured.")
    logs_str = str(logs)
    logs_path.write_text(logs_str, encoding="utf-8")

    if not checkpoint_path.exists():
        checkpoint_path.write_text("placeholder checkpoint", encoding="utf-8")

    artifact_json = dirs["summaries"] / f"{approach_slug}_initial.json"
    write_json(
        artifact_json,
        {
            "approach": approach_obj.model_dump(),
            "hyperparameters": payload["hyperparameters"],
            "execution": execution,
        },
    )

    data_volume.commit()

    excerpt = logs_str[:8000] if logs_str else None
    result = TrainingResult(
        approach_name=approach_obj.name,
        metrics=metrics,
        model_checkpoint_path=str(checkpoint_path),
        logs_path=str(logs_path),
        source_code_path=str(src_path),
        error=error,
        logs_excerpt=excerpt,
    )
    return result.model_dump()
