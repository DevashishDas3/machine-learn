"use client";

import { useEffect, useState } from "react";
import { ApproachState } from "@/types";

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** Very simple Python token coloriser — no external deps. */
function colorisePython(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const isComment = line.trimStart().startsWith("#");
    const isString = /^\s*("""|'''|"|')/.test(line);
    const isKeyword = /^\s*(def |class |import |from |return |if |elif |else:|for |while |try:|except |with |as |and |or |not |in |is |lambda |yield |raise |pass|break|continue)/.test(line);

    let cls = "text-zinc-300";
    if (isComment) cls = "text-zinc-500 italic";
    else if (isString) cls = "text-amber-300";
    else if (isKeyword) cls = "text-violet-300";

    return (
      <span key={i}>
        <span className="select-none text-zinc-700 mr-4 text-[11px] inline-block w-7 text-right">
          {i + 1}
        </span>
        <span className={cls}>{line}</span>
        {"\n"}
      </span>
    );
  });
}

export default function CodeModal({
  approach,
  onClose,
}: {
  approach: ApproachState;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const code = approach.code ?? "";

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lineCount = code.split("\n").length;
  const charCount = code.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-zinc-100">
                {approach.name}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  approach.framework === "pytorch"
                    ? "bg-orange-900/50 text-orange-300 border border-orange-800/50"
                    : "bg-sky-900/50 text-sky-300 border border-sky-800/50"
                }`}
              >
                {approach.framework}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                train.py
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {lineCount} lines · {charCount.toLocaleString()} chars
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 transition-colors"
          >
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <CopyIcon className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Rationale */}
        {approach.rationale && (
          <div className="px-4 py-2.5 bg-violet-950/20 border-b border-violet-900/30">
            <p className="text-[11px] text-violet-400 font-medium mb-0.5">Approach rationale</p>
            <p className="text-xs text-violet-200">{approach.rationale}</p>
          </div>
        )}

        {/* Code */}
        {code ? (
          <div className="flex-1 overflow-auto bg-zinc-950 p-4">
            <pre className="text-[12px] leading-relaxed whitespace-pre font-mono">
              {colorisePython(code)}
            </pre>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            No code preview available
          </div>
        )}
      </div>
    </div>
  );
}
