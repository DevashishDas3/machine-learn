import type { FinalReport } from "@/components/dashboard/types";

interface ResultsPanelProps {
  report: FinalReport | null;
}

export function ResultsPanel({ report }: ResultsPanelProps) {
  if (!report) {
    return (
      <div className="border border-white/10 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-paper/40 mb-3">Final Results</p>
        <p className="font-mono text-xs text-paper/30">Awaiting pipeline completion...</p>
      </div>
    );
  }

  return (
    <div className="border border-green-500/30 bg-green-950/10 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-green-400 mb-4">Final Results</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">Final Accuracy</p>
          <p className="font-mono text-xl text-green-400">
            {report.accuracy !== undefined ? `${(report.accuracy * 100).toFixed(2)}%` : "-"}
          </p>
        </div>

        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">Training Loss</p>
          <p className="font-mono text-xl text-paper">{report.loss !== undefined ? report.loss.toFixed(4) : "-"}</p>
        </div>

        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">Total Time (GPU)</p>
          <p className="font-mono text-xl text-azure">
            {report.totalTimeGpu !== undefined ? `${report.totalTimeGpu.toFixed(1)}s` : "-"}
          </p>
        </div>

        <div className="border border-white/10 p-3">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-1">Best Hyperparameters</p>
          {report.bestHyperparameters ? (
            <div className="font-mono text-[10px] text-paper/60 space-y-1">
              {Object.entries(report.bestHyperparameters)
                .slice(0, 3)
                .map(([k, v]) => (
                  <div key={k}>
                    <span className="text-paper/40">{k}:</span> <span className="text-paper">{String(v)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-paper/30">-</p>
          )}
        </div>
      </div>

      {report.recommendation && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="font-mono text-[9px] text-paper/40 uppercase mb-2">Recommendation</p>
          <p className="font-mono text-sm text-green-400">{report.recommendation}</p>
        </div>
      )}
    </div>
  );
}
