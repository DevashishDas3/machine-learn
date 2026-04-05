# machine(learn);

Automated ML approach planning, implementation, tuning, and reporting on Modal GPU infrastructure with a shared vLLM backend.

## Project Layout

```
├── modal-agent-swarm/       # Modal backend (Python)
│   ├── modal_app.py         # Modal app and shared resource definitions
│   ├── orchestrator.py      # 4-phase async pipeline (Plan → Implement → Tune → Report)
│   ├── agents/              # LLM server and agent modules
│   ├── schemas/             # Pydantic contracts for all phase handoffs
│   ├── supabase_helpers.py  # Supabase integration for dashboard updates
│   └── test_dashboard.py    # Test script for simulating pipeline runs
│
├── dashboard-next/          # Next.js frontend (TypeScript)
│   └── src/app/
│       ├── page.tsx         # Landing page
│       ├── login/           # Email/password auth
│       ├── signup/          # Account creation
│       └── dashboard/       # Main ML pipeline dashboard
│
└── supabase/                # Database schema
    └── migrations/          # SQL migrations
```

## Quick Start

### 1. Setup Backend (Modal)

```bash
cd modal-agent-swarm

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt
pip install supabase

# Authenticate with Modal
modal setup

# Create Supabase secret
modal secret create supabase-secrets SUPABASE_URL="https://your-project.supabase.co" SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Deploy
modal deploy orchestrator.py
```

### 2. Setup Frontend (Next.js)

```bash
cd dashboard-next

# Install dependencies
npm install

# Copy environment file and add your Supabase keys
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Start dev server
npm run dev
```

### 3. Setup Database (Supabase)

Run the SQL from `supabase/migrations/20260404_init.sql` in your Supabase SQL Editor.

## Testing the Dashboard

### Option A: Frontend Test (Recommended)

1. Start the frontend: `npm run dev` (in dashboard-next)
2. Go to http://localhost:3000/signup and create an account
3. You'll be redirected to the dashboard
4. Type a task description like "Classify MNIST digits" and press Enter
5. Watch the pipeline execute with live updates!

### Option B: CLI Test Script

1. Start the frontend: `npm run dev`
2. Create an account at http://localhost:3000/signup
3. Get your user ID from **Supabase Dashboard → Authentication → Users**
4. Run the test script:

```bash
cd modal-agent-swarm
python test_dashboard.py YOUR_USER_ID
```

5. Watch the dashboard update in realtime!

## Running a Real Pipeline

```bash
modal run orchestrator.py \
  --dataset-path /vol/datasets/mnist \
  --task-description "Classify handwritten digits with >98% accuracy"
```

With dashboard tracking:
```bash
modal run orchestrator.py \
  --dataset-path /vol/datasets/mnist \
  --task-description "Classify handwritten digits" \
  --swarm-run-id "uuid-from-supabase"
```

## Architecture

```
User Input (Dashboard)
        ↓
   Supabase DB  ←──────────────────┐
        ↓                          │
   Modal Backend                   │
        ↓                          │
┌──────────────────────────────────┤
│  PlanAgent                       │
│    ↓ (generates approaches)      │
│  ImplementationAgent (A100 GPU)  │  ← Updates Supabase
│    ↓ (trains models)             │     in realtime
│  TuningAgent                     │
│    ↓ (optimizes hyperparams)     │
│  ReportAgent                     │
│    ↓ (generates report)          │
└──────────────────────────────────┘
        ↓
   Final Results in Dashboard
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (Modal Secret: supabase-secrets)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## LLM Service Settings

- `LLM_USE_DEPLOYED_SERVICE` (default `true`): Use deployed LLM service
- `LLM_ALLOW_LOCAL_FALLBACK` (default `false`): Allow orchestrator to spin up local fallback LLM class if deployed service binding fails
- `LLM_SERVICE_APP_NAME` (default `ml-agent-llm-service`): Deployed app name
- `MODAL_ENVIRONMENT` (default `main`): Modal environment

## Local Development

```bash
# Run tests
pytest -q

# Stream Modal logs
modal app logs ml-agent-swarm
```
