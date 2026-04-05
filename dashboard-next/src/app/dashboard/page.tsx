"use client";

import { useEffect, useRef, useState } from "react";
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

function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function NewChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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
// Awaiting Command Empty State
// ============================================

function AwaitingCommandState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <pre className="text-azure/40 text-[10px] leading-tight font-mono mb-8 select-none">
{`
   ╭──────────────────────────────────────╮
   │                                      │
   │     ▄▄▄  ▄▄▄▄▄  ▄▄▄▄▄  ▄   ▄  ▄▄▄    │
   │     █▄▄█ █   ▀  █   ▀  █▀▄▀█  █▄▄▀   │
   │     █  █ █▀▀    █▀▀    █   █  █ ▀▄   │
   │     ▀  ▀ ▀▀▀▀▀  ▀▀▀▀▀  ▀   ▀  ▀  ▀▀  │
   │                                      │
   │        SWARM ORCHESTRATOR            │
   │                                      │
   ╰──────────────────────────────────────╯
`}
      </pre>
      
      <div className="font-mono space-y-3 max-w-md">
        <p className="text-2xl text-paper tracking-tight">
          {">"} system.ready()
        </p>
        <p className="text-sm text-paper/40 leading-relaxed">
          Describe your ML task below to initiate the agent swarm.
          <br />
          Upload a dataset or specify a path on Modal Volume.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-4 text-left max-w-xl">
        {[
          { label: "PlanAgent", desc: "Architecture selection" },
          { label: "ImplementAgent", desc: "A100/H100 training" },
          { label: "TuneAgent", desc: "Hyperparameter search" },
        ].map((item) => (
          <div key={item.label} className="border border-white/10 p-3">
            <p className="font-mono text-[10px] text-azure uppercase tracking-wider">
              {item.label}
            </p>
            <p className="font-mono text-[10px] text-paper/30 mt-1">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Empty Runs State (for sidebar)
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
  
  // New states for ChatGPT-style UI
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      }
      setIsLoading(false);
    };

    loadRuns();
  }, [userId, supabase]);

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
            // Auto-select new run
            setSelectedRunId(newRun.id);
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

  // Handle new task submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !userId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Create a new run in Supabase
      const runName = inputValue.length > 50 
        ? inputValue.slice(0, 47) + "..." 
        : inputValue;
      
      const { data, error } = await supabase
        .from("swarm_runs")
        .insert({
          user_id: userId,
          name: runName,
          status: "pending",
          current_phase: "prepare_dataset",
          flowchart_data: {
            stages: [
              { id: "prepare_dataset", label: "Prepare Dataset", status: "pending" },
              { id: "load_modal", label: "Load to Modal Volume", status: "pending" },
              { id: "plan_agent", label: "PlanAgent", status: "pending" },
              { id: "implement_agent", label: "ImplementationAgent", status: "pending" },
              { id: "tune_agent", label: "TuningAgent", status: "pending" },
              { id: "report_agent", label: "ReportAgent", status: "pending" },
            ],
            connections: [
              { from: "prepare_dataset", to: "load_modal", active: false },
              { from: "load_modal", to: "plan_agent", active: false },
              { from: "plan_agent", to: "implement_agent", active: false },
              { from: "implement_agent", to: "tune_agent", active: false },
              { from: "tune_agent", to: "report_agent", active: false },
            ],
          },
          chat_messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: inputValue,
              timestamp: new Date().toISOString(),
            },
            {
              id: crypto.randomUUID(),
              role: "system",
              content: "Initializing ML agent swarm...",
              timestamp: new Date().toISOString(),
              stage: "prepare_dataset",
            },
          ],
          final_report: null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating run:", error);
      } else if (data) {
        setSelectedRunId(data.id);
        setInputValue("");
        setUploadedFile(null);
      }
    } catch (err) {
      console.error("Error submitting task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start a new chat (deselect current run)
  const handleNewChat = () => {
    setSelectedRunId(null);
    setCurrentRun(null);
    setInputValue("");
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const isRunning = currentRun?.status === "running";
  const currentPhase = currentRun?.current_phase || "pending";
  const chatMessages = currentRun?.chat_messages || [];

  return (
    <div className="flex h-screen overflow-hidden bg-obsidian">
      {/* Collapsible Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="shrink-0 border-r border-white/10 flex flex-col overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-mono text-sm">
                <span className="text-azure">machine</span>
                <span className="text-paper/60">(</span>
                <span className="text-paper">learn</span>
                <span className="text-paper/60">);</span>
              </span>
            </div>

            {/* New Chat Button */}
            <div className="px-3 py-3 border-b border-white/10">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 px-3 py-2 border border-white/10 font-mono text-xs text-paper/80 hover:text-paper hover:bg-white/5 transition-colors"
              >
                <NewChatIcon className="w-4 h-4" />
                <span>New Task</span>
              </button>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto py-2">
              <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper/40">
                History
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
                    className={`w-full text-left px-4 py-2.5 font-mono text-xs transition-colors ${
                      run.id === selectedRunId
                        ? "bg-white/10 text-paper border-l-2 border-l-azure"
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
                      <span className="truncate flex-1">{run.name || run.id.slice(0, 8)}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-paper/30 truncate pl-3.5">
                      {new Date(run.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
              <a
                href="/"
                className="font-mono text-[10px] uppercase tracking-widest text-paper/40 hover:text-paper transition-colors"
              >
                ← Home
              </a>
              {lastUpdated && (
                <span className="font-mono text-[9px] text-paper/30">
                  {formatTs(lastUpdated.toISOString())}
                </span>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 border border-white/10 border-l-0 bg-obsidian px-1 py-3 font-mono text-[10px] text-paper/40 hover:text-paper hover:bg-white/5 transition-colors"
        style={{ left: sidebarOpen ? 260 : 0 }}
      >
        {sidebarOpen ? (
          <ChevronLeftIcon className="w-3 h-3" />
        ) : (
          <ChevronRightIcon className="w-3 h-3" />
        )}
      </button>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header - only show when a run is active */}
        {currentRun && (
          <header className="shrink-0 border-b border-white/10 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-paper/40">Run</span>
              <span className="text-paper/20">/</span>
              <span className="text-paper truncate max-w-[300px]">
                {currentRun.name || selectedRunId?.slice(0, 8)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {isRunning && (
                <div className="flex items-center gap-2 px-3 py-1.5 border border-azure text-azure">
                  <SpinnerIcon className="w-3 h-3" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">
                    LIVE
                  </span>
                </div>
              )}
              <PhaseBadge phase={currentPhase} />
            </div>
          </header>
        )}

        {/* Main Content */}
        {!currentRun ? (
          /* Empty State - Awaiting Command */
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <AwaitingCommandState />
            </div>

            {/* Command Input - Bottom Center */}
            <div className="shrink-0 px-4 pb-6 pt-2">
              <div className="max-w-3xl mx-auto">
                <form onSubmit={handleSubmit}>
                  <div className="border border-white/10 bg-[#11181C]">
                    {/* File upload indicator */}
                    {uploadedFile && (
                      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                        <span className="font-mono text-xs text-azure">
                          {uploadedFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setUploadedFile(null)}
                          className="text-paper/40 hover:text-paper"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      {/* Upload Button */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv,.json,.parquet,.idx3-ubyte"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-4 text-paper/40 hover:text-paper border-r border-white/10 transition-colors"
                        title="Upload dataset"
                      >
                        <UploadIcon className="w-5 h-5" />
                      </button>

                      {/* Input Field */}
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="> Describe your ML task..."
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-4 bg-transparent font-mono text-sm text-paper placeholder:text-paper/30 focus:outline-none"
                      />

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={!inputValue.trim() || isSubmitting}
                        className={`px-4 py-4 transition-colors ${
                          inputValue.trim() && !isSubmitting
                            ? "text-azure hover:bg-azure/10"
                            : "text-paper/20 cursor-not-allowed"
                        }`}
                      >
                        {isSubmitting ? (
                          <SpinnerIcon className="w-5 h-5" />
                        ) : (
                          <SendIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                <p className="mt-3 text-center font-mono text-[10px] text-paper/30">
                  Type a task description and press Enter to start the agent swarm.
                  {" "}Datasets: MNIST, CIFAR-10, or upload your own.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Active Run View - Split Pane */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane - Chat Messages */}
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