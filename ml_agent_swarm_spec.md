# ML Agent Swarm — Project Specification

## Project Goal

Build an automated ML pipeline that accepts a user-provided dataset and task description, then autonomously plans, implements, tunes, and benchmarks multiple ML approaches in parallel — all running on Modal GPUs with locally hosted LLMs.

The system returns a full comparison report, source code, and documentation for every approach explored.

---

## High-Level Workflow

```
User Input (dataset + task description)
        │
        ▼
  [Phase 1] PlanAgent
        │   → Generates 3–5 candidate ML approaches (JSON)
        │
        ▼
  [Phase 2] ImplementationAgents  ← parallel, one per approach
        │   → Generates training code → executes on Modal GPU
        │   → Returns: metrics, model checkpoint, logs
        │
        ▼
  [Phase 3] HyperparameterTuningAgents  ← parallel, one per approach
        │   → Sees initial metrics + code
        │   → Suggests HP changes → reruns training (2–3 iterations)
        │
        ▼
  [Phase 4] ReportAgent
        │   → Aggregates all results
        └── → Outputs: markdown report + source code zip
```

---

## Core Design Decisions

### LLMs: Locally Hosted on Modal (No External API)
- All agent reasoning is done by open-weight LLMs served via **vLLM** on Modal GPUs
- **One shared, persistent LLM server** (e.g. A100) — all agents call it; no redundant model loads
- Recommended models:
  - `Qwen2.5-Coder-32B-Instruct` — code generation (implementation agents)
  - `Llama-3.3-70B-Instruct` — reasoning and planning (plan + report agents)
  - Or `Qwen2.5-72B-Instruct` for a single model covering all roles
- Use vLLM's `guided_decoding` with JSON schema enforcement (Pydantic) to prevent malformed outputs

### Orchestration: Pure Python + asyncio (No LangGraph)
- The agent graph is **fixed and linear** — Plan → Implement → Tune → Report
- No dynamic branching or cycles at runtime, so LangGraph adds complexity with no benefit
- `asyncio.gather()` handles all parallel execution natively
- Modal's `.aio()` async remote calls integrate cleanly with asyncio

### Compute: Modal GPU Sandboxes
- Each agent phase runs as a Modal function or class with its own GPU allocation
- Dataset uploaded once to a **Modal Volume**, referenced by path in all sandboxes
- Hard timeouts per function (e.g. 20 min training, 10 min tuning)
- Pre-flight GPU-hour estimate before spawning agents (cost control)

---

## Agent Descriptions

| Agent | Role | LLM Task | GPU |
|---|---|---|---|
| `PlanAgent` | Proposes 3–5 ML approaches for the task | Reasoning + structured JSON output | A10G |
| `ImplementationAgent` (×N) | Generates + executes training code per approach | Code generation | A10G |
| `TuningAgent` (×N) | Iterates on hyperparameters given initial metrics | Reasoning + code editing | A10G |
| `ReportAgent` | Aggregates results, writes comparison report | Summarization + analysis | CPU (cheap) |
| `LLMServer` | Shared vLLM inference endpoint | — | A100 (persistent) |

---

## Data Schemas (Pydantic)

