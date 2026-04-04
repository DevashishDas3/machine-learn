"use client";

import { PipelineState, ApproachState, NodeStatus, TuningIteration } from "@/types";
import {
  formatDuration,
  formatTs,
  bestMetric,
  pct,
  truncateError,
  diffHyperparams,
} from "@/lib/utils";

// ─── Icons ──────────────────────────────────────────────────────────────────

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SpinnerIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

// ─── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: NodeStatus }) {
  const map: Record<NodeStatus, string> = {
    pending: "bg-zinc-600",
    running: "bg-amber-400 animate-pulse",
    success: "bg-emerald-500",
    error: "bg-red-500",
    partial: "bg-amber-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status]}`} />;
}

// ─── Phase status icon ────────────────────────────────────────────────────────

function PhaseIcon({ status, size = "sm" }: { status: NodeStatus; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-5 h-5" : "w-4 h-4";
  if (status === "success") return <CheckIcon className={`${sz} text-emerald-400`} />;
  if (status === "error") return <XIcon className={`${sz} text-red-400`} />;
  if (status === "running") return <SpinnerIcon className={`${sz} text-amber-400`} />;
  if (status === "partial") return <CheckIcon className={`${sz} text-amber-400`} />;
  return <ClockIcon className={`${sz} text-zinc-600`} />;
}

// ─── Metric bar ──────────────────────────────────────────────────────────────

function MetricBar({
  label,
  value,
  color = "bg-emerald-500",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-center text-[11px] mb-0.5">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300 font-mono font-semibold">{pct(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-700/80">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Framework badge ─────────────────────────────────────────────────────────

function FrameworkBadge({ fw }: { fw: string }) {
  const cls =
    fw === "pytorch"
      ? "bg-orange-900/40 text-orange-300 border border-orange-800/50"
      : "bg-sky-900/40 text-sky-300 border border-sky-800/50";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {fw}
    </span>
  );
}

// ─── Phase section wrapper ───────────────────────────────────────────────────

function PhaseSection({
  icon,
  title,
  status,
  startTs,
  endTs,
  isLast = false,
  children,
}: {
  icon: string;
  title: string;
  status: NodeStatus;
  startTs?: string;
  endTs?: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const headerColor: Record<NodeStatus, string> = {
    pending: "text-zinc-500",
    running: "text-amber-300",
    success: "text-emerald-300",
    error: "text-red-300",
    partial: "text-amber-300",
  };

  return (
    <div className="flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center border text-base shrink-0 ${
            status === "pending"
              ? "bg-zinc-800 border-zinc-700"
              : status === "running"
              ? "bg-amber-900/30 border-amber-700"
              : status === "success" || status === "partial"
              ? "bg-emerald-900/30 border-emerald-700/50"
              : "bg-red-900/30 border-red-700/50"
          }`}
        >
          {icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1 bg-gradient-to-b from-zinc-700 to-zinc-800 min-h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 h-8">
          <PhaseIcon status={status} size="md" />
          <h2 className={`font-semibold text-sm tracking-wide ${headerColor[status]}`}>
            {title}
          </h2>
          {startTs && (
            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
              {endTs ? (
                <span className="font-mono text-zinc-400">
                  {formatDuration(startTs, endTs)}
                </span>
              ) : status === "running" ? (
                <span className="font-mono text-amber-400 animate-pulse">
                  {formatDuration(startTs)} elapsed
                </span>
              ) : null}
              <span>{formatTs(startTs)}</span>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Approach card: Codegen view ──────────────────────────────────────────────

function CodegenCard({
  approach,
  onViewCode,
}: {
  approach: ApproachState;
  onViewCode: (a: ApproachState) => void;
}) {
  const done = !!approach.codegenCompletedAt;
  const started = !!approach.codegenStartedAt;
  const status: NodeStatus = done ? "success" : started ? "running" : "pending";

  return (
    <div
      className={`rounded-xl border p-3.5 flex flex-col gap-2 bg-zinc-900/70 transition-colors ${
        status === "success"
          ? "border-emerald-800/40"
          : status === "running"
          ? "border-amber-800/40"
          : "border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200 truncate">{approach.name}</p>
          <div className="mt-0.5">
            <FrameworkBadge fw={approach.framework} />
          </div>
        </div>
        <StatusDot status={status} />
      </div>

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-zinc-800">
        <span className="text-[11px] font-mono text-zinc-500">
          {done
            ? formatDuration(approach.codegenStartedAt, approach.codegenCompletedAt)
            : started
            ? "generating…"
            : "pending"}
        </span>
        {done && approach.code && (
          <button
            onClick={() => onViewCode(approach)}
            className="text-[11px] px-2 py-0.5 rounded bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-700/30 transition-colors"
          >
            View code
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Approach card: Training view ─────────────────────────────────────────────

function TrainingCard({
  approach,
  onViewCode,
}: {
  approach: ApproachState;
  onViewCode: (a: ApproachState) => void;
}) {
  const done = !!approach.trainingCompletedAt;
  const started = !!approach.trainingStartedAt;
  const hasError = !!approach.initialError;
  const status: NodeStatus = done
    ? hasError
      ? "error"
      : "success"
    : started
    ? "running"
    : "pending";

  const acc = bestMetric(approach.initialMetrics);

  return (
    <div
      className={`rounded-xl border p-3.5 flex flex-col gap-2 bg-zinc-900/70 transition-all ${
        status === "success"
          ? "border-emerald-800/50"
          : status === "error"
          ? "border-red-800/50"
          : status === "running"
          ? "border-amber-800/40"
          : "border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200 truncate">{approach.name}</p>
          <FrameworkBadge fw={approach.framework} />
        </div>
        <PhaseIcon status={status} />
      </div>

      {/* Metrics / error */}
      {status === "success" && acc !== null && (
        <MetricBar label="accuracy" value={acc} />
      )}
      {status === "error" && approach.initialError && (
        <div className="rounded-lg bg-red-950/40 border border-red-900/40 px-2.5 py-2 text-[11px] text-red-300 font-mono leading-snug">
          {truncateError(approach.initialError, 140)}
        </div>
      )}
      {status === "running" && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
          <SpinnerIcon className="w-3 h-3" />
          <span>{formatDuration(approach.trainingStartedAt)} elapsed</span>
        </div>
      )}
      {status === "pending" && (
        <span className="text-[11px] text-zinc-600">waiting…</span>
      )}

      <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-zinc-800">
        <span className="text-[11px] font-mono text-zinc-500">
          {done
            ? formatDuration(approach.trainingStartedAt, approach.trainingCompletedAt)
            : ""}
        </span>
        {approach.code && (
          <button
            onClick={() => onViewCode(approach)}
            className="text-[11px] px-2 py-0.5 rounded bg-zinc-700/40 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30 transition-colors"
          >
            Code
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tuning iteration row ────────────────────────────────────────────────────

function TuningIterRow({
  iter,
  prevHp,
  isRunning,
}: {
  iter: TuningIteration;
  prevHp?: Record<string, unknown>;
  isRunning: boolean;
}) {
  const done = !!iter.completedAt;
  const hasError = !!iter.error;
  const acc = bestMetric(iter.metrics);
  const diff = diffHyperparams(prevHp, iter.hyperparameters);

  return (
    <div className="flex items-start gap-2 py-2 border-t border-zinc-800/70 first:border-0">
      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-500 shrink-0 mt-0.5">
        {iter.iteration}
      </div>
      <div className="flex-1 min-w-0">
        {diff && (
          <p className="text-[10px] text-violet-400 font-mono truncate mb-0.5">
            ↻ {diff}
          </p>
        )}
        {done && !hasError && acc !== null && (
          <MetricBar
            label="accuracy"
            value={acc}
            color="bg-violet-500"
          />
        )}
        {done && hasError && (
          <div className="text-[11px] text-red-400 font-mono truncate">
            ✗ {truncateError(iter.error, 80)}
          </div>
        )}
        {!done && isRunning && (
          <div className="flex items-center gap-1 text-[11px] text-amber-400">
            <SpinnerIcon className="w-2.5 h-2.5" />
            <span>{formatDuration(iter.startedAt)}</span>
          </div>
        )}
        {!done && !isRunning && (
          <span className="text-[10px] text-zinc-600">suggested</span>
        )}
      </div>
      {done && (
        <span className="text-[10px] font-mono text-zinc-600 shrink-0">
          {formatDuration(iter.startedAt, iter.completedAt)}
        </span>
      )}
    </div>
  );
}

// ─── Approach card: Tuning view ───────────────────────────────────────────────

function TuningCard({
  approach,
  onViewCode,
}: {
  approach: ApproachState;
  onViewCode: (a: ApproachState) => void;
}) {
  const { tuningIterations: iters } = approach;
  const lastIter = iters[iters.length - 1];
  const allDone = iters.length > 0 && iters.every((it) => !!it.completedAt);
  const someRunning = iters.some((it) => it.startedAt && !it.completedAt);
  const hasInitialError = !!approach.initialError;

  const bestAcc = (() => {
    const allAccs: number[] = [];
    const initAcc = bestMetric(approach.initialMetrics);
    if (initAcc !== null) allAccs.push(initAcc);
    for (const it of iters) {
      const a = bestMetric(it.metrics);
      if (a !== null) allAccs.push(a);
    }
    return allAccs.length ? Math.max(...allAccs) : null;
  })();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200 truncate">{approach.name}</p>
          <FrameworkBadge fw={approach.framework} />
        </div>
        {bestAcc !== null && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-zinc-500">best</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">{pct(bestAcc)}</p>
          </div>
        )}
      </div>

      {/* Initial baseline */}
      <div className="rounded-lg bg-zinc-800/60 px-2.5 py-1.5">
        <p className="text-[10px] text-zinc-500 mb-0.5">Initial</p>
        {hasInitialError ? (
          <p className="text-[11px] text-red-400 font-mono truncate">
            ✗ {truncateError(approach.initialError, 60)}
          </p>
        ) : (
          (() => {
            const initAcc = bestMetric(approach.initialMetrics);
            return initAcc !== null ? (
              <MetricBar label="accuracy" value={initAcc} />
            ) : (
              <p className="text-[11px] text-zinc-600">no metrics</p>
            );
          })()
        )}
      </div>

      {/* Tuning iterations */}
      {iters.length > 0 && (
        <div className="rounded-lg bg-zinc-800/30 px-2.5 py-1">
          {iters.map((it, i) => (
            <TuningIterRow
              key={it.iteration}
              iter={it}
              prevHp={i === 0 ? approach.hyperparameters : iters[i - 1]?.hyperparameters}
              isRunning={someRunning && it === lastIter && !it.completedAt}
            />
          ))}
        </div>
      )}

      {approach.code && (
        <button
          onClick={() => onViewCode(approach)}
          className="text-[11px] self-start px-2 py-0.5 rounded bg-zinc-700/40 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30 transition-colors mt-auto"
        >
          View code
        </button>
      )}
    </div>
  );
}

// ─── Approach grid ───────────────────────────────────────────────────────────

function ApproachGrid({
  approaches,
  renderCard,
}: {
  approaches: ApproachState[];
  renderCard: (a: ApproachState) => React.ReactNode;
}) {
  const cols = Math.min(approaches.length, 4);
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {approaches.map((a) => (
        <div key={a.name}>{renderCard(a)}</div>
      ))}
    </div>
  );
}

// ─── Phase helpers ────────────────────────────────────────────────────────────

function codegenStatus(approaches: ApproachState[]): NodeStatus {
  if (!approaches.length) return "pending";
  const done = approaches.filter((a) => a.codegenCompletedAt).length;
  if (done === 0) return approaches.some((a) => a.codegenStartedAt) ? "running" : "pending";
  if (done === approaches.length) return "success";
  return "running";
}

function trainingStatus(approaches: ApproachState[]): NodeStatus {
  if (!approaches.length) return "pending";
  const done = approaches.filter((a) => a.trainingCompletedAt).length;
  if (done === 0) return approaches.some((a) => a.trainingStartedAt) ? "running" : "pending";
  const errors = approaches.filter((a) => a.trainingCompletedAt && a.initialError).length;
  if (done === approaches.length) return errors > 0 && errors < done ? "partial" : errors === done ? "error" : "success";
  return "running";
}

function tuningStatus(
  approaches: ApproachState[],
  tuningCompletedAt?: string
): NodeStatus {
  if (!approaches.length) return "pending";
  if (tuningCompletedAt) {
    const errors = approaches.filter((a) =>
      a.tuningIterations.every((it) => it.error)
    ).length;
    return errors === approaches.length ? "error" : errors > 0 ? "partial" : "success";
  }
  return approaches.some((a) => a.tuningIterations.length > 0) ? "running" : "pending";
}

// ─── Main PipelineView ───────────────────────────────────────────────────────

export default function PipelineView({
  pipeline,
  onViewCode,
  onViewReport,
}: {
  pipeline: PipelineState;
  onViewCode: (a: ApproachState) => void;
  onViewReport: () => void;
}) {
  const { approaches, phase } = pipeline;

  const showCodegen = phase !== "planning" && phase !== "not_started";
  const showTraining = ["training", "tuning", "reporting", "complete"].includes(phase);
  const showTuning = ["tuning", "reporting", "complete"].includes(phase);
  const showReport = ["reporting", "complete"].includes(phase);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Run header */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 mb-0.5">Task</p>
          <p className="text-sm text-zinc-200 leading-snug line-clamp-2">{pipeline.taskDescription}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-zinc-500 space-y-0.5">
          <p>Run <span className="font-mono text-zinc-400">{pipeline.runId}</span></p>
          <p>{formatTs(pipeline.startedAt)}</p>
          {pipeline.completedAt && (
            <p className="text-emerald-400">
              ✓ {formatDuration(pipeline.startedAt, pipeline.completedAt)} total
            </p>
          )}
          {pipeline.estimatedCostUsd !== undefined && (
            <p>Est. cost: <span className="text-zinc-300">${pipeline.estimatedCostUsd.toFixed(2)}</span></p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">

        {/* 1 · Planning */}
        <PhaseSection
          icon="🗺️"
          title="Planning"
          status={pipeline.planCompletedAt ? "success" : phase === "planning" ? "running" : "pending"}
          startTs={pipeline.startedAt}
          endTs={pipeline.planCompletedAt}
        >
          {pipeline.planCompletedAt ? (
            <div className="flex flex-wrap gap-2">
              <InfoChip label="Approaches" value={String(approaches.length)} />
              {pipeline.estimatedCostUsd !== undefined && (
                <InfoChip label="Estimated cost" value={`$${pipeline.estimatedCostUsd.toFixed(2)}`} />
              )}
              {approaches.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300"
                >
                  <span>{a.name}</span>
                  <FrameworkBadge fw={a.framework} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <SpinnerIcon className="w-4 h-4 text-amber-400" />
              <span>LLM planning approaches…</span>
            </div>
          )}
        </PhaseSection>

        {/* 2 · Code Generation */}
        {showCodegen && (
          <PhaseSection
            icon="⚡"
            title="Code Generation"
            status={codegenStatus(approaches)}
            startTs={pipeline.codegenStartedAt}
            endTs={pipeline.codegenCompletedAt}
          >
            <ApproachGrid
              approaches={approaches}
              renderCard={(a) => (
                <CodegenCard approach={a} onViewCode={onViewCode} />
              )}
            />
          </PhaseSection>
        )}

        {/* 3 · Initial Training */}
        {showTraining && (
          <PhaseSection
            icon="🏋️"
            title="Initial Training"
            status={trainingStatus(approaches)}
            startTs={pipeline.trainingStartedAt}
            endTs={pipeline.trainingCompletedAt}
          >
            <ApproachGrid
              approaches={approaches}
              renderCard={(a) => (
                <TrainingCard approach={a} onViewCode={onViewCode} />
              )}
            />
          </PhaseSection>
        )}

        {/* 4 · Tuning */}
        {showTuning && (
          <PhaseSection
            icon="🔬"
            title={`Hyperparameter Tuning (${pipeline.maxTuningIterations} round${pipeline.maxTuningIterations !== 1 ? "s" : ""})`}
            status={tuningStatus(approaches, pipeline.tuningCompletedAt)}
            startTs={pipeline.tuningStartedAt}
            endTs={pipeline.tuningCompletedAt}
          >
            <ApproachGrid
              approaches={approaches}
              renderCard={(a) => (
                <TuningCard approach={a} onViewCode={onViewCode} />
              )}
            />
          </PhaseSection>
        )}

        {/* 5 · Report */}
        {showReport && (
          <PhaseSection
            icon="📋"
            title="Report"
            status={
              pipeline.reportCompletedAt
                ? "success"
                : phase === "reporting"
                ? "running"
                : "pending"
            }
            startTs={pipeline.reportStartedAt}
            endTs={pipeline.reportCompletedAt}
            isLast
          >
            {pipeline.recommendation && (
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 mb-3">
                <p className="text-xs text-emerald-500 mb-1 font-medium uppercase tracking-wide">
                  Recommendation
                </p>
                <p className="text-sm text-emerald-200">{pipeline.recommendation}</p>
              </div>
            )}
            {pipeline.report ? (
              <button
                onClick={onViewReport}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
              >
                View full report →
              </button>
            ) : phase === "reporting" ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <SpinnerIcon className="w-4 h-4 text-amber-400" />
                <span>Generating report…</span>
              </div>
            ) : null}
          </PhaseSection>
        )}
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-medium">{value}</span>
    </div>
  );
}
