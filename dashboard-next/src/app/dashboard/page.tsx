"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RawEvent, PipelineState, ApproachState } from "@/types";
import { processEvents } from "@/lib/processEvents";
import { formatTs } from "@/lib/utils";

const POLL_MS = 2000;

// ============================================
// Icon Components (no external dependencies)
// ============================================

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

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ============================================
// Phase Badge Component
// ============================================

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; borderColor: string; textColor: string }> = {
    not_started: { label: "NOT_STARTED", borderColor: "border-white/20", textColor: "text-paper/40" },
    planning: { label: "PLANNING", borderColor: "border-azure/50", textColor: "text-azure" },
    codegen: { label: "CODEGEN", borderColor: "border-violet-500/50", textColor: "text-violet-400" },
    training: { label: "TRAINING", borderColor: "border-amber-500/50", textColor: "text-amber-400" },
    tuning: { label: "TUNING", borderColor: "border-orange-500/50", textColor: "text-orange-400" },
    reporting: { label: "REPORTING", borderColor: "border-teal-500/50", textColor: "text-teal-400" },
    complete: { label: "COMPLETE", borderColor: "border-green-500/50", textColor: "text-green-400" },
  };
  const { label, borderColor, textColor } = map[phase] ?? map.not_started;
  return (
    <span className={`px-2 py-1 border font-mono text-[10px] uppercase tracking-widest ${borderColor} ${textColor}`}>
      {label}
    </span>
  );
}

// ============================================
// Empty State Component
// ============================================

