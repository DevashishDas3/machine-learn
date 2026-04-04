# ML Agent Swarm Runbook

## 1) Preconditions

- Modal account authenticated (`modal setup`)
- Named volume exists (or allow lazy create): `ml-agent-swarm-data`
- `.env` configured with model names, GPU classes, timeouts, and budget

## 2) Dataset upload

Upload dataset into volume once:

`modal volume put ml-agent-swarm-data ./local_dataset.csv /datasets/local_dataset.csv`

Then use `/vol/datasets/local_dataset.csv` as `dataset_path`.

## 3) Trigger a run

`modal run orchestrator.py --dataset-path /vol/datasets/local_dataset.csv --task-description "Your ML objective"`

## 4) Monitor

- Observe execution logs in terminal output.
- For deployed apps, stream logs:
  - `modal app logs ml-agent-swarm`

## 5) Retrieve artifacts

List run artifacts:

`modal volume ls ml-agent-swarm-data /runs`

Download report:

`modal volume get ml-agent-swarm-data /runs/<run_id>/reports/report.md ./report.md`

Download run summary:

`modal volume get ml-agent-swarm-data /runs/<run_id>/summaries/run_summary.json ./run_summary.json`

## 6) Failure triage

- **Plan phase fails**: validate LLM server availability and schema output.
- **Implementation phase fails**: inspect `/logs/<approach>.log`; generated code may not satisfy `train(payload)->dict`.
- **Budget rejection**: lower `MAX_APPROACHES`, `MAX_TUNING_ITERATIONS`, or choose cheaper GPUs.
- **Volume visibility issues**: ensure producer functions call `commit()` and consumer functions call `reload()`.

## 7) Smoke validation recipe

Run with:
- 2 approaches
- 1 tuning iteration
- a tiny CSV dataset

Expected result:
- non-empty `run_summary.json`
- `report.md` exists
- at least one approach without `error`
