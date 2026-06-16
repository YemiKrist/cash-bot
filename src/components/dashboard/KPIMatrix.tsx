"use client";

import { useLedgerMetrics } from "@/hooks/useLedgerMetrics";
import { formatCurrency } from "@/lib/formatters";
import type { Transaction } from "@/lib/types";

interface CardProps {
  label: string;
  value: string;
  sub: string;
  color: "emerald" | "red" | "auto";
  amount?: number;
}

function KPICard({ label, value, sub, color, amount }: CardProps) {
  const textColor =
    color === "emerald" ? "text-emerald-400"
    : color === "red" ? "text-red-400"
    : (amount ?? 0) >= 0 ? "text-emerald-400"
    : "text-red-400";

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800/70 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold leading-none tabular-nums ${textColor}`}>{value}</p>
      <p className="mt-2 text-[11px] text-zinc-600">{sub}</p>
    </div>
  );
}

interface Props {
  transactions: Transaction[];
  isBusiness: boolean;
}

export function KPIMatrix({ transactions, isBusiness }: Props) {
  const m = useLedgerMetrics(transactions);

  if (isBusiness) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KPICard label="Revenue" value={formatCurrency(m.revenue)} sub="Total inflows" color="emerald" />
        <KPICard label="Gross Profit" value={formatCurrency(m.grossProfit)} sub="Revenue - COGS" color="emerald" />
        <KPICard label="Net Profit" value={formatCurrency(m.netProfit)} sub="Gross profit - OPEX" color="auto" amount={m.netProfit} />
        <KPICard label="Operational Outflows" value={formatCurrency(m.operationalOutflows)} sub="Total outflows (all tags)" color="red" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <KPICard label="Revenue" value={formatCurrency(m.trueIncome)} sub="Total inflows" color="emerald" />
      <KPICard label="Gross Profit" value={formatCurrency(m.trueIncome - m.trueExpenses)} sub="Income - Expenses" color="auto" amount={m.trueIncome - m.trueExpenses} />
      <KPICard label="Net Profit" value={formatCurrency(m.netProfit)} sub="After all deductions" color="auto" amount={m.netProfit} />
      <KPICard label="Operational Outflows" value={formatCurrency(m.trueExpenses)} sub="Total outflows (all tags)" color="red" />
    </div>
  );
}
