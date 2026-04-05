from __future__ import annotations

import asyncio
import json
from typing import Any, Callable, Dict, List

from pydantic import BaseModel, Field

from config import SETTINGS
from schemas import Approach, DatasetMetadata, PlanResponse, RunConfig
from utils.logging_utils import get_logger
from utils.research import find_related_research
from utils.costing import estimate_run_cost
from utils.parsing import parse_model_output
from utils.prompting import read_prompt


class ResearchIntentResponse(BaseModel):
    query: str = Field(min_length=3)
    continue_research: bool = False
    rationale: str = Field(default="", max_length=500)


EmitHook = Callable[[str, Dict[str, Any]], None]
logger = get_logger(__name__)


def _snip(value: str, max_len: int = 180) -> str:
    text = " ".join((value or "").split())
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


class PlanAgent:
    def __init__(self, llm_server) -> None:
        self.llm_server = llm_server
        self.system_prompt = read_prompt("plan_agent.txt")

    async def _request_research_intent(
        self,
        run_cfg: RunConfig,
        dataset_metadata: DatasetMetadata,
        findings_so_far: List[Dict[str, Any]],
        round_number: int,
    ) -> ResearchIntentResponse:
        schema = ResearchIntentResponse.model_json_schema()
        findings_json = json.dumps(findings_so_far, ensure_ascii=False)[:20_000]
        prompt = (
            "You are selecting research queries for ML approach planning. "
            "Return JSON only.\n\n"
            f"Task:\n{run_cfg.task_description}\n\n"
            f"Dataset base path:\n{run_cfg.dataset_base_path}\n\n"
            "Dataset metadata:\n"
            f"{dataset_metadata.model_dump_json(indent=2)[:12000]}\n\n"
            f"Round: {round_number}/2\n"
            "Decide one focused search query and whether another research round is needed. "
            "Set continue_research=false if the current evidence is already enough to choose viable approaches.\n\n"
            "Current findings:\n"
            f"{findings_json if findings_so_far else '[]'}\n"
        )
        raw = await self.llm_server.generate.remote.aio(
            prompt=prompt,
            schema=schema,
            max_tokens=500,
            temperature=0.15,
        )
        return parse_model_output(raw, ResearchIntentResponse)

    def _build_final_prompt(
        self,
        run_cfg: RunConfig,
        dataset_metadata: DatasetMetadata,
        research_findings: List[Dict[str, Any]],
    ) -> str:
        findings_json = json.dumps(research_findings, ensure_ascii=False)[:30_000]
        return (
            f"{self.system_prompt}\n\n"
            "Use the research findings to improve viability decisions. "
            "Prioritize approaches that are realistic for this dataset and run constraints.\n\n"
            f"Task:\n{run_cfg.task_description}\n\n"
            f"Dataset base path:\n{run_cfg.dataset_base_path}\n\n"
            "Dataset metadata (JSON):\n"
            f"{dataset_metadata.model_dump_json(indent=2)[:20000]}\n\n"
            f"Constraints:\n"
            f"- max_approaches={run_cfg.max_approaches}\n"
            f"- primary_metric={run_cfg.primary_metric}\n"
            f"- maximize_metric={run_cfg.maximize_metric}\n\n"
            "Research findings (JSON):\n"
            f"{findings_json if research_findings else '[]'}\n"
        )

    @staticmethod
    def _emit(emit_hook: EmitHook | None, event: str, **data: Any) -> None:
        if not emit_hook:
            return
        try:
            emit_hook(event, data)
        except Exception:
            return

    @staticmethod
    def _build_research_digest(
        research_findings: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        unique_sources = sorted(
            {
                str(source)
                for finding in research_findings
                for source in (finding.get("sources") or [])
                if source
            }
        )
        return {
            "rounds_completed": len(research_findings),
            "total_papers": sum(
                int(f.get("paper_count", 0)) for f in research_findings
            ),
            "queries": [str(f.get("query", "")) for f in research_findings],
            "sources": unique_sources,
        }

    async def run(
        self,
        run_cfg: RunConfig,
        dataset_metadata: DatasetMetadata,
        emit_hook: EmitHook | None = None,
    ) -> tuple[List[Approach], Dict[str, Any]]:
        research_findings: List[Dict[str, Any]] = []
        max_research_rounds = 2

        logger.info(
            "plan_research_started",
            extra={
                "extra_fields": {
                    "max_rounds": max_research_rounds,
                    "dataset_base_path": run_cfg.dataset_base_path,
                    "task_preview": _snip(run_cfg.task_description, 220),
                }
            },
        )

        self._emit(emit_hook, "plan_research_started", max_rounds=max_research_rounds)
        for round_number in range(1, max_research_rounds + 1):
            try:
                intent = await self._request_research_intent(
                    run_cfg=run_cfg,
                    dataset_metadata=dataset_metadata,
                    findings_so_far=research_findings,
                    round_number=round_number,
                )
                logger.info(
                    "plan_research_intent",
                    extra={
                        "extra_fields": {
                            "round": round_number,
                            "query": _snip(intent.query),
                            "continue_research": intent.continue_research,
                            "rationale": _snip(intent.rationale),
                        }
                    },
                )
                result = await asyncio.to_thread(
                    find_related_research,
                    task_description=run_cfg.task_description,
                    dataset_path=run_cfg.dataset_base_path,
                    query_hint=intent.query,
                )
                papers = result.get("papers", [])
                compact_top = [
                    {
                        "title": p.get("title", ""),
                        "year": p.get("year"),
                        "source": p.get("source", ""),
                        "url": p.get("url", ""),
                    }
                    for p in papers[:5]
                ]
                finding = {
                    "round": round_number,
                    "query": intent.query,
                    "rationale": intent.rationale,
                    "continue_research": intent.continue_research,
                    "paper_count": result.get("paper_count", 0),
                    "sources": result.get("sources", []),
                    "errors": result.get("errors", []),
                    "papers": compact_top,
                }
                research_findings.append(finding)
                logger.info(
                    "plan_research_result",
                    extra={
                        "extra_fields": {
                            "round": round_number,
                            "query": _snip(intent.query),
                            "paper_count": finding["paper_count"],
                            "sources": finding["sources"],
                            "errors": finding["errors"],
                        }
                    },
                )
                self._emit(
                    emit_hook,
                    "plan_research_result",
                    round=round_number,
                    query=intent.query,
                    paper_count=finding["paper_count"],
                    sources=finding["sources"],
                    errors=finding["errors"],
                )
                if not intent.continue_research:
                    logger.info(
                        "plan_research_stopped",
                        extra={
                            "extra_fields": {
                                "round": round_number,
                                "reason": "intent_continue_false",
                            }
                        },
                    )
                    break
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "plan_research_fallback",
                    extra={
                        "extra_fields": {
                            "round": round_number,
                            "error": _snip(str(exc), 350),
                        }
                    },
                )
                self._emit(
                    emit_hook,
                    "plan_research_fallback",
                    round=round_number,
                    error=str(exc),
                )
                break

        research_digest = self._build_research_digest(research_findings)
        self._emit(emit_hook, "plan_research_complete", **research_digest)
        logger.info(
            "plan_research_complete",
            extra={
                "extra_fields": {
                    "rounds_completed": research_digest["rounds_completed"],
                    "total_papers": research_digest["total_papers"],
                }
            },
        )

        self._emit(emit_hook, "plan_research_digest", research_digest=research_digest)
        logger.info(
            "plan_research_digest",
            extra={"extra_fields": research_digest},
        )

        schema = PlanResponse.model_json_schema()
        prompt = self._build_final_prompt(run_cfg, dataset_metadata, research_findings)
        raw = await self.llm_server.generate.remote.aio(
            prompt=prompt,
            schema=schema,
            max_tokens=1400,
            temperature=0.2,
        )
        parsed = parse_model_output(raw, PlanResponse)
        approaches = parsed.approaches[: run_cfg.max_approaches]
        logger.info(
            "plan_final_decision_ready",
            extra={
                "extra_fields": {
                    "approach_count": len(approaches),
                    "approach_names": [a.name for a in approaches],
                }
            },
        )
        if not approaches:
            raise ValueError("PlanAgent returned no approaches.")
        return approaches, research_digest

    def estimate_cost(self, run_cfg: RunConfig, num_approaches: int) -> dict:
        est = estimate_run_cost(
            run_cfg=run_cfg,
            num_approaches=num_approaches,
            impl_minutes=max(1, SETTINGS.train_timeout_seconds // 60),
            tuning_minutes=max(1, SETTINGS.tuning_timeout_seconds // 60),
            tuning_rounds=run_cfg.max_tuning_iterations,
        )
        return json.loads(est.model_dump_json())
