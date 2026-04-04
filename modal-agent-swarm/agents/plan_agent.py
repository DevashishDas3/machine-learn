from __future__ import annotations

import json
from typing import List

from config import SETTINGS
from schemas import Approach, PlanResponse, RunConfig
from utils.costing import estimate_run_cost
from utils.parsing import parse_model_output
from utils.prompting import read_prompt


class PlanAgent:
    def __init__(self, llm_server) -> None:
        self.llm_server = llm_server
        self.system_prompt = read_prompt("plan_agent.txt")

    async def run(self, run_cfg: RunConfig) -> List[Approach]:
        schema = PlanResponse.model_json_schema()
        prompt = (
            f"{self.system_prompt}\n\n"
            f"Task:\n{run_cfg.task_description}\n\n"
            f"Dataset path:\n{run_cfg.dataset_path}\n\n"
            f"Constraints:\n"
            f"- max_approaches={run_cfg.max_approaches}\n"
            f"- primary_metric={run_cfg.primary_metric}\n"
            f"- maximize_metric={run_cfg.maximize_metric}\n"
        )
        raw = await self.llm_server.generate.remote.aio(
            prompt=prompt,
            schema=schema,
            max_tokens=1400,
            temperature=0.2,
        )
        parsed = parse_model_output(raw, PlanResponse)
        approaches = parsed.approaches[: run_cfg.max_approaches]
        if not approaches:
            raise ValueError("PlanAgent returned no approaches.")
        return approaches

    def estimate_cost(self, run_cfg: RunConfig, num_approaches: int) -> dict:
        est = estimate_run_cost(
            run_cfg=run_cfg,
            num_approaches=num_approaches,
            impl_minutes=max(1, SETTINGS.train_timeout_seconds // 60),
            tuning_minutes=max(1, SETTINGS.tuning_timeout_seconds // 60),
            tuning_rounds=run_cfg.max_tuning_iterations,
        )
        return json.loads(est.model_dump_json())
