"use client";

import { NairaSign } from "@/components/Amt";
import { TxMenu } from "@/components/dashboard/TxMenu";
import { formatDateParts } from "@/lib/formatters";
import { TAG_COLORS, tagLabel } from "@/lib/tagConfig";
import type { Transaction } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  loading: boolean;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

export function LedgerTable({ transactions, loading, onEdit, onDelete }: Props) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-800/60" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <svg className="mb-4 h-10 w-10 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 0 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <p className="text-sm font-medium text-zinc-500">No transactions yet</p>
        <p className="mt-1 text-xs text-zinc-600">Hit "+ Add Transaction" to record your first entry.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/90">
            {["Date", "Description", "Type", "Tag", "Amount", ""].map((h, i) => (
              <th key={i} className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 ${i === 4 ? "text-right" : i === 5 ? "w-10" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, idx) => {
            const amt = Number(tx.amount);
            const isOutflow = tx.transaction_type === "outflow" || amt < 0;
            const formatted = Math.abs(amt).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const { date, time } = formatDateParts(tx.created_at);
            const rowBg = idx % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/50";
            return (
              <tr key={tx.id} className={`group transition hover:bg-zinc-800/50 ${rowBg}`}>
                <td className="whitespace-nowrap px-5 py-4">
                  <p className="text-xs font-medium text-zinc-300">{date}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">{time}</p>
                </td>
                <td className="max-w-[200px] truncate px-5 py-4 text-zinc-200">
                  {tx.description ?? <span className="italic text-zinc-600">-</span>}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${isOutflow ? "bg-red-500" : "bg-emerald-500"}`} />
                    <span className={`text-xs font-medium ${isOutflow ? "text-red-400" : "text-emerald-400"}`}>
                      {isOutflow ? "Outflow" : "Inflow"}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLORS[tx.financial_tag] ?? "bg-zinc-800 text-zinc-400"}`}>
                    {tagLabel(tx.financial_tag)}
                  </span>
                </td>
                <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums ${isOutflow ? "text-red-400" : "text-emerald-400"}`}>
                  <span className="font-sans">{isOutflow ? "-" : "+"}</span>
                  <NairaSign />{formatted}
                </td>
                <td className="py-4 pl-3 pr-5 text-right">
                  <TxMenu tx={tx} onEdit={onEdit} onDelete={onDelete} tableRow />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
