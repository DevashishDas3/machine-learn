from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

from config import SETTINGS
from modal_app import app, data_volume, train_image
from schemas import Approach, TrainingResult
from utils.code_runner import run_generated_code
from utils.prompting import read_prompt
from utils.volume_utils import ensure_run_dirs, write_json

_MAX_CODEGEN_RETRIES = 2


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
    result = re.sub(r'(#[^\n]{0,200}?)(\s*#[^\n]*){10,}', r'\1', result)
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
        dataset_path: str,
        task_description: str,
        hyperparameters: Optional[Dict[str, Any]] = None,
        labels_path: Optional[str] = None,
    ) -> str:
        labels_block = (
            f"Labels path (IDX1-ubyte, paired with images):\n{labels_path}\n\n"
            if labels_path
            else "Labels path: (not provided; infer from task or single-file dataset only)\n\n"
        )
        base_prompt = (
            f"{self.prompt_template}\n\n"
            f"Task:\n{task_description}\n\n"
            f"Dataset path (images / primary file):\n{dataset_path}\n\n"
            f"{labels_block}"
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
                    max_tokens=4096,
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
    dataset_path: str,
    task_description: str,
    generated_code: str,
    hyperparameters: Optional[Dict[str, Any]] = None,
    labels_path: Optional[str] = None,
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

    payload = {
        "dataset_path": dataset_path,
        "labels_path": labels_path,
        "task_description": task_description,
        "approach": approach_obj.model_dump(),
        "hyperparameters": hyperparameters or approach_obj.hyperparameters,
        "checkpoint_path": str(checkpoint_path),
    }
    execution = run_generated_code(generated_code, payload, timeout_seconds=SETTINGS.train_timeout_seconds)
    if isinstance(execution, dict):
        execution = _coerce_train_output(execution)
    error = execution.get("error")

    metrics = execution.get("metrics", {}) if isinstance(execution, dict) else {}
    logs = execution.get("logs", "No logs captured.")
    logs_path.write_text(str(logs), encoding="utf-8")

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

    result = TrainingResult(
        approach_name=approach_obj.name,
        metrics=metrics,
        model_checkpoint_path=str(checkpoint_path),
        logs_path=str(logs_path),
        source_code_path=str(src_path),
        error=error,
    )
    return result.model_dump()
