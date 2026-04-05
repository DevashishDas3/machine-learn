import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatTs } from "@/lib/utils";
import type { ChatMessage } from "@/components/dashboard/types";

interface ChatPaneProps {
  messages: ChatMessage[];
  isRunning: boolean;
}

const roleStyles: Record<string, { bg: string; label: string; textColor: string }> = {
  system: { bg: "bg-white/5", label: "SYS", textColor: "text-paper/60" },
  agent: { bg: "bg-azure/10", label: "AGT", textColor: "text-azure" },
  user: { bg: "bg-green-900/20", label: "USR", textColor: "text-green-400" },
};

export function ChatPane({ messages, isRunning }: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${isRunning ? "bg-azure animate-pulse" : "bg-white/20"}`} />
            <span className="font-mono text-xs text-paper/60 uppercase tracking-widest">Agent Log</span>
          </div>
          {isRunning && <span className="font-mono text-[10px] text-azure animate-pulse">STREAMING...</span>}
        </div>
      </div>

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
                  <span className={`font-mono text-[10px] ${style.textColor} shrink-0`}>[{style.label}]</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-paper leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {msg.stage && <span className="font-mono text-[9px] text-paper/30 uppercase">{msg.stage}</span>}
                      <span className="font-mono text-[9px] text-paper/20">{formatTs(msg.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-white/5">
          <span className="font-mono text-xs text-paper/30">{">"}</span>
          <span className="font-mono text-xs text-paper/20 italic">Agent-driven execution - Read-only</span>
        </div>
      </div>
    </div>
  );
}
