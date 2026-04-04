"use client";

import { motion } from "framer-motion";

const agents = [
  {
    id: "plan",
    name: "PlanAgent",
    desc: "Analyzes requirements and creates execution plan",
    color: "#0080FE",
  },
  {
    id: "implement",
    name: "ImplementationAgents",
    desc: "Parallel workers that write and test code",
    color: "#50FA7B",
  },
  {
    id: "tune",
    name: "TuningAgents",
    desc: "Optimize hyperparameters and model selection",
    color: "#F1FA8C",
  },
  {
    id: "report",
    name: "ReportAgent",
    desc: "Generates documentation and metrics dashboard",
    color: "#FF79C6",
  },
];

export default function ArchitectureDiagram() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="border border-white/10 bg-[#0D1117]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="h-2 w-2 bg-white/20" />
        <div className="h-2 w-2 bg-white/20" />
        <div className="h-2 w-2 bg-white/20" />
        <span className="ml-4 font-mono text-xs text-paper/40">
          architecture.diagram
        </span>
      </div>

      {/* Diagram Content */}
      <div className="p-8">
        {/* Flow visualization */}
        <div className="mb-8 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          {agents.map((agent, i) => (
            <div key={agent.id} className="flex items-center gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex flex-col items-center"
              >
                {/* Agent box */}
                <div
                  className="mb-2 border px-4 py-3"
                  style={{ borderColor: agent.color }}
                >
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: agent.color }}
                  >
                    {agent.name}
                  </span>
                </div>
                {/* Description */}
                <p className="max-w-[140px] text-center font-mono text-[10px] text-paper/40">
                  {agent.desc}
                </p>
              </motion.div>

              {/* Arrow (except for last item) */}
              {i < agents.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 + 0.1 }}
                  className="hidden text-paper/30 md:block"
                >
                  <svg
                    width="40"
                    height="12"
                    viewBox="0 0 40 12"
                    fill="none"
                    className="text-azure"
                  >
                    <path
                      d="M0 6H36M36 6L30 1M36 6L30 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile arrows */}
        <div className="mb-8 flex flex-col items-center gap-2 md:hidden">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-azure"
            >
              <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
                <path
                  d="M6 0V20M6 20L1 14M6 20L11 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </motion.div>
          ))}
        </div>

        {/* Detailed flow description */}
        <div className="border-t border-white/10 pt-6">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-azure">
            Pipeline Flow
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-white/10 p-4">
              <code className="mb-2 block font-mono text-sm text-paper">
                1. Planning Phase
              </code>
              <p className="font-mono text-xs text-paper/50">
                PlanAgent receives user requirements, analyzes the ML task, and
                generates a structured execution plan with dependencies.
              </p>
            </div>
            <div className="border border-white/10 p-4">
              <code className="mb-2 block font-mono text-sm text-paper">
                2. Implementation Phase
              </code>
              <p className="font-mono text-xs text-paper/50">
                ImplementationAgents spawn in parallel on Modal GPUs, each
                handling a specific component: data pipeline, model code, tests.
              </p>
            </div>
            <div className="border border-white/10 p-4">
              <code className="mb-2 block font-mono text-sm text-paper">
                3. Tuning Phase
              </code>
              <p className="font-mono text-xs text-paper/50">
                TuningAgents run hyperparameter optimization, model selection,
                and performance benchmarking using vLLM inference.
              </p>
            </div>
            <div className="border border-white/10 p-4">
              <code className="mb-2 block font-mono text-sm text-paper">
                4. Reporting Phase
              </code>
              <p className="font-mono text-xs text-paper/50">
                ReportAgent aggregates results, generates documentation,
                metrics, and a final summary with deployment instructions.
              </p>
            </div>
          </div>
        </div>

        {/* Placeholder for actual diagram */}
        <div className="mt-6 border border-dashed border-white/20 p-8 text-center">
          <p className="font-mono text-xs text-paper/30">
            [ ARCHITECTURE DIAGRAM PLACEHOLDER ]
          </p>
          <p className="mt-2 font-mono text-xs text-paper/20">
            Interactive system visualization will render here
          </p>
        </div>
      </div>
    </motion.div>
  );
}
