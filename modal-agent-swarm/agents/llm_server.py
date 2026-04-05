from __future__ import annotations

import os
import sys

import modal

from config import SETTINGS


def _vllm_quantization() -> str | None:
    explicit = SETTINGS.llm_quantization.strip()
    if explicit:
        return explicit
    name = SETTINGS.llm_model_primary
    tail = name.rsplit("/", 1)[-1].upper()
    if tail.endswith("-AWQ") or "-AWQ-" in tail:
        return "awq"
    if "GPTQ" in tail:
        return "gptq"
    return None


def _load_diagnostics() -> None:
    """Human-readable lines on stderr for Modal logs (JSON logging may be unset in workers)."""
    lines = [
        "=== LLMServer.load diagnostics ===",
        f"resolved llm_model_primary={SETTINGS.llm_model_primary!r}",
        f"os.environ LLM_MODEL_PRIMARY={os.environ.get('LLM_MODEL_PRIMARY', '<unset>')!r}",
        f"os.environ LLM_QUANTIZATION={os.environ.get('LLM_QUANTIZATION', '<unset>')!r}",
        f"resolved LLM_MAX_MODEL_LEN={SETTINGS.llm_max_model_len}",
        f"resolved LLM_GPU_MEMORY_UTILIZATION={SETTINGS.llm_gpu_memory_utilization}",
        f"resolved LLM_ENFORCE_EAGER={SETTINGS.llm_enforce_eager}",
        f"resolved llm_gpu={SETTINGS.llm_gpu!r}",
    ]
    for key in sorted(os.environ):
        if key.startswith(("LLM_", "VLLM_", "HF_", "CUDA")):
            lines.append(f"env {key}={os.environ[key]!r}")
    q = _vllm_quantization()
    lines.append(
        f"inferred vLLM quantization={q!r} (if None, full-precision weights — high VRAM)"
    )
    try:
        import torch

        lines.append(
            f"torch={torch.__version__} cuda_available={torch.cuda.is_available()}"
        )
        if torch.cuda.is_available():
            lines.append(f"cuda_device={torch.cuda.get_device_name(0)!r}")
            free_b, total_b = torch.cuda.mem_get_info()
            lines.append(
                f"cuda_mem_get_info free_gib={free_b / 2**30:.2f} total_gib={total_b / 2**30:.2f}"
            )
    except Exception as exc:  # noqa: BLE001
        lines.append(f"torch_cuda_probe_failed={exc!r}")
    try:
        import vllm

        lines.append(f"vllm={vllm.__version__}")
    except Exception as exc:  # noqa: BLE001
        lines.append(f"vllm_import_failed={exc!r}")
    lines.append("=== end diagnostics; starting AsyncLLMEngine ===")
    for ln in lines:
        print(f"[llmserver] {ln}", file=sys.stderr, flush=True)


def get_llm_server_handle():
    try:
        deployed_cls = modal.Cls.from_name(
            SETTINGS.llm_service_app_name,
            SETTINGS.llm_service_class_name,
            environment_name=SETTINGS.modal_environment,
        )
        return deployed_cls()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "Failed to bind deployed LLM service "
            f"app={SETTINGS.llm_service_app_name!r} "
            f"class={SETTINGS.llm_service_class_name!r} "
            f"environment={SETTINGS.modal_environment!r}. "
            "This pipeline is configured to always use the deployed LLM service."
        ) from exc
