from __future__ import annotations

from config import SETTINGS
from schemas import CostEstimate, RunConfig


def estimate_run_cost(
    run_cfg: RunConfig,
    num_approaches: int,
    impl_minutes: int,
    tuning_minutes: int,
    tuning_rounds: int,
) -> CostEstimate:
    impl_rate = SETTINGS.gpu_hourly_cost_usd.get(SETTINGS.impl_gpu, 1.5)
    tuning_rate = SETTINGS.gpu_hourly_cost_usd.get(SETTINGS.tuning_gpu, 1.5)
    plan_rate = SETTINGS.gpu_hourly_cost_usd.get(SETTINGS.plan_gpu, 1.5)

    impl_hours = num_approaches * (impl_minutes / 60.0)
    tuning_hours = num_approaches * tuning_rounds * (tuning_minutes / 60.0)
    plan_hours = SETTINGS.plan_timeout_seconds / 3600.0

    total_cost = (impl_hours * impl_rate) + (tuning_hours * tuning_rate) + (plan_hours * plan_rate)
    return CostEstimate(
        estimated_gpu_hours=impl_hours + tuning_hours + plan_hours,
        estimated_cost_usd=round(total_cost, 2),
        assumptions={
            "num_approaches": num_approaches,
            "impl_minutes_per_approach": impl_minutes,
            "tuning_minutes_per_iteration": tuning_minutes,
            "tuning_rounds": tuning_rounds,
            "gpu_impl": SETTINGS.impl_gpu,
            "gpu_tuning": SETTINGS.tuning_gpu,
            "gpu_plan": SETTINGS.plan_gpu,
        },
    )
