"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { formatTs } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface FlowchartData {
  stages: StageData[];
  connections: ConnectionData[];
}

interface StageData {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  startedAt?: string;
  completedAt?: string;
  metrics?: Record<string, number>;
  details?: string;
  codeArtifacts?: CodeArtifact[];
  tuningSummary?: TuningApproachSummary[];
}

interface ConnectionData {
  from: string;
  to: string;
  active: boolean;
}

interface FinalReport {
  accuracy?: number;
  loss?: number;
  totalTimeGpu?: number;
  bestHyperparameters?: Record<string, unknown>;
  recommendation?: string;
  report?: string;
}

interface SwarmRun {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  current_phase: string;
  flowchart_data: FlowchartData | null;
  final_report: FinalReport | null;
  chat_messages: ChatMessage[];
  run_data?: {
    max_approaches?: number;
    max_parallel_agents?: number;
    max_tuning_iterations?: number;
    [key: string]: unknown;
  } | null;
}

interface NewRunStartPayload {
  swarmRunId: string;
  runName?: string;
  taskDescription: string;
}

interface ChatMessage {
  id: string;
  role: "system" | "agent" | "user";
  content: string;
  timestamp: string;
  stage?: string;
}

interface CodeArtifact {
  id: string;
  label: string;
  language?: string;
  code: string;
}

interface TuningRoundSummary {
  iteration: number;
  hyperparameters?: Record<string, unknown>;
  metrics?: Record<string, number>;
  error?: string | null;
}

interface TuningApproachSummary {
  approach: string;
  framework?: string;
  primary_metric?: string;
  initial?: number;
  best?: number;
  rounds: TuningRoundSummary[];
}

// ============================================
// Icon Components
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

function SendIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
    </svg>
  );
}

// ============================================
// Phase Badge Component
// ============================================

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; borderColor: string; textColor: string }> = {
    pending: { label: "PENDING", borderColor: "border-white/20", textColor: "text-paper/40" },
    prepare_dataset: { label: "PREPARING", borderColor: "border-azure/50", textColor: "text-azure" },
    load_modal: { label: "UPLOADING", borderColor: "border-violet-500/50", textColor: "text-violet-400" },
    plan_agent: { label: "PLANNING", borderColor: "border-amber-500/50", textColor: "text-amber-400" },
    implement_agent: { label: "IMPLEMENTING", borderColor: "border-orange-500/50", textColor: "text-orange-400" },
    initial_train: { label: "INITIAL TRAIN", borderColor: "border-lime-500/50", textColor: "text-lime-400" },
    tune_agent: { label: "TUNING", borderColor: "border-teal-500/50", textColor: "text-teal-400" },
    report_agent: { label: "REPORTING", borderColor: "border-cyan-500/50", textColor: "text-cyan-400" },
    complete: { label: "COMPLETE", borderColor: "border-green-500/50", textColor: "text-green-400" },
    error: { label: "ERROR", borderColor: "border-red-500/50", textColor: "text-red-400" },
    running: { label: "RUNNING", borderColor: "border-azure/50", textColor: "text-azure" },
  };
  const { label, borderColor, textColor } = map[phase] ?? map.pending;
  return (
    <span className={`px-2 py-1 border font-mono text-[10px] uppercase tracking-widest ${borderColor} ${textColor}`}>
      {label}
    </span>
  );
}

// ============================================
// Empty State Component
// ============================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <pre className="text-azure/60 text-[8px] leading-tight font-mono mb-6 select-none">
{`
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║      ┌─────────────────────────────┐      ║
    ║      │   ▄▄▄▄▄▄▄▄▄▄▄   ▄▄▄▄▄▄▄▄▄▄  │      ║
    ║      │  ████████████▄ ▄███████████ │      ║
    ║      │  █████████████████████████  │      ║
    ║      │   ▀████████████████████▀    │      ║
    ║      │     ▀████████████████▀      │      ║
    ║      │  ▄▄▄▄▄████████████▄▄▄▄▄     │      ║
    ║      │  ██████████████████████▀    │      ║
    ║      │   NEURAL_PROCESSOR_v2.1     │      ║
    ║      └─────────────────────────────┘      ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝
`}
      </pre>
      <div className="border border-white/10 p-6 max-w-md">
        <p className="font-mono text-sm text-paper mb-2">
          {">"} AWAITING_RUN_SELECTION
        </p>
        <p className="font-mono text-xs text-paper/50 leading-relaxed">
          Select a run from the sidebar to view the ML agent swarm execution trace.
        </p>
      </div>
    </div>
  );
}

// ============================================
// Chat Pane Component
// ============================================

