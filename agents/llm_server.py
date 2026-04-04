from __future__ import annotations

import os
import sys
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
    lines.append("=== end diagnostics; starting LLM() ===")
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
class LLMServer:
    @modal.enter()
    def load(self) -> None:
        _load_diagnostics()
        from vllm import LLM

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
        print(f"[llmserver] LLM(**kwargs) keys={sorted(kwargs.keys())} quantization_in_kwargs={'quantization' in kwargs}", file=sys.stderr, flush=True)
        self.llm = LLM(**kwargs)

    @modal.method()
    def warmup(self) -> Dict[str, Any]:
        text = self.generate("Reply with JSON {\"ok\": true}.", schema={"type": "object"})
        return {"ok": True, "sample": text[:120]}

    @modal.method()
    def generate(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: int = 1024,
    ) -> str:
        from vllm.sampling_params import SamplingParams, StructuredOutputsParams

        structured = StructuredOutputsParams(json=schema) if schema else None
        params = SamplingParams(
            temperature=temperature,
            max_tokens=max_tokens,
            repetition_penalty=1.15,
            frequency_penalty=0.1,
            structured_outputs=structured,
        )
        output = self.llm.generate([prompt], params)
        return output[0].outputs[0].text
