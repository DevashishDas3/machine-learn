# AGENTS.md

Operational guide for coding agents working in this repository.

## Scope and intent

- Repository: `machine-learn`
- Main stack: Python (Modal orchestration) + Next.js/TypeScript dashboard
- Goal: make safe, minimal, convention-aligned changes that keep the pipeline runnable

## Existing agent/editor rule files

- Checked for Cursor rules: `.cursorrules`, `.cursor/rules/**`
- Checked for Copilot rules: `.github/copilot-instructions.md`
- Current status: none of those files exist in this repo
- If these files are added later, treat them as higher-priority constraints and update this document

## Repository map

- `orchestrator.py`: main async pipeline (`Plan -> Implement -> Tune -> Report`)
- `start_dashboard_run.py`: dashboard launcher that creates run rows, uploads files to Modal Volume, and starts orchestrator
- `modal_app.py`: Modal app/resources and function images
- `llm_service.py`: deployed shared LLM service app (`ml-agent-llm-service`)
- `agents/`: plan/implementation/tuning/report agents + shared LLM server
- `schemas/`: Pydantic models for phase contracts and run summaries
- `utils/`: parsing, code execution, logging, volume/event helpers
- `tests/`: pytest tests for schemas/parsing/MNIST helpers
- `dashboard-next/`: Next.js dashboard with auth, run creation form, and realtime run visualization
- `runs_local/`: local event logs and run state for dashboard API routes

## Setup commands

### Python (repo root)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Dashboard (Next.js)

```bash
cd dashboard-next
npm install
```

## Build, lint, test, and run commands

Use these exact commands unless you intentionally need a variant.

### Python commands (repo root)

- Run all tests (quick):
  - `pytest -q`
- Run one test file:
  - `pytest tests/test_parsing.py -q`
- Run one test function (preferred single-test pattern):
  - `pytest tests/test_parsing.py::test_parse_model_output_validates_schema -q`
- Run tests matching an expression:
  - `pytest -q -k parsing`
- Run orchestrator locally through Modal:
  - `modal run orchestrator.py --dataset-path /vol/datasets/sample.csv --task-description "Binary classification for churn prediction"`
- Deploy shared LLM service app:
  - `modal deploy llm_service.py`
- Deploy Modal app resources:
  - `modal deploy orchestrator.py`
- Run Streamlit dashboard:
  - `streamlit run dashboard.py`

### Next.js dashboard commands (`dashboard-next/`)

- Dev server:
  - `npm run dev`
- Production build:
  - `npm run build`
- Production start (after build):
  - `npm run start`
- Type-check without emit (no npm script defined; run directly):
  - `npx tsc --noEmit`

### Dashboard run-start flow (local)

- Start API route:
  - `dashboard-next/src/app/api/runs/start/route.ts`
- Python launcher invoked by API route:
  - `modal-agent-swarm/start_dashboard_run.py`
- Optional local env overrides for launcher process:
  - `DASHBOARD_BACKEND_DIR` (path to `modal-agent-swarm`)
  - `PYTHON_BIN` (explicit Python executable)

### Lint status

- Python lint config files (`ruff`, `flake8`, `pyproject.toml`, etc.) are not present.
- Next.js lint script is not defined in `dashboard-next/package.json`.
- Until dedicated linters are added, use:
  - `pytest -q` for Python validation
  - `npx tsc --noEmit` and `npm run build` for dashboard validation

## Default validation flow for code changes

- Python-only changes:
  1. Run targeted tests first (`pytest <node> -q`)
  2. Run full suite (`pytest -q`)
- Dashboard-only changes:
  1. Run `npx tsc --noEmit`
  2. Run `npm run build`
- Cross-cutting changes:
  1. Run Python tests
  2. Run dashboard type-check + build

## Python style guidelines

These conventions reflect current code in `orchestrator.py`, `agents/`, `utils/`, and `schemas/`.

- Target Python 3.11+ features already in use (`str | None`, built-in generics, `from __future__ import annotations`).
- Keep imports grouped in this order: stdlib, third-party, local modules.
- Prefer explicit imports over wildcard imports.
- Use type hints on all new functions, return values, and important local variables.
- Keep schema-bearing data in Pydantic models instead of ad-hoc dicts when crossing phase boundaries.
- Use `model_validate`/`model_dump`/`model_dump_json` for Pydantic v2 serialization boundaries.
- Normalize external/model output before validation when needed (see `utils/parsing.py`, schema validators).
- Naming:
  - `snake_case` for functions/variables
  - `PascalCase` for classes
  - `UPPER_SNAKE_CASE` for constants
- Prefer small helper functions for repeated logic (`_pick_best_result`, `_build_error_result`, etc.).
- Keep side effects explicit (file writes, volume commits, event emits).
- Do not swallow exceptions silently unless intentionally best-effort; when suppressing, do it narrowly.
- When catching broad exceptions (`except Exception`), include a clear reason and preserve error context in results/events.
- Preserve async patterns:
  - use `asyncio.gather(..., return_exceptions=True)` when partial failure is acceptable
  - use semaphores for bounded parallelism
- Logging:
  - use `utils.logging_utils.get_logger`
  - keep logs structured and machine-readable where possible
- Keep generated artifact paths deterministic and under run-scoped directories.

## TypeScript/Next.js style guidelines

Conventions observed in `dashboard-next/src`:

- Use strict TypeScript; do not weaken `tsconfig` strictness.
- Prefer explicit domain types from `src/types.ts` over inline `any`.
- Keep React components as typed function components with clear prop types.
- Prefer `const` and immutable data transforms.
- Use `@/*` path alias for app imports when available.
- Naming:
  - `PascalCase` for components/types
  - `camelCase` for variables/functions
  - descriptive event/state names aligned with backend event payloads
- Keep API route handlers resilient to missing files and transient I/O errors.
- Avoid throwing from dashboard polling paths for recoverable failures; fail soft and continue polling.
- Keep UI logic and event-to-state transformation separated (`lib/processEvents.ts` pattern).
- Preserve Tailwind utility style already used; avoid introducing a second styling system.

## Error handling and resilience rules

- Prefer returning structured error states over hard crashes in long-running pipeline phases.
- Propagate enough context for debugging:
  - error string
  - relevant approach/run identifiers
  - paths to logs/artifacts when available
- For user/model-provided text, sanitize and validate before execution/use.
- Never assume model outputs are valid JSON or schema-compliant.
- Guard file and network operations with clear fallbacks where operationally appropriate.
- For dashboard API errors, return structured JSON (`error` + actionable `details`) rather than generic 500 text.

## Testing guidance

- Add or update tests with behavior changes, especially for:
  - schema normalization/validation
  - parsing and output coercion
  - utility functions with edge cases
- Keep tests deterministic and fast; prefer unit tests over integration tests unless needed.
- Use existing test style (plain pytest functions, clear arrange/act/assert flow).

## Agent workflow expectations

- Make the smallest change that fully solves the task.
- Do not refactor unrelated areas unless necessary for correctness.
- Preserve public contracts used across phases and dashboard event parsing.
- If adding new commands/tooling, update this file in the same change.
- If Cursor/Copilot instruction files are introduced, mirror their key rules here.