function ChatPane({
  messages,
  isRunning,
}: {
  messages: ChatMessage[];
  isRunning: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleMessages = messages.filter(
    (msg) => !msg.content.trimStart().startsWith("[CODE]["),
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  const roleStyles: Record<string, { bg: string; label: string; textColor: string }> = {
    system: { bg: "bg-white/5", label: "SYS", textColor: "text-paper/60" },
    agent: { bg: "bg-azure/10", label: "AGT", textColor: "text-azure" },
    user: { bg: "bg-green-900/20", label: "USR", textColor: "text-green-400" },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${isRunning ? "bg-azure animate-pulse" : "bg-white/20"}`} />
            <span className="font-mono text-xs text-paper/60 uppercase tracking-widest">
              Agent Log
            </span>
          </div>
          {isRunning && (
            <span className="font-mono text-[10px] text-azure animate-pulse">
              STREAMING...
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-mono text-xs text-paper/30">No messages yet</p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const style = roleStyles[msg.role] ?? roleStyles.system;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${style.bg} border border-white/5 p-3`}
              >
                <div className="flex items-start gap-3">
                  <span className={`font-mono text-[10px] ${style.textColor} shrink-0`}>
                    [{style.label}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-paper leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {msg.stage && (
                        <span className="font-mono text-[9px] text-paper/30 uppercase">
                          {msg.stage}
                        </span>
                      )}
                      <span className="font-mono text-[9px] text-paper/20">
                        {formatTs(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Input (disabled - display only) */}
      <div className="shrink-0 px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-white/5">
          <span className="font-mono text-xs text-paper/30">{">"}</span>
          <span className="font-mono text-xs text-paper/20 italic">
            Agent-driven execution • Read-only
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Flow Tree Helpers
// ============================================

const STAGE_ORDER = [
  "prepare_dataset",
  "load_modal",
  "plan_agent",
  "implement_agent",
  "initial_train",
  "tune_agent",
  "report_agent",
];

const STAGE_LABELS: Record<string, string> = {
  prepare_dataset: "Prepare Dataset",
  load_modal: "Load to Modal Volume",
  plan_agent: "Planning",
  implement_agent: "Code Generation",
  initial_train: "Initial Training",
  tune_agent: "Hyperparameter Tuning",
  report_agent: "Report",
};

const STATUS_RANK: Record<SwarmRun["status"], number> = {
  pending: 0,
  running: 1,
  error: 2,
  complete: 3,
};

function parseIsoTimestamp(value?: string | null): number {
  if (!value) return -1;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : -1;
}

function stageRank(phase?: string | null): number {
  if (!phase) return -1;
  return STAGE_ORDER.indexOf(phase);
}

function flowStageStatusRank(run: SwarmRun | null | undefined, stageId: string): number {
  const stage = run?.flowchart_data?.stages?.find((s) => s.id === stageId);
  const status = stage?.status;
  if (status === "error") return 3;
  if (status === "complete") return 2;
  if (status === "active") return 1;
  return 0;
}

function compareFlowProgress(
  existing: SwarmRun | null | undefined,
  incoming: SwarmRun | null | undefined,
): number {
  if (!existing || !incoming) return 0;

  let incomingAhead = false;
  let existingAhead = false;

  for (const stageId of STAGE_ORDER) {
    const a = flowStageStatusRank(existing, stageId);
    const b = flowStageStatusRank(incoming, stageId);
    if (b > a) incomingAhead = true;
    if (a > b) existingAhead = true;
  }

  if (incomingAhead && !existingAhead) return 1;
  if (existingAhead && !incomingAhead) return -1;
  return 0;
}

function inferFlowPhase(flowchartData?: FlowchartData | null): string {
  const stages = flowchartData?.stages;
  if (!Array.isArray(stages) || stages.length === 0) return "pending";

  let highestComplete = -1;
  let highestActive = -1;
  let highestError = -1;

  for (const stage of stages) {
    const idx = stageRank(stage.id);
    if (idx < 0) continue;
    if (stage.status === "complete") highestComplete = Math.max(highestComplete, idx);
    if (stage.status === "active") highestActive = Math.max(highestActive, idx);
    if (stage.status === "error") highestError = Math.max(highestError, idx);
  }

  if (highestError >= 0) return STAGE_ORDER[highestError];
  if (highestActive >= 0) return STAGE_ORDER[highestActive];
  if (highestComplete >= 0) return STAGE_ORDER[highestComplete];
  return "pending";
}

function getFlowPhase(run: SwarmRun | null | undefined): string {
  if (!run) return "pending";

  const explicit = run.current_phase;
  const inferred = inferFlowPhase(run.flowchart_data);
  const explicitRank = stageRank(explicit);
  const inferredRank = stageRank(inferred);

  if (inferredRank > explicitRank) return inferred;
  if (explicitRank >= 0) return explicit;

  if (run.status === "complete") return "report_agent";
  return inferred;
}

function getPhaseBadgeValue(run: SwarmRun | null | undefined): string {
  if (!run) return "pending";
  if (run.status === "complete") return "complete";
  if (run.status === "error") return "error";
  return getFlowPhase(run);
}

function pickPreferredRun(
  existing: SwarmRun | null | undefined,
  incoming: SwarmRun | null | undefined,
): SwarmRun | null {
  if (!existing && !incoming) return null;
  if (!existing) return incoming ?? null;
  if (!incoming) return existing;

  const flowCompare = compareFlowProgress(existing, incoming);
  if (flowCompare > 0) return incoming;
  if (flowCompare < 0) return existing;

  const existingUpdated = parseIsoTimestamp(existing.updated_at);
  const incomingUpdated = parseIsoTimestamp(incoming.updated_at);
  if (incomingUpdated > existingUpdated) return incoming;
  if (incomingUpdated < existingUpdated) return existing;

  const existingRank = stageRank(getFlowPhase(existing));
  const incomingRank = stageRank(getFlowPhase(incoming));
  if (incomingRank > existingRank) return incoming;
  if (incomingRank < existingRank) return existing;

  const existingStatusRank = STATUS_RANK[existing.status] ?? 0;
  const incomingStatusRank = STATUS_RANK[incoming.status] ?? 0;
  if (incomingStatusRank > existingStatusRank) return incoming;
  if (incomingStatusRank < existingStatusRank) return existing;

  const existingMessages = existing.chat_messages?.length ?? 0;
  const incomingMessages = incoming.chat_messages?.length ?? 0;
  if (incomingMessages > existingMessages) return incoming;
  if (incomingMessages < existingMessages) return existing;

  return incoming;
}

function upsertRun(runs: SwarmRun[], incoming: SwarmRun): SwarmRun[] {
  let found = false;
  const next = runs.map((run) => {
    if (run.id !== incoming.id) return run;
    found = true;
    return pickPreferredRun(run, incoming) ?? run;
  });
  if (!found) {
    next.unshift(incoming);
  }
  return next;
}

function mergeRunLists(existing: SwarmRun[], incoming: SwarmRun[]): SwarmRun[] {
  let merged = [...existing];
  for (const run of incoming) {
    merged = upsertRun(merged, run);
  }
  return merged.sort(
    (a, b) => parseIsoTimestamp(b.created_at) - parseIsoTimestamp(a.created_at),
  );
}

function createOptimisticRun(payload: NewRunStartPayload, userId: string): SwarmRun {
  const now = new Date().toISOString();
  return {
    id: payload.swarmRunId,
    user_id: userId,
    created_at: now,
    updated_at: now,
    name: payload.runName?.trim() || `Run ${now}`,
    status: "running",
    current_phase: "prepare_dataset",
    flowchart_data: {
      stages: [
        { id: "prepare_dataset", label: "Prepare Dataset", status: "active", startedAt: now },
        { id: "load_modal", label: "Load to Modal Volume", status: "pending" },
        { id: "plan_agent", label: "Planning", status: "pending" },
        { id: "implement_agent", label: "Code Generation", status: "pending" },
        { id: "initial_train", label: "Initial Training", status: "pending" },
        { id: "tune_agent", label: "Hyperparameter Tuning", status: "pending" },
        { id: "report_agent", label: "Report", status: "pending" },
      ],
      connections: [
        { from: "prepare_dataset", to: "load_modal", active: false },
        { from: "load_modal", to: "plan_agent", active: false },
        { from: "plan_agent", to: "implement_agent", active: false },
        { from: "implement_agent", to: "initial_train", active: false },
        { from: "initial_train", to: "tune_agent", active: false },
        { from: "tune_agent", to: "report_agent", active: false },
      ],
    },
    final_report: null,
    chat_messages: [
      {
        id: `local-${payload.swarmRunId}`,
        role: "system",
        content: "Run created. Waiting for live updates...",
        timestamp: now,
        stage: "prepare_dataset",
      },
    ],
    run_data: {
      task_description: payload.taskDescription,
      submitted_from: "dashboard-next",
      optimistic: true,
    },
  };
}

function formatDurationSeconds(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const seconds = (end - start) / 1000;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}m ${remainder.toFixed(1)}s`;
}

function formatMetricValue(value: number): string {
  if (Number.isInteger(value)) return `${value}`;
  if (Math.abs(value) >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

function looksLikeCode(content: string): boolean {
  if (!content.trim()) return false;
  if (content.includes("```") || content.includes("def ") || content.includes("class ")) {
    return true;
  }
  return content.includes("import ") || content.includes("from ");
}

function extractCode(content: string): string {
  const fence = /```(?:[a-zA-Z]+)?\n([\s\S]*?)```/m.exec(content);
  if (fence?.[1]) return fence[1].trim();
  return content.trim();
}

function extractCodeArtifacts(
  stageId: string,
  stageLabel: string,
  stageCodeArtifacts: CodeArtifact[] | undefined,
  stageDetails: string | undefined,
  stageMessages: ChatMessage[],
  finalReport: FinalReport | null,
): CodeArtifact[] {
  const artifacts: CodeArtifact[] = [];

  if (Array.isArray(stageCodeArtifacts) && stageCodeArtifacts.length > 0) {
    for (const artifact of stageCodeArtifacts) {
      if (!artifact?.code) continue;
      artifacts.push({
        id: `${stageId}-artifact-${artifact.label}`,
        label: artifact.label,
        language: artifact.language,
        code: artifact.code,
      });
    }
    return artifacts;
  }

  for (const msg of stageMessages) {
    const marker = msg.content.match(/^\[CODE\]\[([^\]]+)\]/m);
    if (!marker) continue;
    const code = extractCode(msg.content);
    if (!code) continue;
    artifacts.push({
      id: `${stageId}-${msg.id}`,
      label: marker[1],
      language: "python",
      code,
    });
  }

  if (artifacts.length === 0 && stageDetails && looksLikeCode(stageDetails)) {
    artifacts.push({
      id: `${stageId}-details`,
      label: stageLabel,
      language: "python",
      code: extractCode(stageDetails),
    });
  }

  if (
    artifacts.length === 0 &&
    stageId === "report_agent" &&
    typeof finalReport?.report === "string" &&
    looksLikeCode(finalReport.report)
  ) {
    artifacts.push({
      id: `${stageId}-report`,
      label: "final_report.md",
      language: "markdown",
      code: extractCode(finalReport.report),
    });
  }

  return artifacts;
}

function normalizeReportMarkdown(report: string): string {
  const trimmed = report.trim();
  const fenced = /^```(?:markdown|md)?\n([\s\S]*?)\n```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? report;
}

function scoreToPercent(value?: number): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value >= 0 && value <= 1) return value * 100;
  return value;
}

