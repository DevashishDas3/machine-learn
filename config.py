from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv

_CONFIG_DIR = Path(__file__).resolve().parent
load_dotenv(_CONFIG_DIR / ".env")
load_dotenv()


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "y", "on")


@dataclass(frozen=True)
class Settings:
    modal_app_name: str = os.getenv("MODAL_APP_NAME", "ml-agent-swarm")
    modal_volume_name: str = os.getenv("MODAL_VOLUME_NAME", "ml-agent-swarm-data")
    modal_environment: str = os.getenv("MODAL_ENVIRONMENT", "main")

    llm_model_primary: str = os.getenv("LLM_MODEL_PRIMARY", "Qwen/Qwen2.5-32B-Instruct-AWQ")
    llm_gpu: str = os.getenv("LLM_GPU", "H100")
    impl_gpu: str = os.getenv("IMPL_GPU", "H100")

    plan_timeout_seconds: int = _env_int("PLAN_TIMEOUT_SECONDS", 600)
    train_timeout_seconds: int = _env_int("TRAIN_TIMEOUT_SECONDS", 120)
    tuning_timeout_seconds: int = _env_int("TUNING_TIMEOUT_SECONDS", 120)
    llm_startup_timeout_seconds: int = _env_int("LLM_STARTUP_TIMEOUT_SECONDS", 1800)
    llm_max_model_len: int = _env_int("LLM_MAX_MODEL_LEN", 8192)
    llm_gpu_memory_utilization: float = _env_float("LLM_GPU_MEMORY_UTILIZATION", 0.92)
    llm_enforce_eager: bool = _env_bool("LLM_ENFORCE_EAGER", True)
    llm_quantization: str = os.getenv("LLM_QUANTIZATION", "")

    max_approaches: int = _env_int("MAX_APPROACHES", 3)
    max_parallel_agents: int = _env_int("MAX_PARALLEL_AGENTS", 4)
    llm_concurrent_requests: int = _env_int("LLM_CONCURRENT_REQUESTS", 15)
    max_tuning_iterations: int = _env_int("MAX_TUNING_ITERATIONS", 1)
    max_run_budget_usd: float = _env_float("MAX_RUN_BUDGET_USD", 50.0)

    default_primary_metric: str = os.getenv("DEFAULT_PRIMARY_METRIC", "accuracy")
    experiment_tracking: str = os.getenv("EXPERIMENT_TRACKING", "none")

    gpu_hourly_cost_usd: Dict[str, float] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "gpu_hourly_cost_usd",
            {
                "T4": 0.59,
                "L4": 0.74,
                "A10": 1.10,
                "A10G": 1.10,
                "L40S": 1.86,
                "A100": 3.10,
                "A100-80GB": 3.70,
                "H100": 5.20,
            },
        )


SETTINGS = Settings()
