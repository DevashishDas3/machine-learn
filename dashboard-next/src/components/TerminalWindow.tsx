"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TerminalLine {
  id: number;
  prefix: string;
  prefixColor: string;
  content: string;
  delay: number;
}

const terminalSequence: TerminalLine[] = [
  { 
    id: 1, 
    prefix: "> User:", 
    prefixColor: "text-paper", 
    content: "Train a classifier on MNIST with >98% accuracy.", 
    delay: 0 
  },
  { 
    id: 2, 
    prefix: "[System]:", 
    prefixColor: "text-[#27CA40]", 
    content: "Booting Modal A100 Cluster...", 
    delay: 1500 
  },
  { 
    id: 3, 
    prefix: "[PlanAgent]:", 
    prefixColor: "text-azure", 
    content: "Generating 3 candidate approaches...", 
    delay: 3000 
  },
  { 
    id: 4, 
    prefix: "[PlanAgent]:", 
    prefixColor: "text-azure", 
    content: "├─ CNN with BatchNorm + Dropout", 
    delay: 4000 
  },
  { 
    id: 5, 
    prefix: "[PlanAgent]:", 
    prefixColor: "text-azure", 
    content: "├─ ResNet-18 (pretrained, fine-tuned)", 
    delay: 4500 
  },
  { 
    id: 6, 
    prefix: "[PlanAgent]:", 
    prefixColor: "text-azure", 
    content: "└─ Simple MLP baseline", 
    delay: 5000 
  },
  { 
    id: 7, 
    prefix: "[ImplementationAgent]:", 
    prefixColor: "text-[#FF79C6]", 
    content: "Compiling PyTorch architectures...", 
    delay: 6000 
  },
  { 
    id: 8, 
    prefix: "[TuningAgent]:", 
    prefixColor: "text-[#F1FA8C]", 
    content: "Running hyperparameter sweep (lr, batch_size, epochs)...", 
    delay: 7500 
  },
  { 
    id: 9, 
    prefix: "[TuningAgent]:", 
    prefixColor: "text-[#F1FA8C]", 
    content: "Best config found: lr=0.001, batch_size=128", 
    delay: 9000 
  },
  { 
    id: 10, 
    prefix: "[ReportAgent]:", 
    prefixColor: "text-[#8BE9FD]", 
    content: "✓ Final accuracy: 98.7% — Report generated.", 
    delay: 10500 
  },
];

function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, 25);

    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-pulse text-azure">▌</span>}
    </span>
  );
}

export default function TerminalWindow() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [currentTyping, setCurrentTyping] = useState<number | null>(null);
  const [completedLines, setCompletedLines] = useState<number[]>([]);

  useEffect(() => {
    // Start the sequence
    terminalSequence.forEach((line) => {
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, line.id]);
        setCurrentTyping(line.id);
      }, line.delay);
    });

    // Restart the animation loop
    const totalDuration = terminalSequence[terminalSequence.length - 1].delay + 4000;
    const resetInterval = setInterval(() => {
      setVisibleLines([]);
      setCurrentTyping(null);
      setCompletedLines([]);
      
      terminalSequence.forEach((line) => {
        setTimeout(() => {
          setVisibleLines((prev) => [...prev, line.id]);
          setCurrentTyping(line.id);
        }, line.delay);
      });
    }, totalDuration);

    return () => clearInterval(resetInterval);
  }, []);

  const handleLineComplete = (lineId: number) => {
    setCompletedLines((prev) => [...prev, lineId]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full border border-white/10 bg-[#0A0E12]"
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-none bg-[#FF5F56]" />
        <div className="h-2.5 w-2.5 rounded-none bg-[#FFBD2E]" />
        <div className="h-2.5 w-2.5 rounded-none bg-[#27CA40]" />
        <span className="ml-4 font-mono text-xs text-paper/40">
          machine(learn); — pipeline session
        </span>
      </div>

      {/* Terminal Content */}
      <div className="min-h-[280px] overflow-hidden p-4 md:p-6">
        <div className="font-mono text-sm leading-loose">
          <AnimatePresence>
            {terminalSequence
              .filter((line) => visibleLines.includes(line.id))
              .map((line) => {
                const isActive = currentTyping === line.id && !completedLines.includes(line.id);
                const isCompleted = completedLines.includes(line.id);

                return (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-wrap items-start gap-2 py-0.5 ${
                      isActive ? "bg-azure/5 -mx-2 px-2" : ""
                    }`}
                  >
                    <span className={`${line.prefixColor} shrink-0 font-semibold`}>
                      {line.prefix}
                    </span>
                    <span className={`text-paper/80 ${isActive ? "text-glow" : ""}`}>
                      {isCompleted || !isActive ? (
                        line.content
                      ) : (
                        <TypewriterText 
                          text={line.content} 
                          onComplete={() => handleLineComplete(line.id)} 
                        />
                      )}
                    </span>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      </div>

      {/* Terminal Footer */}
      <div className="border-t border-white/10 px-4 py-2 md:px-6">
        <div className="flex items-center gap-2">
          <span className="text-azure">❯</span>
          <span className="animate-pulse font-mono text-sm text-paper/30">_</span>
        </div>
      </div>
    </motion.div>
  );
}
