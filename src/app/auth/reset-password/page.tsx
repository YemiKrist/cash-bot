"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Stage = "loading" | "form" | "done" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Supabase sends the recovery token in the URL hash and fires
  // a PASSWORD_RECOVERY event. We wait for that before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStage("form");
      } else if (event === "SIGNED_IN" && stage === "done") {
        // already handled
      }
    });

    // Timeout fallback — if no recovery event in 5 s the link is invalid/expired
    const timeout = setTimeout(() => {
      setStage((s) => (s === "loading" ? "invalid" : s));
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStage("done");
      setTimeout(() => router.replace("/"), 2500);
    }
  }

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
          <p className="mt-1 text-sm text-zinc-400">Set a new password.</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
              <p className="text-sm text-zinc-500">Verifying reset link…</p>
            </div>
          )}

          {stage === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm font-medium text-red-400">
                This reset link is invalid or has expired.
              </p>
              <button
                onClick={() => router.replace("/login")}
                className="w-full rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition"
              >
                Back to sign in
              </button>
            </div>
          )}

          {stage === "done" && (
            <div className="space-y-2 text-center py-4">
              <svg className="mx-auto h-10 w-10 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm font-semibold text-white">Password updated!</p>
              <p className="text-xs text-zinc-500">Redirecting you to the dashboard…</p>
            </div>
          )}

          {stage === "form" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={field}
                  placeholder="Repeat password"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-950/60 border border-red-800 px-3.5 py-2.5 text-xs text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}
        </div>

        {stage === "form" && (
          <p className="mt-5 text-center text-sm text-zinc-500">
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="font-medium text-emerald-400 hover:text-emerald-300 transition"
            >
              ← Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