function tokenizePythonLine(line: string): Array<{ text: string; cls: string }> {
  const keyword = /\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|async|await|pass|break|continue|yield|lambda|in|is|not|and|or|None|True|False)\b/g;
  if (line.trimStart().startsWith("#")) {
    return [{ text: line, cls: "text-emerald-400" }];
  }
  const quoteMatch = line.match(/(['"][^'"]*['"])/g);
  let transformed = line;
  if (quoteMatch) {
    for (const q of quoteMatch) {
      transformed = transformed.replace(q, `@@STR@@${q}@@END@@`);
    }
  }
  transformed = transformed.replace(keyword, "@@KW@@$1@@END@@");
  const pieces = transformed.split(/(@@KW@@.*?@@END@@|@@STR@@.*?@@END@@)/g).filter(Boolean);
  return pieces.map((piece) => {
    if (piece.startsWith("@@KW@@")) {
      return { text: piece.replace(/^@@KW@@|@@END@@$/g, ""), cls: "text-sky-300" };
    }
    if (piece.startsWith("@@STR@@")) {
      return { text: piece.replace(/^@@STR@@|@@END@@$/g, ""), cls: "text-amber-300" };
    }
    return { text: piece, cls: "text-zinc-200" };
  });
}

function renderCodeLine(line: string, language?: string): Array<{ text: string; cls: string }> {
  if (language === "python") return tokenizePythonLine(line);
  if (language === "markdown") {
    if (line.startsWith("#")) return [{ text: line, cls: "text-cyan-300" }];
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return [{ text: line, cls: "text-violet-300" }];
    }
    if (line.includes("|")) return [{ text: line, cls: "text-emerald-300" }];
  }
  return [{ text: line, cls: "text-zinc-200" }];
}

