"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createBrowserSupabaseClient();
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    } else {
      setMessage({ type: "success", text: "Account created! Redirecting..." });
      setTimeout(() => router.push("/dashboard"), 1500);
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
            auth/signup
          </span>
        </div>

        <div className="p-8">
          {/* Title */}
          <h1 className="mb-2 font-sans text-3xl font-bold tracking-tight text-paper">
            Create account
          </h1>
          <p className="mb-8 font-mono text-xs text-paper/50">
            Get started with automated ML pipelines
          </p>

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="space-y-4">
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

            <div>
              <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-paper/60">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full border border-white/20 bg-transparent px-4 py-3 font-mono text-sm text-paper placeholder:text-paper/30 focus:border-azure focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-paper/60">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
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
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center font-mono text-xs text-paper/50">
            Already have an account?{" "}
            <Link href="/login" className="text-azure hover:underline">
              Sign in
            </Link>
          </p>
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