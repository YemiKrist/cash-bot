"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) router.replace("/");
      }
    );
    return () => subscription.unsubscribe();
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Account created — check your email to confirm before signing in.");
      }
    } else {
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const redirectTo = `${base}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Password reset email sent — check your inbox and follow the link.");
      }
    }

    setLoading(false);
  }

  const subtitle =
    mode === "signin" ? "Welcome back." :
    mode === "signup" ? "Create your account." :
    "Reset your password.";

  const submitLabel =
    mode === "signin" ? "Sign In" :
    mode === "signup" ? "Create Account" :
    "Send Reset Link";

  const field =
    "block w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-white">
            Cash<span className="text-emerald-400">Bot</span>
          </span>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@example.com"
              />
            </div>

            {/* Password — hidden in forgot mode */}
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-zinc-400">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-zinc-500 hover:text-emerald-400 transition"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-950/60 border border-red-800 px-3.5 py-2.5 text-xs text-red-400">
                {error}
              </p>
            )}

            {info && (
              <p className="rounded-lg bg-emerald-950/60 border border-emerald-800 px-3.5 py-2.5 text-xs text-emerald-400">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Please wait…" : submitLabel}
            </button>
          </form>
        </div>

        {/* Bottom links */}
        <div className="mt-5 space-y-2 text-center">
          {mode === "forgot" ? (
            <p className="text-sm text-zinc-500">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-medium text-emerald-400 hover:text-emerald-300 transition"
              >
                ← Back to sign in
              </button>
            </p>
          ) : (
            <p className="text-sm text-zinc-500">
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                className="font-medium text-emerald-400 hover:text-emerald-300 transition"
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
