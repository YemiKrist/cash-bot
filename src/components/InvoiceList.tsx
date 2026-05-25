"use client";

import { useState } from "react";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { Amt } from "@/components/Amt";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso).getTime() - today.getTime()) / 86_400_000);
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-chiron-deep-alt/50 text-chiron-neon border-chiron-deep/50",
  partially_paid: "bg-amber-900/50 text-amber-400 border-amber-800/50",
  unpaid: "bg-zinc-800/80 text-zinc-400 border-zinc-700/50",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Paid",
  partially_paid: "Part. Paid",
  unpaid: "Unpaid",
};

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  invoices: Invoice[];
  loading: boolean;
  onEdit?: (inv: Invoice) => void;
  onDelete?: (inv: Invoice) => void;
}

export default function InvoiceList({ invoices, loading, onEdit, onDelete }: Props) {
  const [confirmInvId, setConfirmInvId] = useState<string | null>(null);
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-16 text-center">
        <svg className="mb-4 h-10 w-10 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <p className="text-sm font-medium text-zinc-500">No invoices yet</p>
        <p className="mt-1 text-xs text-zinc-600">Hit "＋ Issue Invoice" to raise your first invoice.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full min-w-[660px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {["Invoice #", "Client", "Project", "Due Date", "Total", "Status", ""].map((h, i) => (
              <th
                key={i}
                className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 ${
                  h === "Total" || h === "Status" ? "text-right" : h === "" ? "w-10" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
          {invoices.map((inv) => {
            const overdue =
              inv.status === "unpaid" &&
              inv.due_date !== null &&
              daysUntil(inv.due_date) < 0;

            return (
              <tr key={inv.id} className="group hover:bg-zinc-800/40 transition">
                <td className="whitespace-nowrap px-5 py-4 font-sans text-xs text-zinc-300">
                  {inv.invoice_number}
                </td>
                <td className="max-w-[160px] truncate px-5 py-4 font-medium text-zinc-200">
                  {inv.client_name}
                </td>
                <td className="max-w-[140px] truncate px-5 py-4 text-zinc-400">
                  {inv.project?.name ?? <span className="italic text-zinc-600">—</span>}
                </td>
                <td className={`whitespace-nowrap px-5 py-4 ${overdue ? "text-red-400" : "text-zinc-400"}`}>
                  {inv.due_date ? formatDate(inv.due_date) : "—"}
                  {overdue && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-500">
                      Overdue
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-zinc-200">
                  <Amt value={formatCurrency(inv.total_amount)} />
                </td>
                <td className="px-5 py-4 text-right">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                    {STATUS_LABELS[inv.status]}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(inv)}
                        className="rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-zinc-700 hover:text-zinc-200 group-hover:opacity-100"
                        aria-label="Edit invoice"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      confirmInvId === inv.id ? (
                        <div className="flex items-center gap-1 opacity-100">
                          <button
                            onClick={() => { onDelete(inv); setConfirmInvId(null); }}
                            className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-red-500"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmInvId(null)}
                            className="rounded-lg p-1.5 text-zinc-500 transition hover:text-zinc-300"
                            aria-label="Cancel"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmInvId(inv.id)}
                          className="rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-red-950/60 hover:text-red-400 group-hover:opacity-100"
                          aria-label="Delete invoice"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
