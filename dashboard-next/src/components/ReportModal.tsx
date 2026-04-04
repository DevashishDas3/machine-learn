"use client";

import { useEffect } from "react";

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** Extremely simple markdown-to-JSX: headings, bold, tables, code fences. */
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const fence: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        fence.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={i}
          className="my-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre"
        >
          {fence.join("\n")}
        </pre>
      );
      i++;
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-bold text-zinc-100 mt-5 mb-2">
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-semibold text-zinc-200 mt-4 mb-1.5 border-b border-zinc-800 pb-1">
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-zinc-300 mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && lines[i + 1]?.includes("---")) {
      const headers = line.split("|").filter((c) => c.trim());
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").filter((c) => c.trim()));
        i++;
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700 bg-zinc-800/60"
                  >
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-300">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={i} className="my-1.5 space-y-0.5 list-none">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-sm text-zinc-300">
              <span className="text-violet-500 shrink-0">·</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="text-sm text-zinc-300 leading-relaxed">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-zinc-100 font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded bg-zinc-800 text-violet-300 text-[11px] font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function ReportModal({
  report,
  recommendation,
  onClose,
}: {
  report: string;
  recommendation?: string;
  onClose: () => void;
}) {
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="font-semibold text-zinc-100">Run Report</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Recommendation banner */}
        {recommendation && (
          <div className="px-5 py-3 bg-emerald-950/30 border-b border-emerald-900/40">
            <p className="text-xs text-emerald-500 font-medium mb-0.5">Best approach</p>
            <p className="text-sm text-emerald-200">{recommendation}</p>
          </div>
        )}

        {/* Report body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderMarkdown(report)}
        </div>
      </div>
    </div>
  );
}
