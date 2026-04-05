# machine(learn);

Automated ML approach planning, implementation, tuning, and reporting on Modal GPU infrastructure with a Supabase-backed realtime dashboard.

## Project layout

```
├── modal-agent-swarm/               # Modal backend (Python)
│   ├── orchestrator.py              # 4-phase async pipeline (Plan -> Implement -> Tune -> Report)
│   ├── dashboard_launcher_service.py # Local FastAPI launcher service for dashboard run starts
│   ├── llm_service.py               # Deployed shared LLM service app (ml-agent-llm-service)
│   ├── modal_app.py                 # Modal app/resources and shared images
│   ├── agents/                      # Plan/impl/tuning/report agents + LLM handle binding
│   ├── schemas/                     # Pydantic contracts for all phase handoffs
│   ├── supabase_helpers.py          # Supabase run/update helpers for dashboard
│   └── test_dashboard.py            # Optional fake pipeline simulator for UI testing
│
├── dashboard-next/                  # Next.js frontend (TypeScript)
│   └── src/app/
│       ├── page.tsx                 # Landing page
│       ├── login/                   # Email/password auth
│       ├── signup/                  # Account creation
│       ├── dashboard/               # Main ML pipeline dashboard + "Start New Run" form
│       └── api/runs/start/route.ts  # Server route that forwards to launcher service
│
└── supabase/
    └── migrations/20260404_init.sql # swarm_runs schema + RLS + realtime
```

## What works now

- Users can sign up/log in and start a run directly from the dashboard.
- Dashboard accepts:
  - dataset file upload
  - labels file upload
  - task prompt
  - optional run name
- Backend uploads files to Modal Volume and launches orchestrator automatically.
- Realtime updates stream into dashboard from Supabase (`swarm_runs`).
- Orchestrator is configured to use deployed LLM service by default and does not silently fallback.

## Quick start

### 1) Database (Supabase)

Run the SQL in `supabase/migrations/20260404_init.sql` in Supabase SQL Editor.

### 2) Backend (Modal)

```bash
cd modal-agent-swarm

# If using uv (recommended)
uv sync

# OR classic venv
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Modal auth
modal setup

# Create backend secret used by Modal workers
modal secret create supabase-secrets SUPABASE_URL="https://your-project.supabase.co" SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Deploy shared LLM service first (recommended)
modal deploy llm_service.py

# Deploy orchestrator app
modal deploy orchestrator.py
```

### 3) Frontend (Next.js)

```bash
cd dashboard-next
npm install
```

Create `dashboard-next/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Local launcher service
# DASHBOARD_LAUNCHER_URL=http://127.0.0.1:8001/start-run
```

Then run:

```bash
npm run dev
```

Start the local launcher service in another terminal:

```bash
cd modal-agent-swarm
uv run python dashboard_launcher_service.py
# or: python dashboard_launcher_service.py
```

## Start a run from dashboard

1. Open `http://localhost:3000/signup` (or `/login`).
2. Go to `/dashboard`.
3. In the sidebar "Start New Run" form, provide:
   - task prompt
   - dataset file
   - labels file
   - optional run name
4. Click `Start Run`.
5. Watch live phase/chat/flow updates as the Modal run executes.

## Manual CLI run (still supported)

```bash
cd modal-agent-swarm
modal run orchestrator.py --dataset-path /vol/datasets/sample.csv --task-description "Binary classification"
```

With dashboard tracking to an existing `swarm_runs.id`:

```bash
modal run orchestrator.py --dataset-path /vol/datasets/sample.csv --labels-path /vol/datasets/sample.labels --task-description "Binary classification" --swarm-run-id "uuid"
```

## Environment variables

### Frontend (`dashboard-next/.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DASHBOARD_LAUNCHER_URL` (optional, default `http://127.0.0.1:8001/start-run`)

### Backend (`modal-agent-swarm/.env` + Modal secret)

- Modal/runtime:
  - `MODAL_APP_NAME` (default `ml-agent-swarm`)
  - `MODAL_VOLUME_NAME` (default `ml-agent-swarm-data`)
  - `MODAL_ENVIRONMENT` (default `main`)
- Launcher behavior:
  - dashboard launcher now uses Modal Python SDK (`modal.Volume.batch_upload`, `modal.Function.from_name(...).spawn(...)`) and does not shell out to `modal` CLI.
- LLM routing:
  - `LLM_USE_DEPLOYED_SERVICE` (default `true`)
  - `LLM_ALLOW_LOCAL_FALLBACK` (default `false`)
  - `LLM_SERVICE_APP_NAME` (default `ml-agent-llm-service`)
  - `LLM_SERVICE_CLASS_NAME` (default `LLMServer`)
- Supabase (for backend writes):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Validation commands

### Dashboard

```bash
cd dashboard-next
npx tsc --noEmit
npm run build
```

### Backend

```bash
cd modal-agent-swarm
pytest -q
```

## Troubleshooting

- Dashboard start API returns 500:
  - Check response JSON `details` and verify `dashboard_launcher_service.py` is running.
  - Verify `DASHBOARD_LAUNCHER_URL` matches launcher host/port.
- LLM service mismatch / unexpected local fallback:
  - Ensure `llm_service.py` is deployed and `LLM_ALLOW_LOCAL_FALLBACK=false`.
- No realtime updates:
  - Confirm Supabase realtime publication is enabled for `swarm_runs` (migration includes this).