from __future__ import annotations

import json
from typing import Any, Dict, List

from schemas import ApproachRun, RunConfig
from utils.prompting import read_prompt

_ERR_SNIP = 500


def _truncate(s: str | None, max_len: int = _ERR_SNIP) -> str:
    if not s:
        return ""
    s = s.strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3] + "..."


def _compact_runs(approach_runs: List[ApproachRun]) -> List[Dict[str, Any]]:
    """Keep report LLM prompts small — full JSON blows past max_model_len (e.g. 2048)."""
    out: List[Dict[str, Any]] = []
    for r in approach_runs:
        out.append(
            {
                "approach": r.approach.name,
                "framework": r.approach.framework,
                "initial_metrics": r.initial_result.metrics,
                "best_metrics": r.best_result.metrics,
                "initial_error": _truncate(r.initial_result.error),
                "best_error": _truncate(r.best_result.error),
                "source_code_path": r.best_result.source_code_path,
                "logs_path": r.best_result.logs_path,
                "tuning_rounds": len(r.tuning_iterations),
            }
        )
    return out


class ReportAgent:
    def __init__(self, llm_server) -> None:
        self.llm_server = llm_server
        self.prompt_template = read_prompt("report_agent.txt")

    async def build_report(
        self,
        run_id: str,
        run_cfg: RunConfig,
        approach_runs: List[ApproachRun],
        recommendation: str,
    ) -> str:
        payload = {
            "run_id": run_id,
            "task_description": _truncate(run_cfg.task_description, 2000),
            "dataset_base_path": run_cfg.dataset_base_path,
            "primary_metric": run_cfg.primary_metric,
            "approach_runs": _compact_runs(approach_runs),
            "recommendation": recommendation,
        }
        prompt = f"{self.prompt_template}\n\n{json.dumps(payload, indent=2)}"
        try:
            report = await self.llm_server.generate.remote.aio(
                prompt=prompt,
                temperature=0.15,
                max_tokens=1800,
            )
            if report.strip():
                return report
        except Exception:  # noqa: BLE001
            pass

        # Fallback markdown report if LLM call fails.
        lines = [
            f"# ML Agent Swarm Report ({run_id})",
            "",
            "## Problem",
            run_cfg.task_description,
            "",
            f"Dataset base path: `{run_cfg.dataset_base_path}`",
            "",
            "## Approaches",
        ]
        for run in approach_runs:
            lines.append(f"- **{run.approach.name}** ({run.approach.framework})")
            lines.append(f"  - Initial metrics: `{run.initial_result.metrics}`")
            lines.append(f"  - Best metrics: `{run.best_result.metrics}`")
            if run.best_result.error:
                lines.append(f"  - Error: `{run.best_result.error}`")
        lines.extend(["", "## Recommendation", recommendation])
        return "\n".join(lines)
