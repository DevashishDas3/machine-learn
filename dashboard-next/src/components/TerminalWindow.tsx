"use client";

import { motion } from "framer-motion";

export default function TerminalWindow() {
  const codeLines = [
    { num: "01", content: "import modal", color: "text-azure" },
    { num: "02", content: "import asyncio", color: "text-azure" },
    { num: "03", content: "from agents import InferenceAgent, TrainingAgent", color: "text-paper/70" },
    { num: "04", content: "", color: "" },
    { num: "05", content: "app = modal.App(\"ml-swarm\")", color: "text-paper/70" },
    { num: "06", content: "", color: "" },
    { num: "07", content: "@app.cls(gpu=\"A100\", timeout=3600)", color: "text-[#FF79C6]" },
    { num: "08", content: "class SwarmOrchestrator:", color: "text-[#8BE9FD]" },
    { num: "09", content: "    @modal.method()", color: "text-[#FF79C6]" },
    { num: "10", content: "    async def run_swarm(self, tasks: list):", color: "text-[#50FA7B]" },
    { num: "11", content: "        agents = [", color: "text-paper/70" },
    { num: "12", content: "            InferenceAgent(model=\"llama-3-70b\"),", color: "text-[#F1FA8C]" },
    { num: "13", content: "            TrainingAgent(config=self.config),", color: "text-[#F1FA8C]" },
    { num: "14", content: "        ]", color: "text-paper/70" },
    { num: "15", content: "", color: "" },
    { num: "16", content: "        results = await asyncio.gather(", color: "text-azure" },
    { num: "17", content: "            *[agent.execute(task)", color: "text-paper/70" },
    { num: "18", content: "              for agent, task in zip(agents, tasks)]", color: "text-paper/70" },
    { num: "19", content: "        )", color: "text-paper/70" },
    { num: "20", content: "        return results", color: "text-azure" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full max-w-3xl border border-white/10 bg-[#0D1117]"
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="h-3 w-3 rounded-none bg-[#FF5F56]" />
        <div className="h-3 w-3 rounded-none bg-[#FFBD2E]" />
        <div className="h-3 w-3 rounded-none bg-[#27CA40]" />
        <span className="ml-4 font-mono text-xs text-paper/40">
          swarm_orchestrator.py
        </span>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto p-4">
        <pre className="font-mono text-sm leading-relaxed">
          {codeLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="flex"
            >
              <span className="mr-4 w-6 select-none text-right text-paper/30">
                {line.num}
              </span>
              <span className={line.color || "text-paper/70"}>
                {line.content || " "}
              </span>
            </motion.div>
          ))}
        </pre>
      </div>

      {/* Terminal Footer */}
      <div className="border-t border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[#27CA40]">▸</span>
          <span className="font-mono text-xs text-paper/50">
            modal deploy swarm_orchestrator.py
          </span>
          <span className="animate-pulse text-azure">█</span>
        </div>
      </div>
    </motion.div>
  );
}
