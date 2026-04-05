interface PhaseBadgeProps {
  phase: string;
}

const phaseMap: Record<string, { label: string; borderColor: string; textColor: string }> = {
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

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const { label, borderColor, textColor } = phaseMap[phase] ?? phaseMap.pending;

  return (
    <span className={`px-2 py-1 border font-mono text-[10px] uppercase tracking-widest ${borderColor} ${textColor}`}>
      {label}
    </span>
  );
}
