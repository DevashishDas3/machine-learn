from __future__ import annotations

import asyncio
import json
import math
from typing import Any, Dict, List, Optional, Tuple

from agents import (
    PlanAgent,
    ReportAgent,
    TuningAgent,
    get_llm_server_handle,
    run_implementation,
)
from agents.impl_agent import FALLBACK_TRAIN_CODE, ImplementationAgent
from config import SETTINGS
from modal_app import app, base_image, data_volume, supabase_secret
from schemas import (
    Approach,
    ApproachRun,
    CostEstimate,
    RunConfig,
    RunSummary,
    TrainingResult,
    TuningIteration,
)
from supabase_helpers import (
    update_flowchart_stage,
    add_chat_message,
    complete_run,
    fail_run,
)
from utils.logging_utils import configure_logging, get_logger, make_run_id
from utils.run_events import RunEventLogger
from utils.volume_utils import ensure_run_dirs, write_json


logger = get_logger(__name__)


def _snip(text: str, max_len: int = 160) -> str:
    t = (text or "").replace("\n", " ").strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def print_human_run_summary(summary: RunSummary) -> None:
    """Plain-text follow-up so JSON is not the only place paths and errors appear."""
    vol = SETTINGS.modal_volume_name
    rid = summary.run_id
    base = f"/vol/runs/{rid}"
    print()
    print("=" * 72)
    print("RUN SUMMARY (paths and status)")
    print("=" * 72)
    print(f"run_id: {rid}")
    print(f"Volume: {vol}  →  {base}/")
    if summary.report_path:
        print(f"Report:           {summary.report_path}")
    if summary.artifact_manifest_path:
        print(f"Artifact manifest:{summary.artifact_manifest_path}")
    print()
    print("Copy artifacts locally (examples):")
    print(f"  modal volume get {vol} {base}/reports/report.md ./report.md")
    print(
        f"  modal volume get {vol} {base}/summaries/run_summary.json ./run_summary.json"
    )
    print(f"  modal volume get {vol} {base}/src ./run_src")
    print()
    n_ok = sum(1 for ar in summary.approach_runs if not ar.best_result.error)
    print(
        f"Training: {n_ok}/{len(summary.approach_runs)} approaches finished without error "
        f"(see source_code_path per approach below)."
    )
    for ar in summary.approach_runs:
        tr = ar.best_result
        tag = "ok" if not tr.error else "error"
        print(f"  [{tag}] {ar.approach.name} ({ar.approach.framework})")
        if tr.source_code_path:
            print(f"        train.py: {tr.source_code_path}")
        if tr.logs_path:
            print(f"        log:      {tr.logs_path}")
        if tr.error:
            print(f"        {_snip(tr.error)}")
        elif tr.metrics:
            print(f"        metrics:  {tr.metrics}")
    print()
    print("Recommendation:", summary.recommendation)
    print("=" * 72)


def _metric_score(result: TrainingResult, metric: str, maximize: bool) -> float:
    if result.error:
        return -math.inf if maximize else math.inf
    value = result.metrics.get(metric, None)
    if value is None:
        return -math.inf if maximize else math.inf
    return value


def _pick_best_result(
    results: List[TrainingResult], metric: str, maximize: bool
) -> TrainingResult:
    if maximize:
        return max(results, key=lambda r: _metric_score(r, metric, maximize=True))
    return min(results, key=lambda r: _metric_score(r, metric, maximize=False))


def _build_error_result(approach_name: str, error: str) -> TrainingResult:
    return TrainingResult(
        approach_name=approach_name,
        metrics={},
        model_checkpoint_path="",
        logs_path="",
        source_code_path="",
        error=error,
        logs_excerpt=None,
    )


