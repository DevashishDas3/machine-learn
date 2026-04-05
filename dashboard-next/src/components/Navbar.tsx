"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-obsidian/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">
            <span className="text-azure">machine</span>
            <span className="text-paper/60">(</span>
            <span className="text-paper">learn</span>
            <span className="text-paper/60">);</span>
          </span>
        </Link>

        {/* Auth Button */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="group relative overflow-hidden border border-azure bg-azure/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-azure transition-all hover:bg-azure hover:text-obsidian"
          >
            <span className="relative z-10">Sign In</span>
            <span className="absolute inset-0 -z-0 bg-azure opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
