from __future__ import annotations

import os
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
import modal
from pydantic import BaseModel

from config import SETTINGS
from schemas import RunConfig
from supabase_helpers import add_chat_message, create_run, fail_run


def _safe_filename(name: str) -> str:
    cleaned = "".join(ch for ch in name if ch.isalnum() or ch in {"-", "_", "."})
    if not cleaned:
        return "upload.bin"
    return cleaned


def _build_remote_base_path(user_id: str, run_id: str) -> str:
    timestamp = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"/datasets/{user_id}/{run_id}/{timestamp}"


async def _spawn_orchestrator_run(
    *, run_cfg: RunConfig, swarm_run_id: str | None, modal_env: str
) -> None:
    deployed_fn = modal.Function.from_name(
        SETTINGS.modal_app_name,
        "run_pipeline_job",
        environment_name=modal_env,
    )
    await deployed_fn.spawn.aio(run_cfg.model_dump(), swarm_run_id)


def _iter_files(root: Path) -> list[Path]:
    return sorted([p for p in root.rglob("*") if p.is_file()])


def _ensure_within(parent: Path, child: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _extract_zip(local_zip: Path, extract_to: Path) -> None:
    with zipfile.ZipFile(local_zip, "r") as zf:
        names = zf.namelist()
        if not names:
            raise ValueError("Dataset zip is empty")
        for name in names:
            out_path = extract_to / name
            if not _ensure_within(extract_to, out_path):
                raise ValueError(f"Unsafe zip entry: {name}")
        zf.extractall(extract_to)


async def _upload_dir_to_volume(
    local_dir: Path, remote_base: str, modal_env: str
) -> None:
    volume = modal.Volume.from_name(
        SETTINGS.modal_volume_name,
        environment_name=modal_env,
        create_if_missing=True,
    )
    files = _iter_files(local_dir)
    if not files:
        raise ValueError("Dataset zip is empty")

    async with volume.batch_upload(force=True) as batch:
        for local_file in files:
            rel = str(local_file.relative_to(local_dir)).replace("\\", "/")
            batch.put_file(str(local_file), f"{remote_base}/{rel}")


class StartRunResponse(BaseModel):
    ok: bool
    swarmRunId: str


def create_app() -> FastAPI:
    app = FastAPI(title="Dashboard Launcher Service", version="0.1.0")
    modal_env = os.getenv("MODAL_ENVIRONMENT", SETTINGS.modal_environment)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/start-run", response_model=StartRunResponse)
    async def start_run(
        user_id: str = Form(...),
        task_description: str = Form(...),
        run_name: str = Form(""),
        dataset_zip: UploadFile = File(...),
    ) -> StartRunResponse:
        if not task_description.strip():
            raise HTTPException(status_code=400, detail="Task prompt is required.")

        zip_name = _safe_filename(dataset_zip.filename or "dataset.zip")
        effective_run_name = run_name.strip() or (
            f"Run {datetime.now(tz=UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )

        swarm_run_id = create_run(
            user_id=user_id,
            name=effective_run_name,
            initial_message="Run created from dashboard. Preparing dataset upload.",
            run_data={
                "task_description": task_description,
                "uploaded_dataset_zip_name": zip_name,
                "submitted_from": "dashboard-next",
                "created_at": datetime.now(tz=UTC).isoformat(),
            },
        )

        remote_base = _build_remote_base_path(user_id, swarm_run_id)

        add_chat_message(
            swarm_run_id,
            "agent",
            "Uploading dataset zip and extracting to Modal volume...",
            "load_modal",
        )

        with tempfile.TemporaryDirectory(prefix="dashboard-run-") as temp_dir:
            zip_local = Path(temp_dir) / zip_name
            extract_dir = Path(temp_dir) / "extracted"
            extract_dir.mkdir(parents=True, exist_ok=True)
            zip_local.write_bytes(await dataset_zip.read())

            try:
                _extract_zip(zip_local, extract_dir)
                await _upload_dir_to_volume(extract_dir, remote_base, modal_env)
            except Exception as exc:  # noqa: BLE001
                details = str(exc).strip()
                fail_run(swarm_run_id, details[:3000], "load_modal")
                raise HTTPException(status_code=500, detail=details[:3000]) from exc

        add_chat_message(
            swarm_run_id,
            "agent",
            f"Upload complete. Dataset extracted to /vol{remote_base}",
            "load_modal",
        )
        add_chat_message(
            swarm_run_id,
            "agent",
            "Starting orchestration pipeline on Modal...",
            "load_modal",
        )

        run_cfg = RunConfig(
            dataset_base_path=f"/vol{remote_base}",
            task_description=task_description,
            max_approaches=SETTINGS.max_approaches,
            max_tuning_iterations=SETTINGS.max_tuning_iterations,
            max_parallel_agents=SETTINGS.max_parallel_agents,
            max_train_fix_attempts=SETTINGS.max_train_fix_attempts,
            primary_metric=SETTINGS.default_primary_metric,
            maximize_metric=True,
            run_budget_usd=SETTINGS.max_run_budget_usd,
        )
        try:
            await _spawn_orchestrator_run(
                run_cfg=run_cfg,
                swarm_run_id=swarm_run_id,
                modal_env=modal_env,
            )
        except Exception as exc:  # noqa: BLE001
            details = str(exc).strip()
            fail_run(swarm_run_id, details[:3000], "load_modal")
            raise HTTPException(status_code=500, detail=details[:3000]) from exc

        return StartRunResponse(ok=True, swarmRunId=swarm_run_id)

    return app


app = create_app()


def main() -> None:
    import uvicorn

    host = os.getenv("DASHBOARD_LAUNCHER_HOST", "127.0.0.1")
    port = int(os.getenv("DASHBOARD_LAUNCHER_PORT", "8001"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
