"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { Transaction } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
}

function sumWhere(
  txs: Transaction[],
  type: Transaction["transaction_type"],
  tag?: string
): number {
  return txs.reduce((acc, tx) => {
    if (tx.transaction_type !== type) return acc;
    if (tag && tx.financial_tag !== tag) return acc;
    return acc + tx.amount;
  }, 0);
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface CardProps {
  label: string;
  value: string;
  /** When true → emerald glow; when false → red glow; undefined → neutral */
  positive?: boolean;
  sub?: string;
}

function StatCard({ label, value, positive, sub }: CardProps) {
  const valueColor =
    positive === true
      ? "text-emerald-400"
      : positive === false
      ? "text-red-400"
      : "text-white";

  const glowClass =
    positive === true
      ? "shadow-[0_0_18px_-4px_rgba(52,211,153,0.25)]"
      : positive === false
      ? "shadow-[0_0_18px_-4px_rgba(248,113,113,0.2)]"
      : "";

  return (
    <div
      className={`flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6 ${glowClass}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-3 font-mono text-2xl font-bold leading-none ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

// ── Business cards ────────────────────────────────────────────────────────────

function BusinessSummary({ transactions }: { transactions: Transaction[] }) {
  const { revenue, grossProfit, netProfit, operationalOutflows } = useMemo(() => {
    const revenue = sumWhere(transactions, "inflow");
    const cogs = sumWhere(transactions, "outflow", "cogs");
    const opex = sumWhere(transactions, "outflow", "opex");
    const operationalOutflows = sumWhere(transactions, "outflow");
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - opex;
    return { revenue, grossProfit, netProfit, operationalOutflows };
  }, [transactions]);

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label="Revenue"
        value={formatCurrency(revenue)}
        positive={revenue > 0}
        sub="Total inflows"
      />
      <StatCard
        label="Gross Profit"
        value={formatCurrency(grossProfit)}
        positive={grossProfit >= 0}
        sub="Revenue − COGS"
      />
      <StatCard
        label="Net Profit"
        value={formatCurrency(netProfit)}
        positive={netProfit >= 0}
        sub="Gross profit − OPEX"
      />
      <StatCard
        label="Operational Outflows"
        value={formatCurrency(operationalOutflows)}
        sub="Total outflows (all tags)"
      />
    </div>
  );
}

// ── Personal cards ────────────────────────────────────────────────────────────

function PersonalSummary({ transactions }: { transactions: Transaction[] }) {
  const { savingsRate, survivalBurn, discretionaryPool } = useMemo(() => {
    const totalIn = sumWhere(transactions, "inflow");
    const totalOut = sumWhere(transactions, "outflow");
    const savingsRate =
      totalIn === 0 ? 0 : ((totalIn - totalOut) / totalIn) * 100;
    const survivalBurn = sumWhere(transactions, "outflow", "personal_essential");
    const discretionaryPool = sumWhere(transactions, "outflow", "personal_luxury");
    return { savingsRate, survivalBurn, discretionaryPool };
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Savings Rate"
        value={`${savingsRate.toFixed(1)}%`}
        positive={savingsRate >= 0}
        sub="(Inflows − Outflows) ÷ Inflows"
      />
      <StatCard
        label="Survival Burn Core"
        value={formatCurrency(survivalBurn)}
        sub="Essential personal outflows"
      />
      <StatCard
        label="Discretionary Pool"
        value={formatCurrency(discretionaryPool)}
        sub="Luxury personal outflows"
      />
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
}

export default function AnalyticsSummary({ transactions }: Props) {
  const { activeBusiness } = useWorkspace();

  return (
    <section className="px-8 pt-6 pb-2">
      {activeBusiness ? (
        <BusinessSummary transactions={transactions} />
      ) : (
        <PersonalSummary transactions={transactions} />
      )}
    </section>
  );
}
