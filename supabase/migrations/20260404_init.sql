-- machine(learn); Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.swarm_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'complete', 'error', 'cancelled')),
    current_phase TEXT NOT NULL DEFAULT 'prepare_dataset',
    flowchart_data JSONB DEFAULT NULL,
    final_report JSONB DEFAULT NULL,
    chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    run_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_swarm_runs_user_id ON public.swarm_runs(user_id);
CREATE INDEX idx_swarm_runs_created_at ON public.swarm_runs(created_at DESC);
CREATE INDEX idx_swarm_runs_status ON public.swarm_runs(status);
CREATE INDEX idx_swarm_runs_run_data ON public.swarm_runs USING GIN(run_data);
CREATE INDEX idx_swarm_runs_flowchart ON public.swarm_runs USING GIN(flowchart_data);

ALTER TABLE public.swarm_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs" ON public.swarm_runs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own runs" ON public.swarm_runs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own runs" ON public.swarm_runs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own runs" ON public.swarm_runs
    FOR DELETE USING (auth.uid() = user_id);

-- Allow service role to bypass RLS (for Modal backend)
CREATE POLICY "Service role has full access" ON public.swarm_runs
    FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON public.swarm_runs TO authenticated;
GRANT ALL ON public.swarm_runs TO service_role;

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.swarm_runs;