function EmptyState({ hasRuns }: { hasRuns: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <pre className="text-azure/60 text-[10px] leading-tight font-mono mb-6">
{`
    ████████████████████████████████
    ██                            ██
    ██    ╔═══════════════════╗   ██
    ██    ║   ▄▄▄▄▄   ▄▄▄▄▄   ║   ██
    ██    ║  ██████▄ ▄██████  ║   ██
    ██    ║  ███████████████  ║   ██
    ██    ║   ▀█████████████  ║   ██
    ██    ║     ▀█████████▀   ║   ██
    ██    ║  ▄▄▄▄▄███████▄▄▄  ║   ██
    ██    ║  █████████████▀   ║   ██
    ██    ╚═══════════════════╝   ██
    ██                            ██
    ████████████████████████████████
`}
      </pre>
      <div className="border border-white/10 p-6 max-w-md">
        <p className="font-mono text-sm text-paper mb-2">
          {hasRuns ? "> SELECT_RUN" : "> NO_RUNS_FOUND"}
        </p>
        <p className="font-mono text-xs text-paper/50 leading-relaxed">
          {hasRuns
            ? "Choose a run from the sidebar to view execution trace and agent outputs."
            : "modal run orchestrator.py --dataset-path ./data --task-description \"...\""}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Pipeline View Component (Bento Box Layout)
// ============================================

function PipelineView({
  pipeline,
  onViewCode,
  onViewReport,
}: {
  pipeline: PipelineState;
  onViewCode: (approach: ApproachState) => void;
  onViewReport: () => void;
}) {
  const isComplete = pipeline.phase === "complete";

  return (
    <div className="space-y-6">
      {/* Pipeline Header */}
      <div className="border border-white/10 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure mb-1">
              Task Description
            </p>
            <p className="font-mono text-sm text-paper leading-relaxed">
              {pipeline.taskDescription}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[10px] text-paper/40">
              {pipeline.datasetPath}
            </p>
            {pipeline.estimatedCostUsd !== undefined && (
              <p className="font-mono text-xs text-paper/60 mt-1">
                Est. ${pipeline.estimatedCostUsd.toFixed(2)} USD
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Approaches Grid (Bento Box) */}
      <div className="grid gap-[1px] bg-white/10 md:grid-cols-2 lg:grid-cols-3">
        {pipeline.approaches.map((approach, idx) => (
          <ApproachCard
            key={idx}
            approach={approach}
            index={idx}
            onViewCode={() => onViewCode(approach)}
          />
        ))}
      </div>

      {/* Report Section */}
      {isComplete && pipeline.report && (
        <div className="border border-green-500/30 bg-green-950/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-green-400 mb-1">
                Pipeline Complete
              </p>
              {pipeline.recommendation && (
                <p className="font-mono text-sm text-paper">
                  Recommendation: <span className="text-green-400">{pipeline.recommendation}</span>
                </p>
              )}
            </div>
            <button
              onClick={onViewReport}
              className="border border-green-500/50 px-4 py-2 font-mono text-xs uppercase tracking-widest text-green-400 transition-all hover:bg-green-500/10"
            >
              View Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Approach Card Component
// ============================================

function ApproachCard({
  approach,
  index,
  onViewCode,
}: {
  approach: ApproachState;
  index: number;
  onViewCode: () => void;
}) {
  const hasCode = !!approach.code;
  const hasTuning = approach.tuningIterations.length > 0;
  const latestMetrics = hasTuning
    ? approach.tuningIterations[approach.tuningIterations.length - 1]?.metrics
    : approach.initialMetrics;

  const statusColor = approach.initialError
    ? "border-l-red-500"
    : hasCode
    ? "border-l-green-500"
    : "border-l-azure";

  return (
    <div className={`bg-obsidian p-4 border-l-2 ${statusColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-mono text-[10px] text-paper/40 mb-1">
            APPROACH_{String(index + 1).padStart(2, "0")}
          </p>
          <p className="font-mono text-sm text-paper font-medium">{approach.name}</p>
          <p className="font-mono text-xs text-azure">{approach.framework}</p>
        </div>
        {hasCode && (
          <button
            onClick={onViewCode}
            className="border border-white/20 px-2 py-1 font-mono text-[10px] uppercase text-paper/60 hover:border-azure hover:text-azure transition-colors"
          >
            {"</>"}
          </button>
        )}
      </div>

      {/* Rationale */}
      {approach.rationale && (
        <p className="font-mono text-[11px] text-paper/50 mb-3 leading-relaxed line-clamp-2">
          {approach.rationale}
        </p>
      )}

      {/* Metrics */}
      {latestMetrics && (
        <div className="border-t border-white/10 pt-3 mt-3">
          <p className="font-mono text-[10px] text-paper/40 uppercase mb-2">
            {hasTuning ? `Tuning Iter ${approach.tuningIterations.length}` : "Initial Metrics"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(latestMetrics).slice(0, 4).map(([key, val]) => (
              <div key={key} className="font-mono text-[11px]">
                <span className="text-paper/40">{key}: </span>
                <span className="text-paper">{typeof val === "number" ? val.toFixed(4) : val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {approach.initialError && (
        <div className="border-t border-red-500/30 pt-3 mt-3">
          <p className="font-mono text-[10px] text-red-400 uppercase mb-1">Error</p>
          <p className="font-mono text-[11px] text-red-300/70 line-clamp-2">{approach.initialError}</p>
        </div>
      )}

      {/* Tuning iterations indicator */}
      {hasTuning && (
        <div className="flex gap-1 mt-3">
          {approach.tuningIterations.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-azure/60"
              title={`Iteration ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Code Modal Component
// ============================================

function CodeModal({
  approach,
  onClose,
}: {
  approach: ApproachState;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10 bg-[#0D1117] overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-white/20" />
            <div className="h-2 w-2 bg-white/20" />
            <div className="h-2 w-2 bg-white/20" />
            <span className="ml-4 font-mono text-xs text-paper/40">
              {approach.name.toLowerCase().replace(/\s+/g, "_")}.py
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-paper/50 hover:text-paper transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="font-mono text-sm text-paper/80 leading-relaxed whitespace-pre-wrap">
            {approach.code || "# No code generated yet"}
          </pre>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-paper/40">
              Framework: {approach.framework}
            </span>
            <span className="font-mono text-[10px] text-paper/40">
              Press ESC to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Report Modal Component
// ============================================

function ReportModal({
  report,
  recommendation,
  onClose,
}: {
  report: string;
  recommendation?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col border border-white/10 bg-obsidian overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-white/20" />
            <div className="h-2 w-2 bg-white/20" />
            <div className="h-2 w-2 bg-white/20" />
            <span className="ml-4 font-mono text-xs text-paper/40">
              report.md
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-paper/50 hover:text-paper transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Recommendation Banner */}
        {recommendation && (
          <div className="px-4 py-3 bg-green-950/20 border-b border-green-500/20">
            <p className="font-mono text-[10px] uppercase tracking-widest text-green-500 mb-1">
              Recommended Approach
            </p>
            <p className="font-mono text-sm text-green-400">{recommendation}</p>
          </div>
        )}

        {/* Report Content */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="font-mono text-sm text-paper/70 leading-relaxed whitespace-pre-wrap">
            {report}
          </pre>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-2 shrink-0">
          <span className="font-mono text-[10px] text-paper/40">
            Press ESC to close
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Dashboard Component
// ============================================

export default function DashboardPage() {
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
    <div className="flex h-screen overflow-hidden bg-obsidian">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col">
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b border-white/10">
          <span className="font-mono text-sm">
            <span className="text-azure">machine</span>
            <span className="text-paper/60">(</span>
            <span className="text-paper">learn</span>
            <span className="text-paper/60">);</span>
          </span>
        </div>

        {/* Runs List */}
        <div className="flex-1 overflow-y-auto py-2">
          <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper/40">
            Runs
          </p>
          {runs.length === 0 ? (
            <p className="px-4 font-mono text-xs text-paper/30">No runs yet</p>
          ) : (
            runs.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRun(r)}
                className={`w-full text-left px-4 py-2 font-mono text-xs transition-colors truncate ${
                  r === selectedRun
                    ? "bg-azure/10 text-azure border-l-2 border-l-azure"
                    : "text-paper/60 hover:text-paper hover:bg-white/5 border-l-2 border-l-transparent"
                }`}
              >
                {r}
              </button>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <a
            href="/"
            className="font-mono text-[10px] uppercase tracking-widest text-paper/40 hover:text-paper transition-colors"
          >
            ← Home
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="shrink-0 border-b border-white/10 px-6 py-3 flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-paper/40">Runs</span>
            <span className="text-paper/20">/</span>
            <span className="text-paper">{selectedRun || "—"}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="font-mono text-[10px] text-paper/40">
                {formatTs(lastUpdated.toISOString())}
              </span>
            )}

            {/* Live/Refresh Button */}
            <button
              onClick={() => {
                if (!isLive) setIsLive(true);
                fetchEvents(selectedRun);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 border font-mono text-[10px] uppercase tracking-widest transition-all ${
                isLive && !isComplete
                  ? "border-azure text-azure"
                  : "border-white/20 text-paper/60 hover:border-paper/40 hover:text-paper"
              }`}
            >
              <SpinnerIcon
                className={`w-3 h-3 ${
                  isLive && !isComplete ? "text-azure" : "text-paper/40"
                }`}
              />
              {isLive && !isComplete ? "LIVE" : "REFRESH"}
            </button>

            {/* Phase Badge */}
            {pipeline && <PhaseBadge phase={pipeline.phase} />}
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 overflow-y-auto p-6">
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
        <CodeModal approach={codeTarget} onClose={() => setCodeTarget(null)} />
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