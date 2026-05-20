"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

const WHT_RATE_OPTIONS = [
  { value: "5",  label: "5% — Standard Contracts, Construction, Digital Infrastructures" },
  { value: "10", label: "10% — Professional Fees, Consulting, Agency Retainers" },
] as const;

const WHT_INFO =
  "Withholding Tax (WHT) is deducted upfront at source by corporate clients. " +
  "Cash Bot will log these as advance tax credits to track against your FIRS / NRS TaxPro-Max annual clearance.";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-neutral-700"
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function ProjectSettings({ projectId, projectName, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [trackVat, setTrackVat] = useState(false);
  const [trackWht, setTrackWht] = useState(false);
  const [whtRate,  setWhtRate]  = useState<"5" | "10">("5");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [saveOk,   setSaveOk]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch(`/api/projects/${projectId}/tax`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const d = await res.json() as {
          track_vat:        boolean;
          track_wht:        boolean;
          wht_rate_percent: number;
        };
        setTrackVat(d.track_vat ?? false);
        setTrackWht(d.track_wht ?? false);
        setWhtRate((d.wht_rate_percent ?? 5) >= 7.5 ? "10" : "5");
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveOk(false);
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const res = await fetch(`/api/projects/${projectId}/tax`, {
      method:  "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({
        track_vat:        trackVat,
        track_wht:        trackWht,
        wht_rate_percent: parseFloat(whtRate),
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

  const fieldCls =
    "block w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50";

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
            <h2 className="text-base font-semibold text-white">Project Settings</h2>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{projectName}</p>
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

              {/* ── Tax & Compliance ──────────────────────────────────────── */}
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Tax &amp; Compliance
                  </p>
                  <p className="text-xs text-neutral-600">
                    Configure tax rules specifically for this project contract.
                  </p>
                </div>

                {/* VAT toggle */}
                <ToggleRow
                  label="Track 7.5% VAT for this Project Invoice"
                  description="Splits output VAT from each inflow so you can remit to FIRS via TaxPro-Max."
                  checked={trackVat}
                  onChange={setTrackVat}
                />

                {trackVat && (
                  <div className="rounded-xl border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-xs leading-relaxed text-blue-300">
                    <span className="font-semibold">How it works: </span>
                    Each inflow is treated as VAT-inclusive. True revenue = gross ÷ 1.075.
                    The extracted VAT appears as an output liability on your analytics dashboard.
                  </div>
                )}

                {/* WHT toggle */}
                <ToggleRow
                  label="Track Withholding Tax (WHT)"
                  description="Client deducts WHT before paying. Track credit notes for FIRS TCC clearance."
                  checked={trackWht}
                  onChange={setTrackWht}
                />

                {/* WHT rate dropdown — visible when WHT is on */}
                {trackWht && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                        WHT Rate
                      </label>
                      <div className="relative">
                        <select
                          value={whtRate}
                          onChange={(e) => setWhtRate(e.target.value as "5" | "10")}
                          className={`${fieldCls} appearance-none pr-10`}
                        >
                          {WHT_RATE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <svg
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Combined VAT + WHT explainer */}
                {trackVat && trackWht && (
                  <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-300">
                    <span className="font-semibold">Both VAT &amp; WHT active: </span>
                    VAT splits true revenue from the tax collected.
                    WHT is separately withheld by the client before payment.
                    Both breakdowns appear in your WhatsApp confirmation.
                  </div>
                )}

                {/* WHT info banner */}
                <div className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-800/30 px-4 py-3">
                  <span className="mt-px shrink-0 text-base leading-none">ℹ️</span>
                  <p className="text-xs leading-relaxed text-neutral-500">{WHT_INFO}</p>
                </div>
              </div>

              {/* Errors / success */}
              {error && (
                <p className="rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-xs text-red-400">
                  {error}
                </p>
              )}
              {saveOk && (
                <p className="rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-xs text-emerald-400">
                  Settings saved successfully.
                </p>
              )}

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
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
