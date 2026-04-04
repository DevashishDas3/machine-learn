from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

import modal

from agents.llm_server import _load_diagnostics, _vllm_quantization
from config import SETTINGS
from modal_app import llm_image

app = modal.App(SETTINGS.llm_service_app_name)


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
