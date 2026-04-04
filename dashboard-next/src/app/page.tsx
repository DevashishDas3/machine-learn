"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import NeuralCanvas from "@/components/NeuralCanvas";
import TerminalWindow from "@/components/TerminalWindow";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Neural Network Background */}
      <NeuralCanvas />

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-14">
        {/* Gradient overlay for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-obsidian via-transparent to-obsidian" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center"
        >
          {/* Eyebrow text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-azure"
          >
            Distributed ML Infrastructure
          </motion.p>

          {/* Main Headline */}
          <h1 className="mb-6 font-sans text-5xl font-bold leading-none tracking-tight text-paper md:text-7xl lg:text-8xl">
            <span className="text-azure">Agent swarms</span>
            <br />
            that deploy{" "}
            <span className="relative">
              themselves
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="absolute -bottom-1 left-0 h-[2px] bg-azure"
              />
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-10 max-w-2xl font-mono text-sm leading-relaxed text-paper/60 md:text-base">
            Orchestrate ML pipelines on Modal GPUs with vLLM. Sub-second cold starts,
            instant autoscaling, and a developer experience that feels local.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group relative overflow-hidden border border-azure bg-azure px-8 py-3 font-mono text-sm uppercase tracking-widest text-obsidian transition-all hover:shadow-[0_0_20px_rgba(0,128,254,0.5)]"
            >
              <span className="relative z-10">Get Started</span>
            </Link>
            <Link
              href="/docs"
              className="group border border-white/20 px-8 py-3 font-mono text-sm uppercase tracking-widest text-paper transition-all hover:border-paper hover:bg-paper/5"
            >
              View Docs
            </Link>
          </div>
        </motion.div>

        {/* Terminal Window */}
        <div className="relative z-10 mt-16 w-full max-w-4xl px-4">
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

      {/* Features Grid Section */}
      <section className="relative z-10 border-t border-white/10 bg-obsidian py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16 text-center font-sans text-3xl font-bold tracking-tight text-paper md:text-4xl"
          >
            Built for{" "}
            <span className="text-azure">ML engineers</span>
          </motion.h2>

          <div className="grid gap-[1px] bg-white/10 md:grid-cols-3">
            {[
              {
                title: "GPU Orchestration",
                desc: "A100, H100, L4 — scale GPU workloads instantly with Modal's serverless infrastructure.",
                code: "@app.cls(gpu=\"A100\")",
              },
              {
                title: "vLLM Integration",
                desc: "Deploy LLMs with optimized inference. PagedAttention, continuous batching, built-in.",
                code: "engine = vllm.AsyncEngine()",
              },
              {
                title: "Agent Coordination",
                desc: "asyncio.gather() your agents. Parallel execution, automatic retries, observable.",
                code: "await asyncio.gather(*agents)",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-obsidian p-8"
              >
                <code className="mb-4 block font-mono text-xs text-azure">
                  {feature.code}
                </code>
                <h3 className="mb-2 font-sans text-xl font-semibold text-paper">
                  {feature.title}
                </h3>
                <p className="font-mono text-sm leading-relaxed text-paper/50">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-obsidian py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <span className="font-mono text-xs text-paper/40">
            © 2026 ML Agent Swarm
          </span>
          <div className="flex gap-6">
            {["GitHub", "Discord", "Twitter"].map((link) => (
              <a
                key={link}
                href="#"
                className="font-mono text-xs uppercase tracking-widest text-paper/40 transition-colors hover:text-paper"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
