from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


def _normalize_framework(value: str) -> str:
    normalized = value.strip().lower()
    aliases = {
        "sklearn": "sklearn",
        "scikit-learn": "sklearn",
        "pytorch": "pytorch",
        "torch": "pytorch",
    }
    return aliases.get(normalized, normalized)


class Approach(BaseModel):
    name: str = Field(min_length=3)
    framework: Literal["pytorch", "sklearn"]
    rationale: str = Field(min_length=10)
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    modal_gpu: str = Field(default="A10G")

    @field_validator("framework", mode="before")
    @classmethod
    def normalize_framework(cls, value: str) -> str:
        return _normalize_framework(value)


class TrainingResult(BaseModel):
    approach_name: str
    metrics: Dict[str, float] = Field(default_factory=dict)
    model_checkpoint_path: str = ""
    logs_path: str = ""
    source_code_path: str = ""
    error: Optional[str] = None
    logs_excerpt: Optional[str] = None

    @field_validator("metrics", mode="before")
    @classmethod
    def normalize_metric_values(cls, value: Dict[str, Any]) -> Dict[str, float]:
        normalized: Dict[str, float] = {}
        for k, v in (value or {}).items():
            try:
                normalized[str(k).strip().lower()] = float(v)
            except (TypeError, ValueError):
                continue
        return normalized


class TuningIteration(BaseModel):
    iteration: int
    hyperparameters: Dict[str, Any]
    result: TrainingResult


class CostEstimate(BaseModel):
    estimated_gpu_hours: float
    estimated_cost_usd: float
    assumptions: Dict[str, Any] = Field(default_factory=dict)


class RunConfig(BaseModel):
    dataset_path: str
    task_description: str
    labels_path: Optional[str] = None
    max_approaches: int = 5
    max_tuning_iterations: int = 3
    max_parallel_agents: int = 4
    max_train_fix_attempts: int = 3
    primary_metric: str = "accuracy"
    maximize_metric: bool = True
    run_budget_usd: float = 25.0

    @field_validator("primary_metric")
    @classmethod
    def normalize_primary_metric(cls, value: str) -> str:
        return value.strip().lower()


class ApproachRun(BaseModel):
    approach: Approach
    initial_result: TrainingResult
    tuning_iterations: List[TuningIteration] = Field(default_factory=list)
    best_result: TrainingResult

    @model_validator(mode="after")
    def validate_best_result_name(self) -> "ApproachRun":
        if self.best_result.approach_name != self.approach.name:
            self.best_result.approach_name = self.approach.name
        return self


class RunSummary(BaseModel):
    run_id: str
    created_at_utc: str = Field(default_factory=lambda: datetime.now(tz=UTC).isoformat())
    config: RunConfig
    cost_estimate: CostEstimate
    approaches: List[Approach]
    approach_runs: List[ApproachRun]
    recommendation: str = ""
    report_path: str = ""
    artifact_manifest_path: str = ""


class PlanResponse(BaseModel):
    approaches: List[Approach]
