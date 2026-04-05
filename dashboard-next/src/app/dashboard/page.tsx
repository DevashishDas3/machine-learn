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
}

interface ChatMessage {
  id: string;
  role: "system" | "agent" | "user";
  content: string;
  timestamp: string;
  stage?: string;
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-mono text-xs text-paper/30">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
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
// Stage Node Positions for Flowchart
// ============================================

const STAGE_CONFIG: Record<string, { x: number; y: number; label: string }> = {
  prepare_dataset: { x: 400, y: 50, label: "Prepare Dataset" },
  load_modal: { x: 400, y: 130, label: "Load to Modal Volume" },
  plan_agent: { x: 400, y: 210, label: "PlanAgent" },
  implement_agent: { x: 400, y: 290, label: "ImplementationAgent" },
  tune_agent: { x: 400, y: 370, label: "TuningAgent" },
  report_agent: { x: 400, y: 450, label: "ReportAgent" },
};

const CONNECTIONS: Array<[string, string]> = [
  ["prepare_dataset", "load_modal"],
  ["load_modal", "plan_agent"],
  ["plan_agent", "implement_agent"],
  ["implement_agent", "tune_agent"],
  ["tune_agent", "report_agent"],
];

// ============================================
// Flowchart Component (SVG-based)
// ============================================

function Flowchart({
  flowchartData,
  currentPhase,
}: {
  flowchartData: FlowchartData | null;
  currentPhase: string;
}) {
  const getStageStatus = (stageId: string): "pending" | "active" | "complete" | "error" => {
    if (flowchartData?.stages) {
      const stage = flowchartData.stages.find((s) => s.id === stageId);
      if (stage) return stage.status;
    }
    
    const stageOrder = Object.keys(STAGE_CONFIG);
    const currentIdx = stageOrder.indexOf(currentPhase);
    const stageIdx = stageOrder.indexOf(stageId);
    
    if (stageIdx < currentIdx) return "complete";
    if (stageIdx === currentIdx) return "active";
    return "pending";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return { fill: "#10B981", stroke: "#10B981", text: "#F9F8F7" };
      case "active":
        return { fill: "#0080FE", stroke: "#0080FE", text: "#F9F8F7" };
      case "error":
        return { fill: "#EF4444", stroke: "#EF4444", text: "#F9F8F7" };
      default:
        return { fill: "#1a1f23", stroke: "#ffffff1a", text: "#F9F8F780" };
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 800 520" className="w-full h-auto max-h-[400px]">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowActive" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connections */}
        {CONNECTIONS.map(([from, to], idx) => {
          const fromConfig = STAGE_CONFIG[from];
          const toConfig = STAGE_CONFIG[to];
          const fromStatus = getStageStatus(from);
          const toStatus = getStageStatus(to);
          const isActive = fromStatus === "complete" || fromStatus === "active";

          return (
            <g key={`conn-${idx}`}>
              <motion.line
                x1={fromConfig.x}
                y1={fromConfig.y + 25}
                x2={toConfig.x}
                y2={toConfig.y - 25}
                stroke={isActive ? "#0080FE" : "#ffffff1a"}
                strokeWidth={isActive ? 2 : 1}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              />
              {isActive && (
                <motion.circle
                  r={3}
                  fill="#0080FE"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    cx: [fromConfig.x, toConfig.x],
                    cy: [fromConfig.y + 25, toConfig.y - 25],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}
            </g>
          );
        })}

        {/* Stage Nodes */}
        {Object.entries(STAGE_CONFIG).map(([id, config]) => {
          const status = getStageStatus(id);
          const colors = getStatusColor(status);
          const isActive = status === "active";

          return (
            <motion.g
              key={id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Node Box */}
              <motion.rect
                x={config.x - 100}
                y={config.y - 20}
                width={200}
                height={40}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isActive ? 2 : 1}
                filter={isActive ? "url(#glowActive)" : undefined}
                animate={
                  isActive
                    ? {
                        strokeOpacity: [1, 0.5, 1],
                      }
                    : {}
                }
                transition={
                  isActive
                    ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                    : {}
                }
              />

              {/* Label */}
              <text
                x={config.x}
                y={config.y + 5}
                textAnchor="middle"
                fill={colors.text}
                className="font-mono text-xs"
                style={{ fontSize: "12px", fontFamily: "monospace" }}
              >
                {config.label}
              </text>

              {/* Status indicator */}
              {status === "complete" && (
                <motion.text
                  x={config.x + 90}
                  y={config.y + 5}
                  textAnchor="middle"
                  fill="#10B981"
                  style={{ fontSize: "10px" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  ✓
                </motion.text>
              )}

              {isActive && (
                <motion.circle
                  cx={config.x - 90}
                  cy={config.y}
                  r={4}
                  fill="#0080FE"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.g>
          );
        })}

        {/* A100 Cluster Label */}
        <text
          x={620}
          y={290}
          fill="#0080FE40"
          className="font-mono"
          style={{ fontSize: "10px", fontFamily: "monospace" }}
        >
          A100 Cluster
        </text>
      </svg>
    </div>
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

      <div className="grid grid-cols-2 gap-4">
        {/* Accuracy */}
        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">
            Final Accuracy
          </p>
          <p className="font-mono text-xl text-green-400">
            {report.accuracy !== undefined
              ? `${(report.accuracy * 100).toFixed(2)}%`
              : "—"}
          </p>
        </div>

        {/* Loss */}
        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">
            Training Loss
          </p>
          <p className="font-mono text-xl text-paper">
            {report.loss !== undefined ? report.loss.toFixed(4) : "—"}
          </p>
        </div>

        {/* GPU Time */}
        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">
            Total Time (GPU)
          </p>
          <p className="font-mono text-xl text-azure">
            {report.totalTimeGpu !== undefined
              ? `${report.totalTimeGpu.toFixed(1)}s`
              : "—"}
          </p>
        </div>

        {/* Hyperparameters */}
        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">
            Best Hyperparameters
          </p>
          {report.bestHyperparameters ? (
            <div className="font-mono text-[10px] text-paper/60 space-y-1">
              {Object.entries(report.bestHyperparameters)
                .slice(0, 3)
                .map(([k, v]) => (
                  <div key={k}>
                    <span className="text-paper/40">{k}:</span>{" "}
                    <span className="text-paper">{String(v)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-paper/30">—</p>
          )}
        </div>
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
          <pre className="font-mono text-sm text-paper/70 leading-relaxed whitespace-pre-wrap">
            {report.report || "No detailed report available."}
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
  const supabase = createBrowserSupabaseClient();

  const [runs, setRuns] = useState<SwarmRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<SwarmRun | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

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
        setRuns(data || []);
        if (data && data.length > 0 && !selectedRunId) {
          setSelectedRunId(data[0].id);
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
          setLastUpdated(new Date());

          if (payload.eventType === "INSERT") {
            const newRun = payload.new as SwarmRun;
            setRuns((prev) => [newRun, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedRun = payload.new as SwarmRun;
            setRuns((prev) =>
              prev.map((r) => (r.id === updatedRun.id ? updatedRun : r))
            );
            if (selectedRunId === updatedRun.id) {
              setCurrentRun(updatedRun);
            }
          } else if (payload.eventType === "DELETE") {
            const deletedRun = payload.old as { id: string };
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

  // Update current run when selection changes
  useEffect(() => {
    if (selectedRunId) {
      const run = runs.find((r) => r.id === selectedRunId);
      setCurrentRun(run || null);
    } else {
      setCurrentRun(null);
    }
  }, [selectedRunId, runs]);

  const isRunning = currentRun?.status === "running";
  const currentPhase = currentRun?.current_phase || "pending";
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
                <Flowchart
                  flowchartData={currentRun.flowchart_data}
                  currentPhase={currentPhase}
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