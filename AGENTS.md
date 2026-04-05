# AGENTS.md

Guidance for coding agents working in `machine-learn`.

## Scope

- Monorepo with two primary apps:
- `modal-agent-swarm/` (Python backend on Modal)
- `dashboard-next/` (Next.js + TypeScript frontend)
- Goal: make minimal, correct, convention-aligned changes and validate them.

## Rule files check

- Checked `.cursorrules`: not present.
- Checked `.cursor/rules/**`: not present.
- Checked `.github/copilot-instructions.md`: not present.
- If any are added later, treat them as higher-priority instructions and update this file.

## Repository map

- `README.md`: top-level architecture and setup.
- `modal-agent-swarm/orchestrator.py`: pipeline orchestration entrypoints.
- `modal-agent-swarm/llm_service.py`: deployed `ml-agent-llm-service` app.
- `modal-agent-swarm/dashboard_launcher_service.py`: local FastAPI launcher.
- `modal-agent-swarm/modal_app.py`: Modal app, images, shared resources.
- `modal-agent-swarm/agents/`: plan/impl/tune/report and LLM handle binding.
- `modal-agent-swarm/schemas/`: Pydantic models for contracts and summaries.
- `modal-agent-swarm/utils/`: parsing, logging, code runner, volume helpers.
- `modal-agent-swarm/tests/`: pytest unit tests.
- `dashboard-next/src/`: Next.js app routes, API routes, and dashboard UI.

## Environment and setup

- Python work is typically executed from `modal-agent-swarm/`.
- Frontend work is executed from `dashboard-next/`.
- Backend dependencies are in `modal-agent-swarm/requirements.txt`.
- Frontend scripts/deps are in `dashboard-next/package.json`.
- Common backend workflow uses `uv` if available; `python`/`pip` is acceptable.

## Build, lint, and test commands

Run commands from the noted directory.

### Backend (Python / Modal)

- Install deps (venv path):
- `python -m venv .venv`
- `.venv\Scripts\activate`
- `pip install -r requirements.txt`
- Install deps (uv path):
- `uv sync`
- Run full tests:
- `pytest -q`
- Run one test file:
- `pytest tests/test_parsing.py -q`
- Run one specific test (preferred single-test pattern):
- `pytest tests/test_parsing.py::test_parse_model_output_validates_schema -q`
- Run tests by keyword expression:
- `pytest -q -k parsing`
- Deploy shared LLM service:
- `modal deploy llm_service.py`
- Deploy swarm/orchestrator app:
- `modal deploy orchestrator.py`
- Run orchestrator once via Modal:
- `modal run orchestrator.py --dataset-path /vol/datasets/sample.csv --task-description "Binary classification"`
- Run launcher service locally:
- `uv run python dashboard_launcher_service.py`

### Frontend (Next.js)

- Install deps:
- `npm install`
- Dev server:
- `npm run dev`
- Lint:
- `npm run lint`
- Type-check:
- `npx tsc --noEmit`
- Production build:
- `npm run build`
- Start built app:
- `npm run start`

## Validation matrix for changes

- Backend-only change:
- Run targeted test(s), then `pytest -q`.
- Frontend-only change:
- Run `npm run lint`, `npx tsc --noEmit`, then `npm run build`.
- Cross-cutting change:
- Run backend tests and frontend lint/typecheck/build.

## Python style conventions

- Target Python 3.11 idioms already used in repo.
- Prefer `from __future__ import annotations` for new modules.
- Import order: stdlib, third-party, local; separate groups with blank lines.
- Avoid wildcard imports.
- Use explicit type hints for new function signatures and non-trivial returns.
- Use `snake_case` for variables/functions, `PascalCase` for classes.
- Keep constants in `UPPER_SNAKE_CASE`.
- Prefer small helper functions over duplicated inline blocks.
- Keep async code async end-to-end; avoid blocking calls in async flows.
- Use `asyncio.gather(..., return_exceptions=True)` only when partial failure is intentional.
- Bound concurrency explicitly (for example with semaphores) when fan-out work is added.

## Schemas and data contracts

- Treat `modal-agent-swarm/schemas/` as source of truth for phase contracts.
- Prefer Pydantic models at boundaries over untyped dict payloads.
- Use Pydantic v2 APIs (`model_validate`, `model_dump`, `model_dump_json`).
- Validate and normalize model/LLM outputs before downstream consumption.
- Preserve existing run summary and artifact path structures unless intentionally migrated.

## Error handling and logging

- Fail loudly for hard dependency failures (for example remote LLM binding).
- For long-running pipeline phases, capture structured errors and continue where designed.
- Avoid broad `except Exception` unless necessary; if used, include actionable context.
- Keep stack context by re-raising with `from exc` when translating errors.
- Prefer structured log/event payloads over ad-hoc prints in pipeline paths.
- Do not silently swallow errors in API routes; return JSON with `error` and `details`.

## TypeScript/Next.js conventions

- Keep strict TypeScript behavior; do not relax typing to `any` without necessity.
- Prefer concrete shared types from project modules when available.
- Use `PascalCase` for components/types; `camelCase` for variables/functions.
- Keep API route responses consistent and machine-readable.
- Guard nullable numeric values before formatting (`toFixed` etc.).
- Preserve existing Tailwind + app-router patterns unless refactor is required.

## Naming and file organization

- Follow existing folder boundaries (agents, utils, schemas, app routes).
- Keep module responsibilities narrow; avoid mixing orchestration and UI concerns.
- New utility logic should live under `utils/` unless domain-specific.
- New schema or contract types should be added under `schemas/`.

## Testing guidance

- Add or update tests when behavior changes.
- Prefer fast, deterministic unit tests.
- Use descriptive test names with explicit scenario/result intent.
- For bug fixes, add a regression test when feasible.
- For single-test iteration, use node-id syntax shown above.

## Modal and deployment notes

- Swarm app resolves LLM via deployed `ml-agent-llm-service` class binding.
- Ensure `LLM_SERVICE_APP_NAME`, `LLM_SERVICE_CLASS_NAME`, and `MODAL_ENVIRONMENT` match deployed resources.
- Volume paths and run artifacts should remain deterministic and run-scoped.
- Do not introduce local-only fallbacks for production-critical remote services unless explicitly requested.

## Agent workflow expectations

- Make the smallest safe change that solves the request.
- Do not refactor unrelated code opportunistically.
- Preserve public interfaces consumed by dashboard and orchestrator.
- Update docs when commands or operational behavior change.
- If new rule files are added (`.cursorrules`, `.cursor/rules/**`, `.github/copilot-instructions.md`), fold their key points into this document.
