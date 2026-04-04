-- machine(learn); Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.swarm_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    run_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_swarm_runs_user_id ON public.swarm_runs(user_id);
CREATE INDEX idx_swarm_runs_created_at ON public.swarm_runs(created_at DESC);
CREATE INDEX idx_swarm_runs_run_data ON public.swarm_runs USING GIN(run_data);

ALTER TABLE public.swarm_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs" ON public.swarm_runs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own runs" ON public.swarm_runs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own runs" ON public.swarm_runs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own runs" ON public.swarm_runs
    FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.swarm_runs TO authenticated;