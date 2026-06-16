"use client";

import { NairaSign } from "@/components/Amt";
import { TxMenu } from "@/components/dashboard/TxMenu";
import { formatDateParts } from "@/lib/formatters";
import { TAG_COLORS, tagLabel } from "@/lib/tagConfig";
import type { Transaction } from "@/lib/types";

interface Props {
  tx: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

export function TransactionCard({ tx, onEdit, onDelete }: Props) {
  const amt = Number(tx.amount);
  const isOutflow = tx.transaction_type === "outflow" || amt < 0;
  const formatted = Math.abs(amt).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { date, time } = formatDateParts(tx.created_at);

  return (
    <div className="group flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3.5 transition-colors active:bg-zinc-800">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOutflow ? "bg-red-950/80" : "bg-emerald-950/80"}`}>
        {isOutflow ? (
          <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">
          {tx.description ?? <span className="italic text-zinc-500">No description</span>}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TAG_COLORS[tx.financial_tag] ?? "bg-zinc-800 text-zinc-400"}`}>
            {tagLabel(tx.financial_tag)}
          </span>
          <span className="text-[10px] text-zinc-600">-</span>
          <span className="truncate text-[10px] text-zinc-500">{date}</span>
          <span className="text-[10px] text-zinc-700">{time}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`text-right text-sm font-semibold tabular-nums ${isOutflow ? "text-red-500" : "text-emerald-400"}`}>
          <span className="font-sans">{isOutflow ? "-" : "+"}</span>
          <NairaSign />{formatted}
        </span>
        <TxMenu tx={tx} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}