@app.function(
    image=base_image,
    volumes={"/vol": data_volume},
    secrets=[supabase_secret],
    timeout=120,
    retries=2,
    max_containers=1,
)
def write_final_artifacts(
    run_id: str, report_md: str, run_summary: Dict[str, Any]
) -> Dict[str, str]:
    data_volume.reload()
    dirs = ensure_run_dirs(run_id)
    report_path = dirs["reports"] / "report.md"
    summary_path = dirs["summaries"] / "run_summary.json"
    manifest_path = dirs["summaries"] / "artifact_manifest.json"

    report_path.write_text(report_md, encoding="utf-8")
    write_json(summary_path, run_summary)

    manifest = {
        "report_path": str(report_path),
        "run_summary_path": str(summary_path),
        "src_root": str(dirs["src"]),
        "checkpoints_root": str(dirs["checkpoints"]),
        "logs_root": str(dirs["logs"]),
    }
    write_json(manifest_path, manifest)
    data_volume.commit()

    return {
        "report_path": str(report_path),
        "run_summary_path": str(summary_path),
        "artifact_manifest_path": str(manifest_path),
    }


async def _run_pipeline(run_cfg: RunConfig, swarm_run_id: Optional[str] = None) -> RunSummary:
    """
    Main pipeline orchestrator.
    
    Args:
        run_cfg: Pipeline configuration
        swarm_run_id: Optional Supabase swarm_runs.id for dashboard updates
    """
    run_id = make_run_id()
    ev = RunEventLogger(run_id)
    ev.emit(
        "pipeline_started",
        dataset_path=run_cfg.dataset_path,
        labels_path=run_cfg.labels_path,
        task_description=run_cfg.task_description[:4000],
        max_approaches=run_cfg.max_approaches,
        max_tuning_iterations=run_cfg.max_tuning_iterations,
        max_train_fix_attempts=run_cfg.max_train_fix_attempts,
        dashboard_hint="streamlit run dashboard.py",
        local_events_dir=str(ev.dir),
    )
    
    # Helper to update dashboard (no-op if swarm_run_id not provided)
    def dash_stage(stage: str, status: str, details: str = None, metrics: dict = None):
        if swarm_run_id:
            try:
                update_flowchart_stage(swarm_run_id, stage, status, details, metrics)
            except Exception as e:
                logger.warning(f"Dashboard update failed: {e}")
    
    def dash_msg(role: str, content: str, stage: str = None):
        if swarm_run_id:
            try:
                add_chat_message(swarm_run_id, role, content, stage)
            except Exception as e:
                logger.warning(f"Dashboard message failed: {e}")
    
    # Start: Prepare Dataset
    dash_stage("prepare_dataset", "active")
    dash_msg("system", f"Pipeline started: {run_cfg.task_description[:200]}...", "prepare_dataset")
    dash_msg("agent", f"Dataset path: {run_cfg.dataset_path}", "prepare_dataset")
    dash_stage("prepare_dataset", "complete")
    
    # Load to Modal
    dash_stage("load_modal", "active")
    dash_msg("agent", "Loading data to Modal volume...", "load_modal")
    
    llm = get_llm_server_handle()
    dash_stage("load_modal", "complete")
    dash_msg("agent", "LLM server ready", "load_modal")
    plan_agent = PlanAgent(llm)
    impl_agent = ImplementationAgent(llm)
    tuning_agent = TuningAgent(llm)
    report_agent = ReportAgent(llm)

    # PlanAgent phase
    dash_stage("plan_agent", "active")
    dash_msg("agent", "Analyzing task and generating approach plan...", "plan_agent")
    
    logger.info("running_plan_phase", extra={"extra_fields": {"run_id": run_id}})
    approaches = await plan_agent.run(run_cfg)
    cost_estimate = CostEstimate.model_validate(
        plan_agent.estimate_cost(run_cfg, len(approaches))
    )
    ev.emit(
        "plan_complete",
        approaches=[a.model_dump() for a in approaches],
        cost_estimate=cost_estimate.model_dump(),
    )
    
    approach_names = [a.name for a in approaches]
    dash_msg("agent", f"Generated {len(approaches)} approaches: {', '.join(approach_names)}", "plan_agent")
    dash_msg("agent", f"Estimated cost: ${cost_estimate.estimated_cost_usd:.2f}", "plan_agent")
    dash_stage("plan_agent", "complete")

    if cost_estimate.estimated_cost_usd > run_cfg.run_budget_usd:
        dash_msg("system", f"❌ Budget exceeded! ${cost_estimate.estimated_cost_usd:.2f} > ${run_cfg.run_budget_usd:.2f}", "plan_agent")
        if swarm_run_id:
            fail_run(swarm_run_id, f"Budget exceeded", "plan_agent")
        raise ValueError(
            f"Estimated run cost ${cost_estimate.estimated_cost_usd:.2f} exceeds budget ${run_cfg.run_budget_usd:.2f}"
        )
    ev.emit("budget_ok", run_budget_usd=run_cfg.run_budget_usd)

    # --- Phase 2a: Generate all code in parallel (no GPU slot needed) ---
    # ImplementationAgent phase (codegen + training)
    dash_stage("implement_agent", "active")
    dash_msg("agent", "Starting code generation for all approaches...", "implement_agent")
    
    logger.info("running_codegen_phase", extra={"extra_fields": {"run_id": run_id}})
    ev.emit("codegen_phase_started", num_approaches=len(approaches))

    async def _gen_code(approach: Approach) -> tuple[str, str]:
        ev.emit(
            "code_generation_started",
            approach=approach.name,
            framework=approach.framework,
        )
        dash_msg("agent", f"Generating code for {approach.name} ({approach.framework})...", "implement_agent")
        try:
            code = await impl_agent.generate_code(
                approach=approach,
                dataset_path=run_cfg.dataset_path,
                task_description=run_cfg.task_description,
                labels_path=run_cfg.labels_path,
            )
        except Exception:  # noqa: BLE001
            code = FALLBACK_TRAIN_CODE
        ev.emit(
            "code_generated",
            approach=approach.name,
            framework=approach.framework,
            code_preview=code[:20_000],
        )
        return approach.name, code

    gen_pairs = await asyncio.gather(*[_gen_code(a) for a in approaches])
    generated_code_by_name: Dict[str, str] = {name: code for name, code in gen_pairs}
    dash_msg("agent", f"Code generation complete for {len(gen_pairs)} approaches", "implement_agent")

    # --- Phase 2b: Run all training in parallel (semaphore limits GPU containers) ---
    dash_msg("agent", "Starting training on A100 cluster...", "implement_agent")
    semaphore = asyncio.Semaphore(run_cfg.max_parallel_agents)

    async def _run_approach(
        approach: Approach,
        hp_override: Dict[str, Any] | None = None,
        iteration: int | None = None,
    ) -> TrainingResult:
        async with semaphore:
            phase = "initial" if hp_override is None else "tuning"
            code = generated_code_by_name.get(approach.name, FALLBACK_TRAIN_CODE)
            max_fix = max(1, run_cfg.max_train_fix_attempts)
            last_result: TrainingResult | None = None

            for fix_i in range(max_fix):
                if fix_i == 0:
                    ev.emit(
                        "training_started",
                        approach=approach.name,
                        phase=phase,
                        iteration=iteration,
                        hyperparameters=hp_override,
                    )
                else:
                    ev.emit(
                        "training_fix_retry",
                        approach=approach.name,
                        phase=phase,
                        iteration=iteration,
                        fix_attempt=fix_i + 1,
                        max_attempts=max_fix,
                        previous_error=_snip(last_result.error or "")
                        if last_result
                        else "",
                    )

                try:
                    result_payload = await run_implementation.remote.aio(
                        run_id=run_id,
                        approach=approach.model_dump(),
                        dataset_path=run_cfg.dataset_path,
                        task_description=run_cfg.task_description,
                        generated_code=code,
                        hyperparameters=hp_override,
                        labels_path=run_cfg.labels_path,
                    )
                    last_result = TrainingResult.model_validate(result_payload)
                except Exception as exc:  # noqa: BLE001
                    last_result = _build_error_result(approach.name, str(exc))

                ev.emit(
                    "train_result",
                    approach=approach.name,
                    phase=phase,
                    hyperparameters=hp_override,
                    metrics=last_result.metrics,
                    error=(last_result.error[:3000] if last_result.error else None),
                    source_code_path=last_result.source_code_path or None,
                    logs_path=last_result.logs_path or None,
                    fix_attempt=fix_i + 1,
                    max_fix_attempts=max_fix,
                )

                if not last_result.error:
                    generated_code_by_name[approach.name] = code
                    return last_result

                if fix_i >= max_fix - 1:
                    generated_code_by_name[approach.name] = code
                    return last_result

                try:
                    code = await impl_agent.fix_code_after_failure(
                        approach=approach,
                        dataset_path=run_cfg.dataset_path,
                        task_description=run_cfg.task_description,
                        failed_code=code,
                        runtime_error=last_result.error or "",
                        hyperparameters=hp_override,
                        labels_path=run_cfg.labels_path,
                        logs_excerpt=last_result.logs_excerpt,
                    )
                    generated_code_by_name[approach.name] = code
                except Exception as exc:  # noqa: BLE001
                    ev.emit("train_fix_failed", approach=approach.name, error=str(exc))
                    return last_result

            return (
                last_result
                if last_result
                else _build_error_result(approach.name, "training failed")
            )

    logger.info(
        "running_implementation_phase", extra={"extra_fields": {"run_id": run_id}}
    )
    ev.emit("implementation_phase_started", num_approaches=len(approaches))
    initial_results = await asyncio.gather(
        *[_run_approach(a) for a in approaches], return_exceptions=True
    )

    initial_results_by_name: Dict[str, TrainingResult] = {}
    for approach, raw in zip(approaches, initial_results):
        if isinstance(raw, Exception):
            initial_results_by_name[approach.name] = _build_error_result(
                approach.name, str(raw)
            )
        else:
            initial_results_by_name[approach.name] = raw

    # Report initial training results
    n_ok = sum(1 for r in initial_results_by_name.values() if not r.error)
    dash_msg("agent", f"Initial training complete: {n_ok}/{len(approaches)} successful", "implement_agent")
    dash_stage("implement_agent", "complete", metrics={"successful_runs": n_ok})

    # TuningAgent phase
    dash_stage("tune_agent", "active")
    dash_msg("agent", "Starting hyperparameter tuning...", "tune_agent")
    
    logger.info("running_tuning_phase", extra={"extra_fields": {"run_id": run_id}})
    ev.emit("tuning_phase_started")

    async def tune_single(
        approach: Approach, current: TrainingResult
    ) -> Tuple[List[TuningIteration], TrainingResult]:
        iterations: List[TuningIteration] = []
        all_results = [current]
        latest = current
        for iteration in range(1, run_cfg.max_tuning_iterations + 1):
            try:
                new_hp = await tuning_agent.suggest_hyperparameters(
                    approach=approach,
                    current_result=latest,
                    objective_metric=run_cfg.primary_metric,
                )
                ev.emit(
                    "tuning_suggestion",
                    approach=approach.name,
                    iteration=iteration,
                    hyperparameters=new_hp,
                )
                tuned_result = await _run_approach(
                    approach, hp_override=new_hp, iteration=iteration
                )
                latest = tuned_result
                all_results.append(tuned_result)
                iterations.append(
                    TuningIteration(
                        iteration=iteration,
                        hyperparameters=new_hp,
                        result=tuned_result,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                err = _build_error_result(approach.name, str(exc))
                latest = err
                all_results.append(err)
                iterations.append(
                    TuningIteration(
                        iteration=iteration,
                        hyperparameters=dict(approach.hyperparameters),
                        result=err,
                    )
                )

        best = _pick_best_result(
            all_results, run_cfg.primary_metric, run_cfg.maximize_metric
        )
        return iterations, best

    tuning_tasks = [tune_single(a, initial_results_by_name[a.name]) for a in approaches]
    tuning_outputs = await asyncio.gather(*tuning_tasks, return_exceptions=True)

    approach_runs: List[ApproachRun] = []
    for approach, tuned in zip(approaches, tuning_outputs):
        initial_result = initial_results_by_name[approach.name]
        if isinstance(tuned, Exception):
            fallback_best = initial_result
            approach_runs.append(
                ApproachRun(
                    approach=approach,
                    initial_result=initial_result,
                    tuning_iterations=[],
                    best_result=fallback_best,
                )
            )
            continue

        iterations, best = tuned
        approach_runs.append(
            ApproachRun(
                approach=approach,
                initial_result=initial_result,
                tuning_iterations=iterations,
                best_result=best,
            )
        )

    # Report tuning completion
    total_iterations = sum(len(ar.tuning_iterations) for ar in approach_runs)
    dash_msg("agent", f"Tuning complete: {total_iterations} total iterations across all approaches", "tune_agent")
    dash_stage("tune_agent", "complete")

    best_overall = _pick_best_result(
        [ar.best_result for ar in approach_runs],
        run_cfg.primary_metric,
        run_cfg.maximize_metric,
    )
    recommendation = (
        f"Recommended approach: {best_overall.approach_name} "
        f"based on best `{run_cfg.primary_metric}` = {best_overall.metrics.get(run_cfg.primary_metric, 'n/a')}."
    )

    # ReportAgent phase
    dash_stage("report_agent", "active")
    dash_msg("agent", "Generating final report...", "report_agent")
    
    logger.info("running_report_phase", extra={"extra_fields": {"run_id": run_id}})
    ev.emit("report_phase_started")
    report_md = await report_agent.build_report(
        run_id, run_cfg, approach_runs, recommendation
    )
    ev.emit("report_complete", report_preview=report_md[:30_000])
    
    dash_msg("agent", f"Report generated. Recommendation: {best_overall.approach_name}", "report_agent")
    dash_stage("report_agent", "complete")

    summary = RunSummary(
        run_id=run_id,
        config=run_cfg,
        cost_estimate=cost_estimate,
        approaches=approaches,
        approach_runs=approach_runs,
        recommendation=recommendation,
    )

    artifact_paths = await write_final_artifacts.remote.aio(
        run_id=run_id,
        report_md=report_md,
        run_summary=json.loads(summary.model_dump_json()),
    )

    summary.report_path = artifact_paths["report_path"]
    summary.artifact_manifest_path = artifact_paths["artifact_manifest_path"]
    ev.emit(
        "pipeline_complete",
        report_path=summary.report_path,
        artifact_manifest_path=summary.artifact_manifest_path,
        recommendation=summary.recommendation,
    )
    ev.write_state(
        {
            "run_id": run_id,
            "report_path": summary.report_path,
            "artifact_manifest_path": summary.artifact_manifest_path,
            "recommendation": summary.recommendation,
            "summary_json": json.loads(summary.model_dump_json()),
        }
    )
    
    # Update Supabase dashboard with final results
    if swarm_run_id:
        try:
            best_metric = best_overall.metrics.get(run_cfg.primary_metric)
            loss_metric = best_overall.metrics.get("loss") or best_overall.metrics.get("train_loss")
            complete_run(
                swarm_run_id,
                accuracy=best_metric if run_cfg.primary_metric in ("accuracy", "val_accuracy") else None,
                loss=loss_metric,
                total_time_gpu=None,  # Could track if needed
                best_hyperparameters=dict(best_overall.metrics) if best_overall.metrics else None,
                recommendation=recommendation,
                report=report_md,
            )
            dash_msg("system", "✅ Pipeline completed successfully!", "complete")
        except Exception as e:
            logger.warning(f"Failed to update Supabase completion: {e}")
    
    return summary


@app.local_entrypoint()
def main(
    dataset_path: str,
    task_description: str,
    labels_path: str | None = None,
    max_approaches: int = SETTINGS.max_approaches,
    max_tuning_iterations: int = SETTINGS.max_tuning_iterations,
    max_parallel_agents: int = SETTINGS.max_parallel_agents,
    max_train_fix_attempts: int = SETTINGS.max_train_fix_attempts,
    primary_metric: str = SETTINGS.default_primary_metric,
    maximize_metric: bool = True,
    run_budget_usd: float = SETTINGS.max_run_budget_usd,
    swarm_run_id: str | None = None,  # Supabase run ID for dashboard updates
) -> None:
    configure_logging()
    run_cfg = RunConfig(
        dataset_path=dataset_path,
        task_description=task_description,
        labels_path=labels_path,
        max_approaches=max_approaches,
        max_tuning_iterations=max_tuning_iterations,
        max_parallel_agents=max_parallel_agents,
        max_train_fix_attempts=max_train_fix_attempts,
        primary_metric=primary_metric,
        maximize_metric=maximize_metric,
        run_budget_usd=run_budget_usd,
    )
    summary = asyncio.run(_run_pipeline(run_cfg, swarm_run_id=swarm_run_id))
    print(summary.model_dump_json(indent=2))
    print_human_run_summary(summary)
    print()
    print(f"Live dashboard (local): streamlit run dashboard.py")
    print(f"Event log for this run: runs_local/{summary.run_id}/events.jsonl")
