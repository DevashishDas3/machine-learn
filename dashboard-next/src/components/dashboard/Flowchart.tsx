import { motion } from "framer-motion";
import type { FlowchartData } from "@/components/dashboard/types";

interface FlowchartProps {
  flowchartData: FlowchartData | null;
  currentPhase: string;
}

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

function getStatusColor(status: string) {
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
}

export function Flowchart({ flowchartData, currentPhase }: FlowchartProps) {
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

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 800 520" className="w-full h-auto max-h-[400px]">
        <defs>
          <filter id="glowActive" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {CONNECTIONS.map(([from, to], idx) => {
          const fromConfig = STAGE_CONFIG[from];
          const toConfig = STAGE_CONFIG[to];
          const fromStatus = getStageStatus(from);
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
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              )}
            </g>
          );
        })}

        {Object.entries(STAGE_CONFIG).map(([id, config]) => {
          const status = getStageStatus(id);
          const colors = getStatusColor(status);
          const isActive = status === "active";

          return (
            <motion.g key={id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              <motion.rect
                x={config.x - 100}
                y={config.y - 20}
                width={200}
                height={40}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isActive ? 2 : 1}
                filter={isActive ? "url(#glowActive)" : undefined}
                animate={isActive ? { strokeOpacity: [1, 0.5, 1] } : {}}
                transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
              />

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
                  OK
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
