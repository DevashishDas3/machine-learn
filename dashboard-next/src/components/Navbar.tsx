"use client";

import Link from "next/link";
import { motion } from "framer-motion";

function LogoPlaceholder() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-azure"
    >
      {/* Geometric neural node cluster - placeholder logo */}
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

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-obsidian/90 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <LogoPlaceholder />
          <span className="font-mono text-sm font-semibold tracking-tight text-paper">
            ML_SWARM
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden items-center gap-8 md:flex">
          {["Product", "Docs", "Pricing"].map((item) => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="font-mono text-xs uppercase tracking-widest text-paper/60 transition-colors hover:text-paper"
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-widest text-paper/60 transition-colors hover:text-paper"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="group relative overflow-hidden border border-azure bg-azure/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-azure transition-all hover:bg-azure hover:text-obsidian"
          >
            <span className="relative z-10">Sign Up</span>
            <span className="absolute inset-0 -z-0 bg-azure opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
