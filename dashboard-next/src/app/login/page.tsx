"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createBrowserSupabaseClient();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Check your email for the magic link!" });
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "github" | "google") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-obsidian px-4">
      {/* Grid background */}
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

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link href="/" className="flex flex-col items-center gap-3">
          <span className="font-mono text-xl font-semibold">
            <span className="text-azure">machine</span>
            <span className="text-paper/60">(</span>
            <span className="text-paper">learn</span>
            <span className="text-paper/60">);</span>
          </span>
        </Link>
      </motion.div>

      {/* Auth Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md border border-white/10 bg-obsidian"
      >
        {/* Terminal header */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="h-2 w-2 bg-white/20" />
          <div className="h-2 w-2 bg-white/20" />
          <div className="h-2 w-2 bg-white/20" />
          <span className="ml-4 font-mono text-xs text-paper/40">
            auth/login
          </span>
        </div>

        <div className="p-8">
          {/* Title */}
          <h1 className="mb-2 font-sans text-3xl font-bold tracking-tight text-paper">
            Welcome back
          </h1>
          <p className="mb-8 font-mono text-xs text-paper/50">
            Sign in to access your ML pipelines
          </p>

          {/* OAuth Buttons */}
          <div className="mb-6 space-y-3">
            <button
              onClick={() => handleOAuth("github")}
              className="group flex w-full items-center justify-center gap-3 border border-white/20 bg-transparent px-4 py-3 font-mono text-xs uppercase tracking-widest text-paper transition-all hover:border-paper hover:bg-paper hover:text-obsidian"
            >
              <GitHubIcon />
              <span>Continue with GitHub</span>
            </button>
            <button
              onClick={() => handleOAuth("google")}
              className="group flex w-full items-center justify-center gap-3 border border-white/20 bg-transparent px-4 py-3 font-mono text-xs uppercase tracking-widest text-paper transition-all hover:border-paper hover:bg-paper hover:text-obsidian"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-obsidian px-4 font-mono text-xs uppercase text-paper/30">
                or
              </span>
            </div>
          </div>

          {/* Magic Link Form */}
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-paper/60">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-white/20 bg-transparent px-4 py-3 font-mono text-sm text-paper placeholder:text-paper/30 focus:border-azure focus:outline-none"
              />
            </div>

            {message && (
              <div
                className={`border p-3 font-mono text-xs ${
                  message.type === "success"
                    ? "border-green-500/50 text-green-400"
                    : "border-red-500/50 text-red-400"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden border border-azure bg-azure px-4 py-3 font-mono text-xs uppercase tracking-widest text-obsidian transition-all hover:bg-azure/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3 w-3 animate-spin border border-obsidian border-t-transparent" />
                  Sending...
                </span>
              ) : (
                "Send Magic Link"
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Back link */}
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