```python
class Approach(BaseModel):
    name: str                  # e.g. "CNN with ResNet backbone"
    framework: str             # "pytorch" or "sklearn"
    rationale: str             # why this suits the task
    hyperparameters: dict      # initial HP suggestions
    modal_gpu: str             # "A10G", "T4", etc.

class TrainingResult(BaseModel):
    approach_name: str
    metrics: dict              # {"accuracy": 0.94, "loss": 0.21, ...}
    model_checkpoint_path: str
    logs_path: str
    error: str | None          # populated if training crashed

class TuningIteration(BaseModel):
    iteration: int
    hyperparameters: dict
    result: TrainingResult
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Async orchestration | `asyncio` |
| LLM inference | `vLLM` |
| GPU compute | Modal |
| ML frameworks | PyTorch (primary), scikit-learn (classical) |
| Data validation | Pydantic v2 |
| Experiment tracking | Weights & Biases or MLflow (inside Modal sandboxes) |
| Dataset storage | Modal Volumes |
| Frontend (optional v2) | Streamlit or Gradio |

---

## File Structure

```
ml-agent-swarm/
│
├── modal_app.py              # Modal app definition; all @app.function / @app.cls decorators
├── orchestrator.py           # Main asyncio event loop; phases 1–4 in sequence
│
├── agents/
│   ├── llm_server.py         # vLLM Modal class — shared inference server, loaded once
│   ├── plan_agent.py         # Prompt construction + JSON parsing for approach planning
│   ├── impl_agent.py         # Code generation + sandboxed execution per approach
│   ├── tuning_agent.py       # HP tuning logic; calls impl_agent iteratively
│   └── report_agent.py       # Results aggregation + markdown report generation
│
├── schemas/
│   └── types.py              # All Pydantic models (Approach, TrainingResult, etc.)
│
├── prompts/
│   ├── plan_agent.txt         # System + user prompt templates for PlanAgent
│   ├── impl_agent.txt         # Prompt template for code generation
│   ├── tuning_agent.txt       # Prompt template for HP suggestion
│   └── report_agent.txt       # Prompt template for report writing
│
└── utils/
    ├── code_runner.py         # Safe exec() wrapper with timeout + error capture
    └── volume_utils.py        # Modal Volume helpers (upload dataset, read checkpoints)
```

---

## Key Implementation Patterns

### Shared vLLM Server
```python
@app.cls(gpu="A100", image=vllm_image)
class LLMServer:
    @modal.enter()
    def load(self):
        from vllm import LLM
        self.llm = LLM(model="Qwen/Qwen2.5-72B-Instruct")

    @modal.method()
    def generate(self, prompt: str, schema: dict = None) -> str:
        from vllm import SamplingParams
        from vllm.sampling_params import GuidedDecodingParams
        guided = GuidedDecodingParams(json=schema) if schema else None
        params = SamplingParams(max_tokens=2048, guided_decoding=guided)
        return self.llm.generate([prompt], params)[0].outputs[0].text
```

### Parallel Execution via asyncio
```python
async def phase_2_implement(approaches: list[Approach]) -> list[TrainingResult]:
    tasks = [impl_agent.run.remote.aio(a) for a in approaches]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, TrainingResult)]
```

### Safe Code Execution
```python
def run_generated_code(code: str, timeout: int = 1200) -> dict:
    namespace = {}
    try:
        exec(compile(code, "<agent>", "exec"), namespace)
        return namespace["train"]()   # generated code must expose train()
    except Exception as e:
        return {"error": str(e), "metrics": {}}
```

---

## Pitfalls & Mitigations

| Risk | Mitigation |
|---|---|
| Generated code crashes | Wrap all `exec()` in try/except; return error state; orchestrator skips or retries |
| Modal cold starts | Pre-warm LLM server image; budget ~30s for first invocation |
| LLM context overflow | Never pass full training logs to agents; summarize metrics only |
| Runaway GPU costs | Pre-flight cost estimate before spawning; hard per-function timeouts |
| Malformed LLM output | Enforce JSON schema via vLLM `guided_decoding` on every structured call |
| Flaky parallel failures | `asyncio.gather(return_exceptions=True)` — partial failures don't kill the run |

---

## Build Order (Recommended)

1. **PlanAgent** — Claude API call → structured approach list; no Modal yet; validate JSON schema
2. **LLMServer on Modal** — get vLLM running; test single inference call
3. **Single ImplementationAgent** — code generation → Modal execution → metrics back
4. **Parallelize** — `asyncio.gather()` across all approaches simultaneously
5. **TuningAgent loop** — 2–3 HP iterations per approach
6. **ReportAgent** — aggregation + markdown/PDF output + file packaging
7. **Frontend (optional)** — Streamlit/Gradio for dataset upload + live progress view

---

## Output Artifacts (per run)

- `report.md` — full comparison of all approaches: metrics table, HP history, recommendation
- `src/<approach_name>/train.py` — generated training code per approach
- `checkpoints/<approach_name>/` — saved model weights for best iteration
- `logs/<approach_name>/` — training logs per approach
- `run_summary.json` — machine-readable results for all approaches and iterations