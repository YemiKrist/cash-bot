"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";

interface Props {
  onClose: () => void;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

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
        checked ? "bg-emerald-500" : "bg-zinc-700"
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
    <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-800/40 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

const WHT_RATE_OPTIONS = [
  { value: "5",  label: "5% — Standard Contracts, Construction, Digital Infrastructures" },
  { value: "10", label: "10% — Professional Fees, Consulting, Agency Retainers" },
] as const;

const WHT_INFO = `Withholding Tax (WHT) is deducted upfront at source by corporate clients. Cash Bot will log these as advance tax credits to track against your FIRS / NRS TaxPro-Max annual clearance.`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusinessSettings({ onClose }: Props) {
  const { activeBusiness } = useWorkspace();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [enableVat, setEnableVat] = useState(false);
  const [vatRate,   setVatRate]   = useState("7.5");
  const [enableWht, setEnableWht] = useState(false);
  const [whtRate,   setWhtRate]   = useState<"5" | "10">("5");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saveOk,    setSaveOk]    = useState(false);

  useEffect(() => {
    if (!activeBusiness) return;
    supabase
      .from("businesses")
      .select("enable_vat, default_vat_rate, enable_wht, wht_rate_percent")
      .eq("id", activeBusiness.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEnableVat(data.enable_vat       ?? false);
          setVatRate(String(data.default_vat_rate ?? 7.5));
          setEnableWht(data.enable_wht       ?? false);
          setWhtRate((data.wht_rate_percent ?? 5) >= 7.5 ? "10" : "5");
        }
        setLoading(false);
      });
  }, [activeBusiness]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusiness) return;
    setError(null);
    setSaveOk(false);

    const parsedVatRate = parseFloat(vatRate);
    if (enableVat && (isNaN(parsedVatRate) || parsedVatRate < 0 || parsedVatRate > 100)) {
      setError("VAT rate must be between 0 and 100.");
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const res = await fetch(`/api/businesses/${activeBusiness.id}/tax`, {
      method:  "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({
        enable_vat:       enableVat,
        default_vat_rate: enableVat ? parsedVatRate : 7.5,
        enable_wht:       enableWht,
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
    "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-4"
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:max-w-md sm:rounded-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
            aria-label="Close settings"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">Business Settings</h2>
            {activeBusiness && (
              <p className="mt-0.5 truncate text-xs text-zinc-500">{activeBusiness.name}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6 px-6 py-6">

              {/* ── VAT ─────────────────────────────────────────────────────── */}
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    VAT &amp; Tax Settings
                  </p>
                  <p className="text-xs text-zinc-600">
                    Default rules applied to all projects unless a contract override is set.
                  </p>
                </div>

                <ToggleRow
                  label="Enable VAT"
                  description="Apply Nigerian VAT to inflow revenue across this business."
                  checked={enableVat}
                  onChange={setEnableVat}
                />

                {enableVat && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Default VAT Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value)}
                        placeholder="7.5"
                        className={fieldCls}
                      />
                    </div>
                    <div className="rounded-xl border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-xs leading-relaxed text-blue-300">
                      <span className="font-semibold">How it works: </span>
                      Output VAT is split from inflow revenue on all projects. Input VAT on
                      COGS &amp; OPEX outflows is offset. Net quarterly liability appears on
                      your analytics dashboard. Individual projects can override this.
                    </div>
                  </div>
                )}

                {/* ── WHT ─────────────────────────────────────────────────── */}
                <ToggleRow
                  label="Track Withholding Tax (WHT)"
                  description="Log WHT deductions as advance tax credits against your annual FIRS clearance."
                  checked={enableWht}
                  onChange={setEnableWht}
                />

                {enableWht && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        WHT Rate
                      </label>
                      <select
                        value={whtRate}
                        onChange={(e) => setWhtRate(e.target.value as "5" | "10")}
                        className={fieldCls}
                      >
                        {WHT_RATE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* WHT info banner — shown whenever the WHT row is visible */}
                <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3">
                  <span className="mt-px shrink-0 text-base leading-none">ℹ️</span>
                  <p className="text-xs leading-relaxed text-zinc-500">{WHT_INFO}</p>
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
                  className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:text-white"
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
