"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";

function LogoPlaceholder() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-azure"
    >
      <circle cx="16" cy="8" r="3" fill="currentColor" />
      <circle cx="8" cy="20" r="3" fill="currentColor" />
      <circle cx="24" cy="20" r="3" fill="currentColor" />
      <circle cx="16" cy="26" r="2" fill="currentColor" opacity="0.6" />
      <line x1="16" y1="11" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="11" x2="24" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="23" x2="16" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="24" y1="23" x2="16" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-obsidian px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #F9F8F7 1px, transparent 1px),
            linear-gradient(to bottom, #F9F8F7 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link href="/" className="flex flex-col items-center gap-3">
          <LogoPlaceholder />
          <span className="font-mono text-sm font-semibold tracking-tight text-paper">
            ML_SWARM
          </span>
        </Link>
      </motion.div>
      <AuthForm mode="login" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-paper/40 transition-colors hover:text-paper"
        >
          ← Back to home
        </Link>
      </motion.div>
    </main>
  );
}