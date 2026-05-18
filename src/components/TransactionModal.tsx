"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";

type SavePhase = "idle" | "uploading" | "saving";

// ── Types ────────────────────────────────────────────────────────────────────

type TransactionType = "inflow" | "outflow";

type FinancialTag =
  | "revenue"
  | "cogs"
  | "opex"
  | "personal_essential"
  | "personal_luxury";

function tagsFor(type: TransactionType, hasBusiness: boolean): FinancialTag[] {
  if (type === "inflow") return ["revenue"];
  return hasBusiness ? ["cogs", "opex"] : ["personal_essential", "personal_luxury"];
}

function tagLabel(tag: FinancialTag): string {
  const map: Record<FinancialTag, string> = {
    revenue: "Revenue",
    cogs: "Cost of Goods Sold (COGS)",
    opex: "Operating Expense (OPEX)",
    personal_essential: "Personal Essential",
    personal_luxury: "Personal Luxury",
  };
  return map[tag];
}

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadReceipt(file: File, userId: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `receipts/${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDatetimeNow(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function TransactionModal({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { activeBusiness } = useWorkspace();

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("inflow");
  const [tag, setTag] = useState<FinancialTag>("revenue");
  const [description, setDescription] = useState("");
  const [datetime, setDatetime] = useState(localDatetimeNow);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch projects for active business
  useEffect(() => {
    if (!activeBusiness) { setProjects([]); setProjectId(""); return; }
    setProjectsLoading(true);
    supabase
      .from("projects")
      .select("id, name")
      .eq("business_id", activeBusiness.id)
      .order("name")
      .then(({ data }) => {
        setProjects((data as { id: string; name: string }[]) ?? []);
        setProjectsLoading(false);
      });
  }, [activeBusiness]);

  // Reset project selection when switching workspaces
  useEffect(() => { setProjectId(""); }, [activeBusiness]);

  // Keep tag valid whenever type or workspace changes
  useEffect(() => {
    const valid = tagsFor(type, activeBusiness !== null);
    if (!valid.includes(tag)) setTag(valid[0]);
  }, [type, activeBusiness, tag]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be signed in to record a transaction.");
      return;
    }

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }

    let mediaStorageUrl: string | null = null;

    if (receipt) {
      setPhase("uploading");
      try {
        mediaStorageUrl = await uploadReceipt(receipt, user.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Receipt upload failed.");
        setPhase("idle");
        return;
      }
    }

    setPhase("saving");

    const { error: dbError } = await supabase.from("transactions").insert({
      user_id: user.id,
      business_id: activeBusiness?.id ?? null,
      amount: parsed,
      transaction_type: type,
      financial_tag: tag,
      description: description.trim() || null,
      media_storage_url: mediaStorageUrl,
      project_id: projectId || null,
      created_at: new Date(datetime).toISOString(),
    });

    setPhase("idle");

    if (dbError) {
      setError(dbError.message);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      {/* Panel */}
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">New Transaction</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:text-white transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Type toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Type
            </label>
            <div className="flex rounded-lg border border-zinc-700 bg-zinc-800 p-0.5">
              {(["inflow", "outflow"] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                    type === t
                      ? t === "inflow"
                        ? "bg-emerald-500 text-zinc-950"
                        : "bg-red-500 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t === "inflow" ? "Inflow" : "Outflow"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Amount ({activeBusiness ? "NGN" : "NGN"})
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Financial tag */}
          <div>
            <label htmlFor="tag" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Financial Tag
            </label>
            <div className="relative">
              <select
                id="tag"
                value={tag}
                onChange={(e) => setTag(e.target.value as FinancialTag)}
                className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 pr-9 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              >
                {tagsFor(type, activeBusiness !== null).map((t) => (
                  <option key={t} value={t}>
                    {tagLabel(t)}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Project (business only) */}
          {activeBusiness && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Project <span className="text-zinc-600">(optional)</span>
              </label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={projectsLoading}
                  className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 pr-9 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition"
                >
                  <option value="">— No project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {!projectsLoading && projects.length === 0 && (
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  No projects yet — add one from the sidebar to link it here.
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes…"
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Receipt / Invoice upload */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Receipt / Invoice{" "}
              <span className="text-zinc-600">(optional — image or PDF)</span>
            </label>

            {receipt ? (
              /* File selected — show preview row */
              <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-200">{receipt.name}</p>
                  <p className="text-[10px] text-zinc-500">{formatBytes(receipt.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-red-400 transition"
                  aria-label="Remove file"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Drop zone / picker button */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-zinc-700 bg-zinc-800/50 px-3.5 py-3 text-left transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                <svg className="h-4 w-4 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-xs text-zinc-500">Click to attach a receipt or invoice</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setReceipt(file);
                setError(null);
              }}
            />
          </div>

          {/* Date & Time */}
          <div>
            <label htmlFor="datetime" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Date & Time
            </label>
            <input
              id="datetime"
              type="datetime-local"
              required
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition [color-scheme:dark]"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-400">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={phase !== "idle" || !user}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {phase === "uploading" && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
              )}
              {phase === "uploading"
                ? "Uploading receipt…"
                : phase === "saving"
                ? "Saving…"
                : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
