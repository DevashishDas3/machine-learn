import { useEffect } from "react";
import { XIcon } from "@/components/dashboard/icons";
import type { FinalReport } from "@/components/dashboard/types";

interface DashboardReportModalProps {
  report: FinalReport;
  onClose: () => void;
}

export function DashboardReportModal({ report, onClose }: DashboardReportModalProps) {
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-white/20" />
            <div className="h-2 w-2 bg-white/20" />
            <div className="h-2 w-2 bg-white/20" />
            <span className="ml-4 font-mono text-xs text-paper/40">final_report.md</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 text-paper/50 hover:text-paper transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {report.recommendation && (
          <div className="px-4 py-3 bg-green-950/20 border-b border-green-500/20">
            <p className="font-mono text-[10px] uppercase tracking-widest text-green-500 mb-1">Recommended Approach</p>
            <p className="font-mono text-sm text-green-400">{report.recommendation}</p>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <pre className="font-mono text-sm text-paper/70 leading-relaxed whitespace-pre-wrap">
            {report.report || "No detailed report available."}
          </pre>
        </div>

        <div className="border-t border-white/10 px-4 py-2 shrink-0">
          <span className="font-mono text-[10px] text-paper/40">Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
