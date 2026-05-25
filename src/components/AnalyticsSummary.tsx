"use client";

import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useLedgerMetrics } from "@/hooks/useLedgerMetrics";
import type { Transaction } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
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
      ? "text-chiron-neon"
      : positive === false
      ? "text-red-400"
      : "text-white";

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-bold leading-none ${valueColor}`}>
        <span className="font-sans">{value}</span>
      </p>
      {sub && <p className="mt-2 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

// ── Personal category config ──────────────────────────────────────────────────

const PERSONAL_CATEGORIES = [
  { tag: "food_groceries",  label: "Food & Groceries",   accent: "text-orange-400", bar: "bg-orange-400", badge: "bg-orange-900/40 text-orange-400" },
  { tag: "transport",       label: "Transport",           accent: "text-cyan-400",   bar: "bg-cyan-400",   badge: "bg-cyan-900/40 text-cyan-400"   },
  { tag: "bills_utilities", label: "Bills & Utilities",   accent: "text-violet-400", bar: "bg-violet-400", badge: "bg-violet-900/40 text-violet-400" },
  { tag: "personal_luxury", label: "Luxury / Lifestyle",  accent: "text-pink-400",   bar: "bg-pink-400",   badge: "bg-pink-900/40 text-pink-400"   },
  { tag: "clothing",        label: "Clothing",            accent: "text-rose-400",   bar: "bg-rose-400",   badge: "bg-rose-900/40 text-rose-400"   },
  { tag: "investment",      label: "Savings",             accent: "text-teal-400",   bar: "bg-teal-400",   badge: "bg-teal-900/40 text-teal-400"   },
  { tag: "family_gifting",  label: "Family & Gifting",    accent: "text-purple-400", bar: "bg-purple-400", badge: "bg-purple-900/40 text-purple-400" },
] as const;

// ── Business cards ────────────────────────────────────────────────────────────

function BusinessSummary({ transactions }: { transactions: Transaction[] }) {
  const { revenue, grossProfit, netProfit, operationalOutflows } = useLedgerMetrics(transactions);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatCard
        label="Money In"
        value={formatCurrency(revenue)}
        positive={revenue > 0}
        sub="All earnings received"
      />
      <StatCard
        label="Gross Profit"
        value={formatCurrency(grossProfit)}
        positive={grossProfit >= 0}
        sub="Revenue − COGS"
      />
      <StatCard
        label="Take-Home Profit"
        value={formatCurrency(netProfit)}
        positive={netProfit >= 0}
        sub="Gross profit − OPEX"
      />
      <StatCard
        label="Running Costs"
        value={formatCurrency(operationalOutflows)}
        sub="All business expenses"
      />
    </div>
  );
}

// ── Personal cards ────────────────────────────────────────────────────────────

function PersonalSummary({ transactions }: { transactions: Transaction[] }) {
  const {
    trueIncome,
    trueExpenses,
    netProfit,
    trueSavingsRate,
    categoryTotals,
  } = useLedgerMetrics(transactions);

  const maxCategoryAmount = Math.max(...categoryTotals.map((c) => c.amount), 1);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Money In"
          value={formatCurrency(trueIncome)}
          positive={trueIncome > 0}
          sub="All income received"
        />
        <StatCard
          label="Money Out"
          value={formatCurrency(trueExpenses)}
          sub="All expenses paid"
        />
        <StatCard
          label="Take-Home Profit"
          value={formatCurrency(netProfit)}
          positive={netProfit >= 0}
          sub="Money In − Money Out"
        />
        <StatCard
          label="Savings Rate"
          value={`${trueSavingsRate.toFixed(1)}%`}
          positive={trueSavingsRate >= 0}
          sub="Net saved ÷ Income"
        />
      </div>

      {/* Spending breakdown by category */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Spending Breakdown
        </p>
        <div className="space-y-2.5">
          {PERSONAL_CATEGORIES.map((cat) => {
            const catData = categoryTotals.find((c) => c.tag === cat.tag);
            const amount = catData?.amount ?? 0;
            const pct = trueExpenses === 0 ? 0 : (amount / trueExpenses) * 100;
            const barWidth = trueExpenses === 0 ? 0 : (amount / maxCategoryAmount) * 100;
            return (
              <div key={cat.tag} className="flex items-center gap-3">
                <span className={`w-[118px] shrink-0 text-[11px] font-medium ${cat.accent}`}>
                  {cat.label}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${cat.bar} transition-all duration-300`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-[88px] shrink-0 text-right text-[11px] text-zinc-400">
                  {formatCurrency(amount)}
                </span>
                <span className={`w-9 shrink-0 rounded-full px-1 py-0.5 text-center text-[9px] font-bold ${cat.badge}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
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
    <section className="px-4 pb-2 pt-4 lg:px-8 lg:pt-6">
      {activeBusiness ? (
        <BusinessSummary transactions={transactions} />
      ) : (
        <PersonalSummary transactions={transactions} />
      )}
    </section>
  );
}
