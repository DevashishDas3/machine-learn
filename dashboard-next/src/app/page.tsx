"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import TerminalWindow from "@/components/TerminalWindow";
import BentoGrid from "@/components/BentoGrid";

// Dynamic import for Three.js component to avoid SSR issues
const SwarmPipelineCanvas = dynamic(
  () => import("@/components/SwarmPipelineCanvas"),
  { ssr: false }
);

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-14">
        {/* Three.js Pipeline Background */}
        <SwarmPipelineCanvas />

        {/* Gradient overlays for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-obsidian via-transparent to-obsidian" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-obsidian/50 via-transparent to-obsidian/50" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center"
        >
          {/* Main Headline - Massive Logo */}
          <h1 className="mb-6 font-mono text-5xl font-bold leading-none tracking-tight text-paper md:text-7xl lg:text-8xl">
            <span className="text-azure">machine</span>
            <span className="text-paper/60">(</span>
            <span className="text-paper">learn</span>
            <span className="text-paper/60">);</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-10 max-w-2xl font-mono text-sm leading-relaxed text-paper/60 md:text-base">
            Plan, implement, tune, and report — all automated.
            <br className="hidden md:block" />
            Orchestrate ML pipelines with locally hosted LLMs on Modal GPUs.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group relative overflow-hidden border border-azure bg-azure px-8 py-3 font-mono text-sm uppercase tracking-widest text-obsidian transition-all hover:shadow-[0_0_20px_rgba(0,128,254,0.5)]"
            >
              <span className="relative z-10">Get Started</span>
            </Link>
            <Link
              href="https://github.com/DevashishDas3/machine-learn"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 border border-white/20 px-8 py-3 font-mono text-sm uppercase tracking-widest text-paper transition-all hover:border-paper hover:bg-paper/5"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>View Source</span>
            </Link>
          </div>
        </motion.div>

        {/* Terminal Window */}
        <div className="relative z-10 mt-16 w-full max-w-3xl px-4">
          <TerminalWindow />
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-paper/30">
              Scroll
            </span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="h-6 w-[1px] bg-paper/30"
            />
          </div>
        </motion.div>
      </section>

      {/* Who It's For - Bento Box */}
      <BentoGrid />

      {/* Footer */}
      <footer className="border-t border-white/10 bg-obsidian py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <span className="font-mono text-xs text-paper/40">
            © 2026 machine(learn);
          </span>
          <div className="flex gap-6">
            <a
              href="https://github.com/DevashishDas3/machine-learn"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-widest text-paper/40 transition-colors hover:text-paper"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
