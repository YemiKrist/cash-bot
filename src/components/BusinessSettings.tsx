"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";

// ── Hour helpers ─────────────────────────────────────────────────────────────

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

// ── Reusable select wrapper ──────────────────────────────────────────────────

const fieldCls =
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

interface Props {
  onClose: () => void;
}

interface Aggregates {
  grossRevenue:  number;
  totalOpex:     number;
  vatLiability:  number;
  whtCredits:    number;
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "amber" | "blue" | "violet";
}) {
  const dotColor =
    accent === "emerald" ? "bg-emerald-500" :
    accent === "amber"   ? "bg-amber-400"   :
    accent === "blue"    ? "bg-blue-400"     :
    accent === "violet"  ? "bg-violet-400"   :
    "bg-zinc-500";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <p className="text-xs font-medium text-neutral-500">{label}</p>
      </div>
      <p className="text-lg font-semibold text-neutral-100 font-sans">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-600">{sub}</p>}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BusinessSettings({ onClose }: Props) {
  const { activeBusiness } = useWorkspace();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [agg, setAgg] = useState<Aggregates>({ grossRevenue: 0, totalOpex: 0, vatLiability: 0, whtCredits: 0 });

  // ── Reminder state ─────────────────────────────────────────────────────────
  const [reminderLoading, setReminderLoading] = useState(true);
  const [reminderSaving,  setReminderSaving]  = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [morningHour,     setMorningHour]     = useState(9);
  const [eveningHour,     setEveningHour]     = useState(18);
  const [reminderSaveOk,  setReminderSaveOk]  = useState(false);
  const [reminderError,   setReminderError]   = useState<string | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;

    async function load() {
      const [txRes, projRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount, transaction_type, financial_tag, project_id")
          .eq("business_id", activeBusiness!.id),
        supabase
          .from("projects")
          .select("id, track_vat, track_wht, wht_rate_percent")
          .eq("business_id", activeBusiness!.id),
      ]);

      const txns   = txRes.data   ?? [];
      const projs  = projRes.data ?? [];

      type ProjTax = { id: string; track_vat: boolean; track_wht: boolean; wht_rate_percent: number };
      const taxMap = new Map<string, ProjTax>(
        (projs as ProjTax[]).map((p) => [p.id, p])
      );

      let grossRevenue = 0, totalOpex = 0, vatLiability = 0, whtCredits = 0;

      for (const tx of txns as { amount: number; transaction_type: string; financial_tag: string; project_id: string | null }[]) {
        const amount = Number(tx.amount);
        if (tx.transaction_type === "inflow") {
          grossRevenue += amount;
          const proj = tx.project_id ? taxMap.get(tx.project_id) : null;
          if (proj?.track_vat)  vatLiability += amount - amount / 1.075;
          if (proj?.track_wht)  whtCredits   += amount * ((proj.wht_rate_percent ?? 5) / 100);
        }
        if (
          tx.transaction_type === "outflow" &&
          (tx.financial_tag === "cogs" || tx.financial_tag === "opex")
        ) {
          totalOpex += amount;
        }
      }

      setAgg({ grossRevenue, totalOpex, vatLiability, whtCredits });
      setLoading(false);
    }

    load();
  }, [activeBusiness]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load reminder settings independently of business metrics.
  useEffect(() => {
    async function loadReminders() {
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
          setReminderEnabled(d.enabled      ?? false);
          setMorningHour(d.morning_hour ?? 9);
          setEveningHour(d.evening_hour ?? 18);
        }
      } finally {
        setReminderLoading(false);
      }
    }
    loadReminders();
  }, []);

  async function handleReminderSave(e: React.FormEvent) {
    e.preventDefault();
    setReminderError(null);
    setReminderSaveOk(false);
    setReminderSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const res = await fetch("/api/reminders", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enabled:      reminderEnabled,
        morning_hour: morningHour,
        evening_hour: eveningHour,
        timezone:     "Africa/Lagos",
      }),
    });

    setReminderSaving(false);

    if (!res.ok) {
      const json = await res.json() as { error?: string };
      setReminderError(json.error ?? "Save failed.");
      return;
    }

    setReminderSaveOk(true);
    setTimeout(() => setReminderSaveOk(false), 2500);
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-4"
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-neutral-800 bg-zinc-900 shadow-2xl sm:max-w-md sm:rounded-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-400 transition hover:bg-neutral-700 hover:text-white"
            aria-label="Close settings"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">Business Overview</h2>
            {activeBusiness && (
              <p className="mt-0.5 truncate text-xs text-neutral-500">{activeBusiness.name}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-500" />
            </div>
          ) : (
            <div className="space-y-4 px-6 py-6">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  Aggregate Metrics
                </p>
                <p className="text-xs text-neutral-600">
                  Combined totals across all projects in this business.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Gross Revenue"
                  value={fmt(agg.grossRevenue)}
                  sub="All inflow transactions"
                  accent="emerald"
                />
                <MetricCard
                  label="Total OpEx"
                  value={fmt(agg.totalOpex)}
                  sub="COGS + operating expenses"
                  accent="amber"
                />
                <MetricCard
                  label="Combined VAT Liabilities"
                  value={fmt(agg.vatLiability)}
                  sub="Output VAT across VAT-tracked projects"
                  accent="blue"
                />
                <MetricCard
                  label="Total WHT Credit Notes"
                  value={fmt(agg.whtCredits)}
                  sub="WHT withheld across WHT-tracked projects"
                  accent="violet"
                />
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-xs leading-relaxed text-neutral-500">
                VAT and WHT tracking is configured individually on each project contract.
                Open a project's settings to enable or adjust tax rules.
              </div>

              {/* ── Automated WhatsApp Reminders ─────────────────────────── */}
              <div className="border-t border-neutral-800 pt-4">
                <div className="mb-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Automated WhatsApp Reminders
                  </p>
                  <p className="text-xs text-neutral-600">
                    Daily accountability pings sent to your registered WhatsApp number.
                  </p>
                </div>

                {reminderLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-500" />
                  </div>
                ) : (
                  <form onSubmit={handleReminderSave} className="space-y-3">
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
                        onClick={() => setReminderEnabled((v) => !v)}
                        className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition-colors ${
                          reminderEnabled ? "bg-emerald-500" : "bg-neutral-700"
                        }`}
                        role="switch"
                        aria-checked={reminderEnabled}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            reminderEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Time dropdowns — only visible when enabled */}
                    {reminderEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                            Morning Reminder Hour
                          </label>
                          <div className="relative">
                            <select
                              value={morningHour}
                              onChange={(e) => setMorningHour(Number(e.target.value))}
                              className={fieldCls}
                            >
                              {HOUR_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <ChevronDown />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                            Evening Reminder Hour
                          </label>
                          <div className="relative">
                            <select
                              value={eveningHour}
                              onChange={(e) => setEveningHour(Number(e.target.value))}
                              className={fieldCls}
                            >
                              {HOUR_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <ChevronDown />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    {reminderError && (
                      <p className="rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-xs text-red-400">
                        {reminderError}
                      </p>
                    )}
                    {reminderSaveOk && (
                      <p className="rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-xs text-emerald-400">
                        Reminder settings saved successfully.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={reminderSaving}
                      className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reminderSaving ? "Saving…" : "Save Reminder Settings"}
                    </button>
                  </form>
                )}
              </div>

              <div className="pb-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-neutral-700 py-2.5 text-sm text-neutral-400 transition hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
