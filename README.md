# ML Agent Swarm

Automated ML approach planning, implementation, tuning, and reporting on Modal GPU infrastructure with a shared vLLM backend.

## Project layout

- `modal_app.py`: Modal app and shared resource definitions.
- `orchestrator.py`: 4-phase async pipeline (`Plan -> Implement -> Tune -> Report`).
- `agents/`: LLM server and agent modules.
- `schemas/`: Pydantic contracts for all phase handoffs.
- `utils/`: code execution, parsing, cost estimation, volume helpers.
- `prompts/`: prompt templates per agent role.

## Setup

1. Create a Python 3.11+ environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and set model/GPU/timeouts for your environment.
4. Authenticate with Modal:
   - `modal setup`

## Run

Use a small CSV first to validate flow:

`modal run orchestrator.py --dataset-path /vol/datasets/sample.csv --task-description "Binary classification for churn prediction"`

The run writes artifacts into the configured Modal Volume under:

- `/vol/runs/<run_id>/src`
- `/vol/runs/<run_id>/checkpoints`
- `/vol/runs/<run_id>/logs`
- `/vol/runs/<run_id>/reports/report.md`
- `/vol/runs/<run_id>/summaries/run_summary.json`

## Deploy

Deploy app resources:

`modal deploy orchestrator.py`

Add files to volume:

modal volume put ml-agent-swarm-data .\train-images.idx3-ubyte /datasets/mnist/train-images.idx3-ubyte

Stream logs:

`modal app logs ml-agent-swarm`

## Testing

Run quick unit tests:

`pytest -q`
