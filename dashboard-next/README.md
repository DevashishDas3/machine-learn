# ML Agent Swarm — Next.js Dashboard

Real-time visual monitor for the ML Agent Swarm pipeline. Shows a live tree of all phases (planning → codegen → training → tuning → report) with per-approach status, metrics, and generated code.

## Quick start

```bash
cd ml-agent-swarm/dashboard-next
npm install          # first time only
npm run dev
```

Then open **http://localhost:3000**

The dashboard auto-polls every 2 seconds while a run is active and stops when the pipeline completes.

## What you can see

| Panel | Description |
|-------|-------------|
| **Planning** | Planned approaches + estimated cost |
| **Code Generation** | Per-approach codegen status + generated `train.py` viewer |
| **Initial Training** | Per-approach training status, accuracy bars, error details |
| **Tuning** | Per-round hyperparameter changes + accuracy improvement per approach |
| **Report** | Final recommendation + full markdown report |

## Configuration

The dashboard reads run event logs from `../runs_local/` by default.  
Override via `.env.local`:

```
RUNS_LOCAL_PATH=../runs_local
```

Any absolute or relative path works.
