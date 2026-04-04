from __future__ import annotations

import os
import sys
import uuid
from typing import Any, Dict, Optional

import modal

from config import SETTINGS
from modal_app import app, llm_image


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
    lines.append(f"inferred vLLM quantization={q!r} (if None, full-precision weights — high VRAM)")
    try:
        import torch

        lines.append(f"torch={torch.__version__} cuda_available={torch.cuda.is_available()}")
        if torch.cuda.is_available():
            lines.append(f"cuda_device={torch.cuda.get_device_name(0)!r}")
            free_b, total_b = torch.cuda.mem_get_info()
            lines.append(f"cuda_mem_get_info free_gib={free_b / 2**30:.2f} total_gib={total_b / 2**30:.2f}")
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


@app.cls(
    image=llm_image,
    gpu=SETTINGS.llm_gpu,
    timeout=SETTINGS.plan_timeout_seconds,
    startup_timeout=SETTINGS.llm_startup_timeout_seconds,
    min_containers=1,
    max_containers=1,
)
@modal.concurrent(max_inputs=SETTINGS.llm_concurrent_requests)
class LLMServer:
    """vLLM inference server using AsyncLLMEngine for concurrent request handling.

    A single GPU container handles all concurrent generate() calls through
    vLLM's continuous batching — no need for multiple containers or warmup.
    """

    @modal.enter()
    def load(self) -> None:
        _load_diagnostics()
        from vllm.engine.arg_utils import AsyncEngineArgs
        from vllm.engine.async_llm_engine import AsyncLLMEngine

        kwargs: dict = {
            "model": SETTINGS.llm_model_primary,
            "trust_remote_code": True,
            "max_model_len": SETTINGS.llm_max_model_len,
            "gpu_memory_utilization": SETTINGS.llm_gpu_memory_utilization,
            "enforce_eager": SETTINGS.llm_enforce_eager,
        }
        q = _vllm_quantization()
        if q:
            kwargs["quantization"] = q
        print(
            f"[llmserver] AsyncLLMEngine(**kwargs) keys={sorted(kwargs.keys())} "
            f"quantization_in_kwargs={'quantization' in kwargs}",
            file=sys.stderr,
            flush=True,
        )
        engine_args = AsyncEngineArgs(**kwargs)
        self.engine = AsyncLLMEngine.from_engine_args(engine_args)

    @modal.method()
    async def generate(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: int = 1024,
    ) -> str:
        from vllm import SamplingParams
        from vllm.sampling_params import StructuredOutputsParams

        structured = StructuredOutputsParams(json=schema) if schema else None
        params = SamplingParams(
            temperature=temperature,
            max_tokens=max_tokens,
            repetition_penalty=1.15,
            frequency_penalty=0.1,
            structured_outputs=structured,
        )
        request_id = uuid.uuid4().hex
        final_output = None
        async for output in self.engine.generate(prompt, params, request_id):
            final_output = output
        return final_output.outputs[0].text
