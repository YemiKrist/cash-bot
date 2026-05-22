"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Hour helpers ──────────────────────────────────────────────────────────────

function hourLabel(h: number): string {
  if (h === 0)  return "12:00 AM";
  if (h < 12)   return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: hourLabel(h),
}));

const selectCls =
  "w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 pr-10 text-sm text-neutral-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition";

function ChevronDown() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReminderSettings({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [enabled,   setEnabled]   = useState(false);
  const [morning,   setMorning]   = useState(9);
  const [evening,   setEvening]   = useState(18);
  const [saveOk,    setSaveOk]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [testOk,    setTestOk]    = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Keyboard dismiss
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load current settings
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      try {
        const res = await fetch("/api/reminders", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json() as {
            enabled:      boolean;
            morning_hour: number;
            evening_hour: number;
          };
          setEnabled(d.enabled      ?? false);
          setMorning(d.morning_hour ?? 9);
          setEvening(d.evening_hour ?? 18);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveOk(false);
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const res = await fetch("/api/reminders", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enabled,
        morning_hour: morning,
        evening_hour: evening,
        timezone:     "Africa/Lagos",
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const json = await res.json() as { error?: string };
      setError(json.error ?? "Save failed.");
      return;
    }

    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  }

  async function handleTest() {
    setTestSending(true);
    setTestOk(false);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch("/api/cron/send-reminders?test=true", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? `Request failed (${res.status}).`);
        return;
      }

      setTestOk(true);
      setTimeout(() => setTestOk(false), 3000);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-4"
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-neutral-800 bg-zinc-900 shadow-2xl sm:max-w-md sm:rounded-2xl">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-400 transition hover:bg-neutral-700 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">WhatsApp Reminders</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Automated daily accountability pings</p>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-500" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6 px-6 py-6">

              {/* Section heading */}
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  Automated WhatsApp Reminders
                </p>
                <p className="text-xs text-neutral-600">
                  CashBot will ping your registered WhatsApp number at your chosen hours
                  to keep your ledger current every day.
                </p>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-neutral-200">
                    Enable Daily Accountability Pings
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Morning &amp; evening WhatsApp nudges to log your transactions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    enabled ? "bg-emerald-500" : "bg-neutral-700"
                  }`}
                  role="switch"
                  aria-checked={enabled}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Hour dropdowns — only visible when enabled */}
              {enabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Morning */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                        Morning Reminder Hour
                      </label>
                      <div className="relative">
                        <select
                          value={morning}
                          onChange={(e) => setMorning(Number(e.target.value))}
                          className={selectCls}
                        >
                          {HOUR_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown />
                      </div>
                    </div>

                    {/* Evening */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                        Evening Reminder Hour
                      </label>
                      <div className="relative">
                        <select
                          value={evening}
                          onChange={(e) => setEvening(Number(e.target.value))}
                          className={selectCls}
                        >
                          {HOUR_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-xs leading-relaxed text-neutral-500">
                    Times are in West Africa Time (WAT, UTC+1). Make sure your WhatsApp
                    number is registered by sending any message to CashBot first.
                  </div>
                </div>
              )}

              {/* Feedback */}
              {error && (
                <p className="rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-xs text-red-400">
                  {error}
                </p>
              )}
              {saveOk && (
                <p className="rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-xs text-emerald-400">
                  Reminder settings saved successfully.
                </p>
              )}
              {testOk && (
                <p className="rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-xs text-emerald-400">
                  Test reminder requested!
                </p>
              )}

              {/* Test trigger */}
              <button
                type="button"
                onClick={handleTest}
                disabled={testSending}
                className="w-full px-4 py-2 text-xs font-medium rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testSending ? "Sending…" : "⚡ Send Test Reminder"}
              </button>

              {/* Actions */}
              <div className="flex gap-2 pb-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-sm text-neutral-400 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Reminder Settings"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
