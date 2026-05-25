"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { Invoice, InvoiceStatus } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
};

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Invoice;
}

export default function InvoiceModal({ onClose, onSaved, initialData }: Props) {
  const { activeBusiness } = useWorkspace();

  const isEditing = !!initialData;

  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoice_number ?? "");
  const [clientName, setClientName] = useState(initialData?.client_name ?? "");
  const [projectId, setProjectId] = useState(initialData?.project_id ?? "");
  const [amount, setAmount] = useState(initialData ? String(initialData.total_amount) : "");
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? defaultDueDate());
  const [status, setStatus] = useState<InvoiceStatus>(initialData?.status ?? "unpaid");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeBusiness) { setProjects([]); if (!isEditing) setProjectId(""); return; }
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
  }, [activeBusiness, isEditing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!activeBusiness) {
      setError("Invoices can only be issued under an active business profile.");
      return;
    }

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }

    setSaving(true);

    if (isEditing) {
      const { error: dbError } = await supabase
        .from("invoices")
        .update({
          invoice_number: invoiceNumber.trim(),
          client_name: clientName.trim(),
          project_id: projectId || null,
          total_amount: parsed,
          due_date: dueDate,
          status,
        })
        .eq("id", initialData.id);

      setSaving(false);
      if (dbError) {
        setError(
          dbError.code === "23505"
            ? `Invoice number "${invoiceNumber}" already exists for this business.`
            : dbError.message,
        );
        return;
      }
    } else {
      const { error: dbError } = await supabase.from("invoices").insert({
        business_id: activeBusiness.id,
        invoice_number: invoiceNumber.trim(),
        client_name: clientName.trim(),
        project_id: projectId || null,
        total_amount: parsed,
        due_date: dueDate,
        status: "unpaid",
      });

      setSaving(false);
      if (dbError) {
        setError(
          dbError.code === "23505"
            ? `Invoice number "${invoiceNumber}" already exists for this business.`
            : dbError.message,
        );
        return;
      }
    }

    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    const { error: dbError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", initialData!.id);
    setDeleting(false);
    if (dbError) { setError(dbError.message); return; }
    onSaved();
    onClose();
  }

  const field =
    "block w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-chiron-neon focus:ring-1 focus:ring-chiron-neon transition";

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
            aria-label="Go back"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">
              {isEditing ? "Edit Invoice" : "Issue Invoice"}
            </h2>
            {activeBusiness && (
              <p className="mt-0.5 truncate text-xs text-zinc-500">{activeBusiness.name}</p>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto">
          {!activeBusiness && (
            <div className="mx-6 mt-5 rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-xs text-amber-400">
              Switch to a business or project to issue invoices.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Invoice Number <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-001"
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Due Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`${field} [color-scheme:dark]`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Acme Corporation"
                className={field}
              />
            </div>

            {/* Project dropdown */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Project <span className="text-zinc-600">(optional)</span>
              </label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={projectsLoading}
                  className="block w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 pr-10 text-sm text-neutral-200 outline-none focus:border-chiron-neon focus:ring-1 focus:ring-chiron-neon disabled:opacity-50 transition"
                >
                  <option value="">— No project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Total Amount (NGN) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={field}
              />
            </div>

            {/* Status — edit mode only */}
            {isEditing && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Status</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                    className="block w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 pr-10 text-sm text-neutral-200 outline-none focus:border-chiron-neon focus:ring-1 focus:ring-chiron-neon transition"
                  >
                    {(["unpaid", "partially_paid", "paid"] as InvoiceStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-800 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
            )}

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
                disabled={saving || !activeBusiness}
                className="flex-1 rounded-lg bg-chiron-neon py-2.5 text-sm font-semibold text-zinc-950 hover:bg-chiron-neon disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? "Saving…" : isEditing ? "Save Changes" : "Issue Invoice"}
              </button>
            </div>

            {/* Delete — edit mode only */}
            {isEditing && (
              <div className="border-t border-zinc-800 pt-4">
                {deleteConfirm ? (
                  <div className="flex items-center gap-3">
                    <p className="flex-1 text-xs text-zinc-400">Delete this invoice permanently?</p>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition"
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-2 text-xs text-zinc-600 hover:text-red-400 transition"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Delete invoice
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
