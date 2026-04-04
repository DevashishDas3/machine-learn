"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RawEvent, PipelineState } from "@/types";
import { processEvents } from "@/lib/processEvents";
import { formatTs } from "@/lib/utils";
import PipelineView from "@/components/PipelineView";
import CodeModal from "@/components/CodeModal";
import ReportModal from "@/components/ReportModal";
import { ApproachState } from "@/types";

const POLL_MS = 2000;

function SpinnerIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

export default function Home() {
  const [runs, setRuns] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>("");
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [codeTarget, setCodeTarget] = useState<ApproachState | null>(null);
  const [showReport, setShowReport] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load run list
  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => {
        setRuns(d.runs ?? []);
        if (d.runs?.length) setSelectedRun(d.runs[0]);
      });
  }, []);

  const fetchEvents = useCallback(async (runId: string) => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/runs/${runId}/events`);
      const data = await res.json();
      const events: RawEvent[] = data.events ?? [];
      const state = processEvents(events);
      setPipeline(state);
      setLastUpdated(new Date());
      // Stop polling when done
      if (state?.phase === "complete") setIsLive(false);
    } catch {
      // silently ignore transient fetch errors
    }
  }, []);

  // Polling
  useEffect(() => {
    if (!selectedRun) return;
    fetchEvents(selectedRun);

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isLive) {
      intervalRef.current = setInterval(
        () => fetchEvents(selectedRun),
        POLL_MS
      );
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedRun, isLive, fetchEvents]);

  // Reset live when run changes
  useEffect(() => {
    setIsLive(true);
    setPipeline(null);
  }, [selectedRun]);

  const isComplete = pipeline?.phase === "complete";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
            ML
          </div>
          <span className="font-semibold text-zinc-100 text-sm tracking-wide">
            Agent Swarm
          </span>
        </div>

        {/* Run selector */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Run</span>
          <select
            className="bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[220px]"
            value={selectedRun}
            onChange={(e) => setSelectedRun(e.target.value)}
          >
            {runs.length === 0 && (
              <option value="">(no runs yet)</option>
            )}
            {runs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh controls */}
        <div className="flex items-center gap-3 ml-auto">
          {lastUpdated && (
            <span className="text-zinc-500 text-xs">
              Updated {formatTs(lastUpdated.toISOString())}
            </span>
          )}
          <button
            onClick={() => {
              if (!isLive) {
                setIsLive(true);
              }
              fetchEvents(selectedRun);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 transition-colors"
          >
            <SpinnerIcon className={`w-3 h-3 ${isLive && !isComplete ? "text-violet-400" : "text-zinc-500"}`} />
            {isLive && !isComplete ? "Live" : "Refresh"}
          </button>

          {/* Phase badge */}
          {pipeline && (
            <PhaseBadge phase={pipeline.phase} />
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: previous runs */}
        {runs.length > 1 && (
          <aside className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-y-auto py-3 px-2">
            <p className="text-zinc-500 text-xs px-2 mb-2 uppercase tracking-wider">
              Runs
            </p>
            {runs.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRun(r)}
                className={`w-full text-left px-2.5 py-2 rounded-md text-xs mb-0.5 transition-colors truncate ${
                  r === selectedRun
                    ? "bg-violet-600/20 text-violet-300 border border-violet-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {r}
              </button>
            ))}
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {!selectedRun || !pipeline ? (
            <EmptyState hasRuns={runs.length > 0} />
          ) : (
            <PipelineView
              pipeline={pipeline}
              onViewCode={(approach) => setCodeTarget(approach)}
              onViewReport={() => setShowReport(true)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {codeTarget && (
        <CodeModal
          approach={codeTarget}
          onClose={() => setCodeTarget(null)}
        />
      )}
      {showReport && pipeline?.report && (
        <ReportModal
          report={pipeline.report}
          recommendation={pipeline.recommendation}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    not_started: { label: "Not started", cls: "bg-zinc-700 text-zinc-400" },
    planning: { label: "Planning", cls: "bg-blue-900/50 text-blue-300 border border-blue-800" },
    codegen: { label: "Code Gen", cls: "bg-violet-900/50 text-violet-300 border border-violet-800" },
    training: { label: "Training", cls: "bg-amber-900/50 text-amber-300 border border-amber-800" },
    tuning: { label: "Tuning", cls: "bg-orange-900/50 text-orange-300 border border-orange-800" },
    reporting: { label: "Reporting", cls: "bg-teal-900/50 text-teal-300 border border-teal-800" },
    complete: { label: "Complete", cls: "bg-green-900/50 text-green-300 border border-green-800" },
  };
  const { label, cls } = map[phase] ?? map.not_started;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function EmptyState({ hasRuns }: { hasRuns: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-600/20 flex items-center justify-center">
        <span className="text-3xl">🧠</span>
      </div>
      <div>
        <p className="text-zinc-300 font-medium mb-1">
          {hasRuns ? "Select a run" : "No runs yet"}
        </p>
        <p className="text-zinc-500 text-sm max-w-xs">
          {hasRuns
            ? "Choose a run from the selector above to inspect its pipeline."
            : "Start a run with: modal run orchestrator.py --dataset-path … --task-description …"}
        </p>
      </div>
    </div>
  );
}
