from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

from config import SETTINGS
from supabase_helpers import add_chat_message, create_run, fail_run


def _safe_filename(name: str) -> str:
    cleaned = "".join(ch for ch in name if ch.isalnum() or ch in {"-", "_", "."})
    if not cleaned:
        return "upload.bin"
    return cleaned


def _build_remote_paths(
    user_id: str, run_id: str, dataset_name: str, labels_name: str
) -> tuple[str, str, str]:
    timestamp = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    base = f"/datasets/{user_id}/{run_id}/{timestamp}"
    dataset_path = f"{base}/{dataset_name}"
    labels_path = f"{base}/{labels_name}"
    return base, dataset_path, labels_path


def _build_modal_run_command(
    *,
    swarm_run_id: str,
    dataset_path: str,
    labels_path: str,
    task_description: str,
    modal_environment: str,
) -> list[str]:
    cmd = ["modal", "run"]
    if modal_environment:
        cmd.extend(["--env", modal_environment])

    cmd.extend(
        [
            "orchestrator.py",
            "--dataset-path",
            dataset_path,
            "--labels-path",
            labels_path,
            "--task-description",
            task_description,
            "--swarm-run-id",
            swarm_run_id,
        ]
    )
    return cmd


def _utf8_subprocess_env() -> dict[str, str]:
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env.setdefault("LLM_USE_DEPLOYED_SERVICE", "true")
    env.setdefault("LLM_ALLOW_LOCAL_FALLBACK", "false")
    return env


def _launch_pipeline_background(*, workdir: Path, cmd: list[str]) -> None:
    proc_env = _utf8_subprocess_env()
    if os.name == "nt":
        subprocess.Popen(  # noqa: S603
            cmd,
            cwd=str(workdir),
            env=proc_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            | subprocess.DETACHED_PROCESS,
        )
        return
    subprocess.Popen(  # noqa: S603
        cmd,
        cwd=str(workdir),
        env=proc_env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Start a dashboard-triggered run")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--task-description", required=True)
    parser.add_argument("--dataset-local-path", required=True)
    parser.add_argument("--labels-local-path", required=True)
    parser.add_argument("--run-name", default="")
    parser.add_argument("--modal-environment", default="")
    args = parser.parse_args()

    workdir = Path(__file__).resolve().parent
    dataset_local = Path(args.dataset_local_path)
    labels_local = Path(args.labels_local_path)

    if not dataset_local.exists() or not labels_local.exists():
        raise FileNotFoundError("Uploaded dataset or labels file not found")

    dataset_name = _safe_filename(dataset_local.name)
    labels_name = _safe_filename(labels_local.name)
    run_name = (
        args.run_name.strip()
        or f"Run {datetime.now(tz=UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )

    swarm_run_id = create_run(
        user_id=args.user_id,
        name=run_name,
        initial_message="Run created from dashboard. Preparing dataset upload.",
        run_data={
            "task_description": args.task_description,
            "uploaded_dataset_name": dataset_name,
            "uploaded_labels_name": labels_name,
            "submitted_from": "dashboard-next",
            "created_at": datetime.now(tz=UTC).isoformat(),
        },
    )

    _, dataset_remote_path, labels_remote_path = _build_remote_paths(
        args.user_id,
        swarm_run_id,
        dataset_name,
        labels_name,
    )

    add_chat_message(
        swarm_run_id,
        "agent",
        "Uploading dataset files to Modal volume...",
        "load_modal",
    )

    try:
        put_dataset = [
            "modal",
            "volume",
            "put",
            SETTINGS.modal_volume_name,
            str(dataset_local),
            dataset_remote_path,
        ]
        if args.modal_environment:
            put_dataset.extend(["--env", args.modal_environment])

        put_labels = [
            "modal",
            "volume",
            "put",
            SETTINGS.modal_volume_name,
            str(labels_local),
            labels_remote_path,
        ]
        if args.modal_environment:
            put_labels.extend(["--env", args.modal_environment])

        subprocess.run(
            put_dataset,
            cwd=str(workdir),
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_utf8_subprocess_env(),
        )
        subprocess.run(
            put_labels,
            cwd=str(workdir),
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_utf8_subprocess_env(),
        )
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or str(exc)).strip()
        fail_run(swarm_run_id, details[:3000], "load_modal")
        print(
            json.dumps(
                {"ok": False, "error": details[:3000], "swarmRunId": swarm_run_id}
            )
        )
        return 1

    add_chat_message(
        swarm_run_id,
        "agent",
        f"Upload complete. Dataset: /vol{dataset_remote_path} | Labels: /vol{labels_remote_path}",
        "load_modal",
    )
    add_chat_message(
        swarm_run_id,
        "agent",
        "Starting orchestration pipeline on Modal...",
        "load_modal",
    )

    modal_run_cmd = _build_modal_run_command(
        swarm_run_id=swarm_run_id,
        dataset_path=f"/vol{dataset_remote_path}",
        labels_path=f"/vol{labels_remote_path}",
        task_description=args.task_description,
        modal_environment=args.modal_environment,
    )
    _launch_pipeline_background(workdir=workdir, cmd=modal_run_cmd)

    print(
        json.dumps(
            {
                "ok": True,
                "swarmRunId": swarm_run_id,
                "runName": run_name,
                "datasetPath": f"/vol{dataset_remote_path}",
                "labelsPath": f"/vol{labels_remote_path}",
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