function isSameRunSnapshot(a: SwarmRun | null | undefined, b: SwarmRun | null | undefined): boolean {
  if (!a || !b) return false;
  const preferred = pickPreferredRun(a, b);
  return preferred === a;
}

function normalizeStatus(
  stage: StageData,
  stageId: string,
  currentPhase: string,
): "pending" | "active" | "complete" | "error" {
  // Older runs may never emit prepare_dataset updates; infer completion once we move on.
  if (stageId === "prepare_dataset" && stage.status === "pending") {
    const currentIdx = STAGE_ORDER.indexOf(currentPhase);
    if (currentIdx > 0) return "complete";
  }
  if (stage.status) return stage.status;
  const currentIdx = STAGE_ORDER.indexOf(currentPhase);
  const stageIdx = STAGE_ORDER.indexOf(stageId);
  if (stageIdx < currentIdx) return "complete";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

function inferParallelTotal(
  stageId: string,
  runData: SwarmRun["run_data"],
  stageMessages: ChatMessage[],
): number {
  if (stageId !== "implement_agent" && stageId !== "initial_train" && stageId !== "tune_agent") {
    return 1;
  }

  const configured =
    typeof runData?.max_approaches === "number" && Number.isFinite(runData.max_approaches)
      ? Math.max(1, Math.floor(runData.max_approaches))
      : null;
  if (configured) return configured;

  for (const msg of stageMessages) {
    const m = msg.content.match(/(\d+)\s*\/\s*(\d+)\s+successful/i);
    if (m?.[2]) {
      const parsed = Number.parseInt(m[2], 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  return 3;
}

function inferParallelCompleted(
  status: "pending" | "active" | "complete" | "error",
  metrics: Record<string, number>,
  stageMessages: ChatMessage[],
  total: number,
): number {
  if (status === "pending") return 0;
  if (status === "complete") return total;

  const metricValue = metrics.successful_runs;
  if (typeof metricValue === "number" && Number.isFinite(metricValue)) {
    return Math.max(0, Math.min(total, Math.floor(metricValue)));
  }

  for (const msg of stageMessages) {
    const m = msg.content.match(/(\d+)\s*\/\s*(\d+)\s+successful/i);
    if (m?.[1]) {
      const parsed = Number.parseInt(m[1], 10);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(total, parsed));
      }
    }
  }

  if (status === "error") return 0;
  return 0;
}

function CodePreviewModal({
  title,
  code,
  language,
  onClose,
}: {
  title: string;
  code: string;
  language?: string;
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
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10 bg-obsidian overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="font-mono text-xs text-paper/60">{title}</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-paper/50 hover:text-paper transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="border border-zinc-700 bg-zinc-950/80 overflow-auto">
            {code.split("\n").map((line, idx) => {
              const segments = renderCodeLine(line, language);
              return (
                <div key={idx} className="grid grid-cols-[56px_1fr] font-mono text-xs leading-6">
                  <span className="select-none border-r border-zinc-800 bg-zinc-900/70 px-3 text-zinc-500 text-right">
                    {idx + 1}
                  </span>
                  <span className="px-3 whitespace-pre">
                    {segments.map((segment, segIdx) => (
                      <span key={segIdx} className={segment.cls}>
                        {segment.text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Flow Tree Component
// ============================================

function FlowTree({
  flowchartData,
  currentPhase,
  chatMessages,
  finalReport,
  runData,
}: {
  flowchartData: FlowchartData | null;
  currentPhase: string;
  chatMessages: ChatMessage[];
  finalReport: FinalReport | null;
  runData: SwarmRun["run_data"];
}) {
  const [activeCode, setActiveCode] = useState<{ title: string; code: string; language?: string } | null>(null);

  const sourceStages = flowchartData?.stages ?? [];
  const orderedStages: StageData[] = STAGE_ORDER.map((id) => {
    const found = sourceStages.find((stage) => stage.id === id);
    if (found) return found;
    return {
      id,
      label: STAGE_LABELS[id] ?? id,
      status: "pending",
    };
  });

  const currentPhaseIdx = STAGE_ORDER.indexOf(currentPhase);
  const maxVisibleIdx = currentPhaseIdx >= 0 ? currentPhaseIdx : 0;
  const visibleStages = orderedStages.filter((stage, idx) => {
    const status = normalizeStatus(stage, stage.id, currentPhase);
    if (status !== "pending") return true;
    return idx <= maxVisibleIdx;
  });

  return (
    <>
      <div className="relative pl-10">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />

        <div className="space-y-4">
          {visibleStages.map((stage, index) => {
            const status = normalizeStatus(stage, stage.id, currentPhase);
            const stageMessages = chatMessages.filter((msg) => msg.stage === stage.id);
            const stageDuration = formatDurationSeconds(stage.startedAt, stage.completedAt);

            const metricsFromStage = stage.metrics ?? {};
            const metricsFromReport: Record<string, number> =
              stage.id === "report_agent"
                ? {
                    ...(typeof finalReport?.accuracy === "number" ? { accuracy: finalReport.accuracy } : {}),
                    ...(typeof finalReport?.loss === "number" ? { loss: finalReport.loss } : {}),
                    ...(typeof finalReport?.totalTimeGpu === "number"
                      ? { totalTimeGpu: finalReport.totalTimeGpu }
                      : {}),
                  }
                : {};
            const metrics = { ...metricsFromStage, ...metricsFromReport };

            const stageLabel = stage.label || STAGE_LABELS[stage.id] || stage.id;
            const codeArtifacts = extractCodeArtifacts(
              stage.id,
              stageLabel,
              stage.codeArtifacts,
              stage.details,
              stageMessages,
              finalReport,
            );
            const tuningSummary = stage.tuningSummary ?? [];

            const totalParallel = inferParallelTotal(stage.id, runData, stageMessages);
            const completedParallel = inferParallelCompleted(
              status,
              metrics,
              stageMessages,
              totalParallel,
            );
            const showParallel =
              (stage.id === "implement_agent" || stage.id === "initial_train" || stage.id === "tune_agent") && totalParallel > 1;
            const visibleWorkers = Math.min(totalParallel, 8);
            const hiddenWorkers = Math.max(0, totalParallel - visibleWorkers);
            const initialTrainSuccess =
              stage.id === "initial_train" && typeof metrics.successful_runs === "number"
                ? Math.max(0, Math.floor(metrics.successful_runs))
                : null;

            const statusDotClass =
              status === "complete"
                ? "bg-green-500"
                : status === "active"
                ? "bg-azure animate-pulse"
                : status === "error"
                ? "bg-red-500"
                : "bg-white/20";

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                className="relative"
              >
                <div className={`absolute -left-8 top-3 h-3 w-3 rounded-full ${statusDotClass}`} />

                <div className="border border-white/10 bg-white/[0.02]">
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-paper/30">{`${index + 1}.`}</span>
                        <span className="font-mono text-xs text-paper">
                          {stageLabel}
                        </span>
                        {status === "active" && <SpinnerIcon className="w-3 h-3 text-azure" />}
                        <PhaseBadge phase={status === "active" ? "running" : status} />
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[10px] text-paper/40">
                        <span>start: {stage.startedAt ? formatTs(stage.startedAt) : "-"}</span>
                        <span>end: {stage.completedAt ? formatTs(stage.completedAt) : "-"}</span>
                        {stageDuration && <span>duration: {stageDuration}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex flex-wrap items-center gap-2">
                    {codeArtifacts.map((artifact) => (
                      <button
                        key={artifact.id}
                        onClick={() =>
                          setActiveCode({
                            title: `${stageLabel} - ${artifact.label}`,
                            code: artifact.code,
                            language: artifact.language,
                          })
                        }
                        className="border border-azure/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-azure transition-colors hover:bg-azure/10"
                      >
                        View Code: {artifact.label}
                      </button>
                    ))}
                  </div>

                  {showParallel && (
                    <div className="px-4 pb-3">
                      <div className="border border-white/10 p-3 bg-white/[0.02]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-paper/40">
                            {stage.id === "tune_agent" ? "Parallel Tuning Tracks" : "Parallel Agent Workers"}
                          </span>
                          <span className="font-mono text-[10px] text-paper/50">
                            {completedParallel}/{totalParallel} completed
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {Array.from({ length: visibleWorkers }).map((_, laneIndex) => {
                            const laneDone = laneIndex < completedParallel;
                            const laneRunning = !laneDone && status === "active";
                            const laneClass = laneDone
                              ? "bg-green-500/30 border-green-500/50 text-green-400"
                              : laneRunning
                              ? "bg-azure/20 border-azure/50 text-azure"
                              : "bg-white/5 border-white/10 text-paper/40";
                            return (
                              <div
                                key={`${stage.id}-lane-${laneIndex}`}
                                className={`border px-2 py-1 font-mono text-[10px] ${laneClass}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>agent {laneIndex + 1}</span>
                                  {laneRunning && (
                                    <span className="flex items-center gap-1 text-azure">
                                      <SpinnerIcon className="w-3 h-3" />
                                      live
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {hiddenWorkers > 0 && (
                          <p className="mt-2 font-mono text-[10px] text-paper/35">
                            +{hiddenWorkers} more workers
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {stage.id === "initial_train" && initialTrainSuccess !== null && (
                    <div className="px-4 pb-3">
                      <div className="border border-lime-500/30 bg-lime-500/10 px-3 py-2 font-mono text-[10px] text-lime-300">
                        First-pass success metric: {initialTrainSuccess}/{totalParallel} approaches completed
                      </div>
                    </div>
                  )}

                  {stage.id === "tune_agent" && tuningSummary.length > 0 && (
                    <div className="px-4 pb-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {tuningSummary.map((summary) => {
                        const primaryMetric = "accuracy";
                        const baseline = scoreToPercent(summary.initial);
                        const best = scoreToPercent(summary.best);
                        const allScores = [
                          ...(baseline !== null ? [baseline] : []),
                          ...(best !== null ? [best] : []),
                          ...summary.rounds
                            .map((round) => scoreToPercent(round.metrics?.[primaryMetric]))
                            .filter((value): value is number => value !== null),
                        ];
                        const maxScore = allScores.length > 0 ? Math.max(...allScores) : 100;
                        return (
                          <div key={summary.approach} className="border border-white/10 bg-white/[0.02] p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-mono text-xs text-paper">{summary.approach}</div>
                              <div className="font-mono text-[10px] text-paper/50">best {best !== null ? `${best.toFixed(2)}%` : "-"}</div>
                            </div>

                            {baseline !== null && (
                              <div className="mb-2">
                                <div className="flex items-center justify-between font-mono text-[10px] text-paper/45 mb-1">
                                  <span>Initial</span>
                                  <span>{baseline.toFixed(2)}%</span>
                                </div>
                                <div className="h-2 bg-white/10 overflow-hidden">
                                  <div className="h-full bg-emerald-400" style={{ width: `${Math.max(2, (baseline / maxScore) * 100)}%` }} />
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              {summary.rounds.map((round) => {
                                const roundScore = scoreToPercent(round.metrics?.[primaryMetric]);
                                return (
                                  <div key={`${summary.approach}-${round.iteration}`}>
                                    <div className="flex items-center justify-between font-mono text-[10px] text-paper/45 mb-1">
                                      <span>Round {round.iteration}</span>
                                      <span>{roundScore !== null ? `${roundScore.toFixed(2)}%` : "-"}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 overflow-hidden">
                                      <div className="h-full bg-violet-400" style={{ width: `${Math.max(2, roundScore !== null ? (roundScore / maxScore) * 100 : 2)}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {activeCode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CodePreviewModal
              title={activeCode.title}
              code={activeCode.code}
              language={activeCode.language}
              onClose={() => setActiveCode(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================
// Results Panel Component
// ============================================

function ResultsPanel({ report }: { report: FinalReport | null }) {
  if (!report) {
    return (
      <div className="border border-white/10 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-paper/40 mb-3">
          Final Results
        </p>
        <p className="font-mono text-xs text-paper/30">
          Awaiting pipeline completion...
        </p>
      </div>
    );
  }

  return (
    <div className="border border-green-500/30 bg-green-950/10 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-green-400 mb-4">
        Final Results
      </p>

      <div className="border border-white/10 p-3">
        <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">
          Final Accuracy
        </p>
        <p className="font-mono text-xl text-green-400">
          {typeof report.accuracy === "number"
            ? `${(report.accuracy * 100).toFixed(2)}%`
            : "—"}
        </p>
      </div>

      {/* Recommendation */}
      {report.recommendation && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-2">
            Recommendation
          </p>
          <p className="font-mono text-sm text-green-400">
            {report.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

function inlineFormat(text: string): Array<string | JSX.Element> {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-zinc-100 font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-zinc-800 text-violet-300 text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdown(md: string): JSX.Element {
  const normalized = normalizeReportMarkdown(md);
  const lines = normalized.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || "text";
      const block: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        block.push(lines[i]);
        i += 1;
      }
      elements.push(
        <div key={`code-${i}`} className="my-3 border border-zinc-700 bg-zinc-950/80 overflow-auto">
          {block.map((codeLine, idx) => {
            const segments = renderCodeLine(codeLine, language);
            return (
              <div key={idx} className="grid grid-cols-[56px_1fr] font-mono text-xs leading-6">
                <span className="select-none border-r border-zinc-800 bg-zinc-900/70 px-3 text-zinc-500 text-right">
                  {idx + 1}
                </span>
                <span className="px-3 whitespace-pre">
                  {segments.map((segment, segIdx) => (
                    <span key={segIdx} className={segment.cls}>
                      {segment.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold text-zinc-100 mt-5 mb-2">
          {line.slice(2)}
        </h1>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-semibold text-zinc-200 mt-4 mb-1.5 border-b border-zinc-800 pb-1">
          {line.slice(3)}
        </h2>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-zinc-300 mt-3 mb-1">
          {line.slice(4)}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (line.includes("|") && lines[i + 1]?.includes("---")) {
      const headers = line.split("|").filter((cell) => cell.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").filter((cell) => cell.trim()));
        i += 1;
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {headers.map((header, hi) => (
                  <th key={hi} className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700 bg-zinc-800/60">
                    {header.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-300">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [line.slice(2)];
      i += 1;
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      elements.push(
        <ul key={`list-${i}`} className="my-1.5 space-y-0.5 list-none">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-sm text-zinc-300">
              <span className="text-violet-500 shrink-0">·</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      i += 1;
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm text-zinc-300 leading-relaxed">
        {inlineFormat(line)}
      </p>,
    );
    i += 1;
  }

  return <>{elements}</>;
}

// ============================================
// Report Modal Component
// ============================================

function ReportModal({
  report,
  onClose,
}: {
  report: FinalReport;
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
              final_report.md
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
        {report.recommendation && (
          <div className="px-4 py-3 bg-green-950/20 border-b border-green-500/20">
            <p className="font-mono text-[10px] uppercase tracking-widest text-green-500 mb-1">
              Recommended Approach
            </p>
            <p className="font-mono text-sm text-green-400">{report.recommendation}</p>
          </div>
        )}

        {/* Report Content */}
        <div className="flex-1 overflow-auto p-4">
          {renderMarkdown(report.report || "No detailed report available.")}
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
  const supabase = createBrowserSupabaseClient();

  const [runs, setRuns] = useState<SwarmRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<SwarmRun | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const hydrateRunById = useCallback(
    async (runId: string) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("swarm_runs")
        .select("*")
        .eq("id", runId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return;
      const fetched = data as SwarmRun;
      setRuns((prev) => upsertRun(prev, fetched));
      setCurrentRun((prev) => pickPreferredRun(prev, fetched));
      setLastUpdated(new Date());
    },
    [supabase, userId],
  );

  const handleRunStarted = useCallback(
    (payload: NewRunStartPayload) => {
      if (!userId) {
        setSelectedRunId(payload.swarmRunId);
        return;
      }

      const optimistic = createOptimisticRun(payload, userId);
      setRuns((prev) => upsertRun(prev, optimistic));
      setCurrentRun((prev) => pickPreferredRun(prev, optimistic));
      setSelectedRunId(payload.swarmRunId);
      setLastUpdated(new Date());
      void hydrateRunById(payload.swarmRunId);
    },
    [hydrateRunById, userId],
  );

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, [supabase]);

  // Load runs from Supabase
  useEffect(() => {
    if (!userId) return;

    const loadRuns = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("swarm_runs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading runs:", error);
      } else {
        const fetched = (data || []) as SwarmRun[];
        setRuns((prev) => mergeRunLists(prev, fetched));
        if (fetched.length > 0 && !selectedRunId) {
          setSelectedRunId(fetched[0].id);
        }
      }
      setIsLoading(false);
    };

    loadRuns();
  }, [userId, supabase, selectedRunId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("swarm_runs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "swarm_runs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Realtime update:", payload);

          if (payload.eventType === "INSERT") {
            const newRun = payload.new as SwarmRun;
            setLastUpdated(new Date());
            setRuns((prev) => upsertRun(prev, newRun));
          } else if (payload.eventType === "UPDATE") {
            const updatedRun = payload.new as SwarmRun;
            setRuns((prev) => {
              const existing = prev.find((r) => r.id === updatedRun.id) ?? null;
              if (isSameRunSnapshot(existing, updatedRun)) return prev;
              setLastUpdated(new Date());
              return upsertRun(prev, updatedRun);
            });
            if (selectedRunId === updatedRun.id) {
              setCurrentRun((prev) => pickPreferredRun(prev, updatedRun));
            }
          } else if (payload.eventType === "DELETE") {
            const deletedRun = payload.old as { id: string };
            setLastUpdated(new Date());
            setRuns((prev) => prev.filter((r) => r.id !== deletedRun.id));
            if (selectedRunId === deletedRun.id) {
              setSelectedRunId(null);
              setCurrentRun(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedRunId, supabase]);

  // Fallback refresh while a run is live (helps when realtime delivery is delayed).
  useEffect(() => {
    if (!userId || !selectedRunId) return;

    const shouldPoll =
      !currentRun ||
      currentRun?.status === "running" ||
      (currentRun?.status === "complete" && !currentRun?.final_report?.report);
    if (!shouldPoll) return;

    const pollRun = async () => {
      const { data, error } = await supabase
        .from("swarm_runs")
        .select("*")
        .eq("id", selectedRunId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data) return;

      const updatedRun = data as SwarmRun;
      if (isSameRunSnapshot(currentRun, updatedRun)) return;
      setLastUpdated(new Date());
      setRuns((prev) => {
        const existing = prev.find((r) => r.id === updatedRun.id) ?? null;
        if (isSameRunSnapshot(existing, updatedRun)) return prev;
        return upsertRun(prev, updatedRun);
      });
      setCurrentRun((prev) => pickPreferredRun(prev, updatedRun));
    };

    pollRun();
    const id = window.setInterval(pollRun, 2000);
    return () => window.clearInterval(id);
  }, [userId, selectedRunId, currentRun?.status, currentRun?.final_report?.report, supabase]);

  // Update current run when selection changes
  useEffect(() => {
    if (selectedRunId) {
      const run = runs.find((r) => r.id === selectedRunId);
      setCurrentRun(run ?? null);
    } else {
      setCurrentRun(null);
    }
  }, [selectedRunId, runs]);

  const isRunning = currentRun?.status === "running";
  const currentPhase = getPhaseBadgeValue(currentRun);
  const flowPhase = getFlowPhase(currentRun);
  const chatMessages = currentRun?.chat_messages || [];

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

        <NewRunForm onStarted={handleRunStarted} />

        {/* Runs List */}
        <div className="flex-1 overflow-y-auto py-2">
          <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper/40">
            Swarm Runs
          </p>
          {isLoading ? (
            <div className="px-4 flex items-center gap-2">
              <SpinnerIcon className="w-3 h-3 text-azure" />
              <span className="font-mono text-xs text-paper/30">Loading...</span>
            </div>
          ) : runs.length === 0 ? (
            <p className="px-4 font-mono text-xs text-paper/30">No runs yet</p>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full text-left px-4 py-2 font-mono text-xs transition-colors truncate ${
                  run.id === selectedRunId
                    ? "bg-azure/10 text-azure border-l-2 border-l-azure"
                    : "text-paper/60 hover:text-paper hover:bg-white/5 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 shrink-0 ${
                      run.status === "running"
                        ? "bg-azure animate-pulse"
                        : run.status === "complete"
                        ? "bg-green-500"
                        : run.status === "error"
                        ? "bg-red-500"
                        : "bg-white/20"
                    }`}
                  />
                  <span className="truncate">{run.name || run.id.slice(0, 8)}</span>
                </div>
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

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="shrink-0 border-b border-white/10 px-6 py-3 flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-paper/40">Runs</span>
            <span className="text-paper/20">/</span>
            <span className="text-paper">
              {currentRun?.name || selectedRunId?.slice(0, 8) || "—"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="font-mono text-[10px] text-paper/40">
                {formatTs(lastUpdated.toISOString())}
              </span>
            )}

            {/* Status Indicator */}
            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-1.5 border border-azure text-azure">
                <SpinnerIcon className="w-3 h-3" />
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  LIVE
                </span>
              </div>
            )}

            {/* Phase Badge */}
            {currentRun && <PhaseBadge phase={currentPhase} />}
          </div>
        </header>

        {/* Split View Content */}
        {!currentRun ? (
          <main className="flex-1 overflow-y-auto">
            <EmptyState />
          </main>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane - Chat */}
            <div className="w-[400px] shrink-0 border-r border-white/10 flex flex-col">
              <ChatPane messages={chatMessages} isRunning={isRunning} />
            </div>

            {/* Right Pane - Flowchart & Results */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Flowchart */}
              <div className="border border-white/10 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-paper/40 mb-4">
                  Agent Swarm Flow
                </p>
                <FlowTree
                  flowchartData={currentRun.flowchart_data}
                  currentPhase={flowPhase}
                  chatMessages={chatMessages}
                  finalReport={currentRun.final_report}
                  runData={currentRun.run_data ?? null}
                />
              </div>

              {/* Results Panel */}
              <ResultsPanel report={currentRun.final_report} />

              {/* View Report Button */}
              {currentRun.final_report?.report && (
                <button
                  onClick={() => setShowReport(true)}
                  className="w-full border border-green-500/50 px-4 py-3 font-mono text-xs uppercase tracking-widest text-green-400 transition-all hover:bg-green-500/10"
                >
                  View Full Report
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && currentRun?.final_report && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ReportModal
              report={currentRun.final_report}
              onClose={() => setShowReport(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewRunForm({
  onStarted,
}: {
  onStarted: (payload: NewRunStartPayload) => void;
}) {
  const [runName, setRunName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [labelsFile, setLabelsFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      if (!taskDescription.trim()) {
        setError("Task prompt is required.");
        return;
      }
      if (!datasetFile) {
        setError("Dataset file is required.");
        return;
      }
      if (!labelsFile) {
        setError("Labels file is required.");
        return;
      }

      try {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append("runName", runName.trim());
        formData.append("taskDescription", taskDescription.trim());
        formData.append("dataset", datasetFile);
        formData.append("labels", labelsFile);

        const res = await fetch("/api/runs/start", {
          method: "POST",
          body: formData,
        });
        const payload = await res.json();

        if (!res.ok) {
          const detailText =
            payload && typeof payload === "object" && "details" in payload && payload.details
              ? ` ${String(payload.details)}`
              : "";
          throw new Error(`${payload.error || "Failed to start run."}${detailText}`);
        }

        onStarted({
          swarmRunId: payload.swarmRunId,
          runName: runName.trim(),
          taskDescription: taskDescription.trim(),
        });
        setRunName("");
        setTaskDescription("");
        setDatasetFile(null);
        setLabelsFile(null);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : "Failed to start run.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [datasetFile, labelsFile, onStarted, runName, taskDescription]
  );

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 border-b border-white/10 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-paper/40">
        Start New Run
      </p>

      <input
        type="text"
        value={runName}
        onChange={(e) => setRunName(e.target.value)}
        placeholder="Run name (optional)"
        className="w-full border border-white/20 bg-transparent px-2 py-2 font-mono text-[11px] text-paper placeholder:text-paper/30 focus:border-azure focus:outline-none"
      />

      <textarea
        value={taskDescription}
        onChange={(e) => setTaskDescription(e.target.value)}
        placeholder="Task prompt"
        required
        rows={3}
        className="w-full resize-none border border-white/20 bg-transparent px-2 py-2 font-mono text-[11px] text-paper placeholder:text-paper/30 focus:border-azure focus:outline-none"
      />

      <div className="space-y-2">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-paper/40">
          Dataset File
        </label>
        <input
          type="file"
          required
          onChange={(e) => setDatasetFile(e.target.files?.[0] ?? null)}
          className="w-full border border-white/20 bg-transparent px-2 py-1.5 font-mono text-[11px] text-paper file:mr-2 file:border-0 file:bg-azure file:px-2 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-widest file:text-obsidian"
        />
      </div>

      <div className="space-y-2">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-paper/40">
          Labels File
        </label>
        <input
          type="file"
          required
          onChange={(e) => setLabelsFile(e.target.files?.[0] ?? null)}
          className="w-full border border-white/20 bg-transparent px-2 py-1.5 font-mono text-[11px] text-paper file:mr-2 file:border-0 file:bg-azure file:px-2 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-widest file:text-obsidian"
        />
      </div>

      {error && (
        <p className="border border-red-500/50 px-2 py-2 font-mono text-[10px] text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full border border-azure bg-azure px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-obsidian transition-colors hover:bg-azure/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Starting..." : "Start Run"}
      </button>
    </form>
  );
}