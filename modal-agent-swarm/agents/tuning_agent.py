from __future__ import annotations

import json
from typing import Any, Dict

from pydantic import BaseModel, Field

from schemas import Approach, TrainingResult
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
    ) -> Dict[str, Any]:
        schema = TuningSuggestion.model_json_schema()
        prompt = (
            f"{self.prompt_template}\n\n"
            f"Approach:\n{approach.model_dump_json(indent=2)}\n\n"
            f"Current metrics:\n{json.dumps(current_result.metrics, indent=2)}\n\n"
            f"Current error:\n{current_result.error or 'none'}\n\n"
            f"Objective metric:\n{objective_metric}\n"
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
