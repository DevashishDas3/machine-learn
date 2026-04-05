import { AnimatePresence, motion } from "framer-motion";
import { formatTs } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, NewChatIcon, SpinnerIcon } from "@/components/dashboard/icons";
import type { SwarmRun } from "@/components/dashboard/types";

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewTask: () => void;
  runs: SwarmRun[];
  isLoading: boolean;
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  lastUpdated: Date | null;
}

export function DashboardSidebar({
  sidebarOpen,
  onToggleSidebar,
  onNewTask,
  runs,
  isLoading,
  selectedRunId,
  onSelectRun,
  lastUpdated,
}: DashboardSidebarProps) {
  return (
    <>
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="shrink-0 border-r border-white/10 flex flex-col overflow-hidden"
          >
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-mono text-sm">
                <span className="text-azure">machine</span>
                <span className="text-paper/60">(</span>
                <span className="text-paper">learn</span>
                <span className="text-paper/60">);</span>
              </span>
            </div>

            <div className="px-3 py-3 border-b border-white/10">
              <button
                onClick={onNewTask}
                className="w-full flex items-center gap-2 px-3 py-2 border border-white/10 font-mono text-xs text-paper/80 hover:text-paper hover:bg-white/5 transition-colors"
              >
                <NewChatIcon className="w-4 h-4" />
                <span>New Task</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-paper/40">History</p>
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
                    onClick={() => onSelectRun(run.id)}
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
                    <p className="mt-1 text-[10px] text-paper/30 truncate pl-3.5">{new Date(run.created_at).toLocaleDateString()}</p>
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
              <a href="/" className="font-mono text-[10px] uppercase tracking-widest text-paper/40 hover:text-paper transition-colors">
                {"<- Home"}
              </a>
              {lastUpdated && <span className="font-mono text-[9px] text-paper/30">{formatTs(lastUpdated.toISOString())}</span>}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <button
        onClick={onToggleSidebar}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 border border-white/10 border-l-0 bg-obsidian px-1 py-3 font-mono text-[10px] text-paper/40 hover:text-paper hover:bg-white/5 transition-colors"
        style={{ left: sidebarOpen ? 260 : 0 }}
      >
        {sidebarOpen ? <ChevronLeftIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
      </button>
    </>
  );
}
