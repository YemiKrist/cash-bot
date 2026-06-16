"use client";

import { Amt } from "@/components/Amt";
import { useLedgerMetrics } from "@/hooks/useLedgerMetrics";
import { formatMobile } from "@/lib/formatters";
import type { Transaction } from "@/lib/types";

interface Props { transactions: Transaction[] }

export function MobileSummaryBar({ transactions }: Props) {
  const { trueIncome, trueExpenses, netProfit } = useLedgerMetrics(transactions);
  return (
    <div className="flex border-b border-zinc-800">
      <div className="flex flex-1 flex-col items-center border-r border-zinc-800 px-2 py-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">In</p>
        <p className="mt-1 text-sm font-bold text-emerald-400"><Amt value={formatMobile(trueIncome)} /></p>
      </div>
      <div className="flex flex-1 flex-col items-center border-r border-zinc-800 px-2 py-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Out</p>
        <p className="mt-1 text-sm font-bold text-red-400"><Amt value={formatMobile(trueExpenses)} /></p>
      </div>
      <div className="flex flex-1 flex-col items-center px-2 py-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Net</p>
        <p className={`mt-1 text-sm font-bold ${netProfit >= 0 ? "text-white" : "text-red-400"}`}>
          {netProfit < 0 && <span className="font-sans text-xs">-</span>}
          <Amt value={formatMobile(Math.abs(netProfit))} />
        </p>
      </div>
    </div>
  );
}
