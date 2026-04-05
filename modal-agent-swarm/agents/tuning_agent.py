from __future__ import annotations

import json
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from schemas import Approach, TrainingResult, TuningHistoryRecord
from utils.parsing import parse_model_output
from utils.prompting import read_prompt


class TuningSuggestion(BaseModel):
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    reasoning: str = ""


class TuningAgent:
    def __init__(self, llm_server) -> None:
        self.llm_server = llm_server
        self.prompt_template = read_prompt("tuning_agent.txt")

    async def suggest_hyperparameters(
        self,
        approach: Approach,
        current_result: TrainingResult,
        objective_metric: str,
        in_run_history: List[TuningHistoryRecord] | None = None,
        cross_run_history: List[TuningHistoryRecord] | None = None,
    ) -> Dict[str, Any]:
        schema = TuningSuggestion.model_json_schema()
        in_run_history = in_run_history or []
        cross_run_history = cross_run_history or []

        def _to_prompt_rows(
            items: List[TuningHistoryRecord], cap: int
        ) -> List[Dict[str, Any]]:
            rows: List[Dict[str, Any]] = []
            for item in items[-cap:]:
                rows.append(
                    {
                        "run_id": item.run_id,
                        "iteration": item.iteration,
                        "primary_metric": item.primary_metric,
                        "primary_metric_value": item.primary_metric_value,
                        "hyperparameters": item.hyperparameters,
                        "metrics": item.metrics,
                        "error": item.error,
                    }
                )
            return rows

        prompt = (
            f"{self.prompt_template}\n\n"
            f"Approach:\n{approach.model_dump_json(indent=2)}\n\n"
            f"Current metrics:\n{json.dumps(current_result.metrics, indent=2)}\n\n"
            f"Current error:\n{current_result.error or 'none'}\n\n"
            f"Objective metric:\n{objective_metric}\n\n"
            f"In-run history (most recent first):\n"
            f"{json.dumps(list(reversed(_to_prompt_rows(in_run_history, cap=12))), indent=2)}\n\n"
            f"Cross-run history for this approach (most recent first):\n"
            f"{json.dumps(list(reversed(_to_prompt_rows(cross_run_history, cap=24))), indent=2)}\n"
        )
        raw = await self.llm_server.generate.remote.aio(
            prompt=prompt,
            schema=schema,
            max_tokens=900,
            temperature=0.2,
        )
        suggestion = parse_model_output(raw, TuningSuggestion)
        merged = dict(approach.hyperparameters)
        merged.update(suggestion.hyperparameters)
        return merged
