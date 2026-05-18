"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function InvoiceModal({ onClose, onSaved }: Props) {
  const { activeBusiness } = useWorkspace();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

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

    const { error: dbError } = await supabase.from("invoices").insert({
      business_id: activeBusiness.id,
      invoice_number: invoiceNumber.trim(),
      client_name: clientName.trim(),
      project_name: projectName.trim() || null,
      total_amount: parsed,
      due_date: dueDate,
      status: "unpaid",
    });

    setSaving(false);

    if (dbError) {
      setError(
        dbError.code === "23505"
          ? `Invoice number "${invoiceNumber}" already exists for this business.`
          : dbError.message
      );
      return;
    }

    onSaved();
    onClose();
  }

  const field =
    "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Issue Invoice</h2>
            {activeBusiness && (
              <p className="mt-0.5 text-xs text-zinc-500">{activeBusiness.name}</p>
            )}
          </div>
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

        {/* Guard banner */}
        {!activeBusiness && (
          <div className="mx-6 mt-5 rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-xs text-amber-400">
            Switch to a business workspace to issue invoices. Personal profiles cannot raise client invoices.
          </div>
        )}

        {/* Form */}
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

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Project Name <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Brand Identity Redesign"
              className={field}
            />
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

          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-400">
              {error}
            </p>
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
              className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? "Saving…" : "Issue Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
