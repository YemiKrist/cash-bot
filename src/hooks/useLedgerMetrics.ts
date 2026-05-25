import { useMemo } from "react";
import type { Transaction } from "@/lib/types";

// Asset-transfer tags that must never pollute operational KPIs.
export const ASSET_TRANSFER_TAGS = new Set(["investment", "savings"]);

// Tags that are always income regardless of stored transaction_type.
const INCOME_TAGS = new Set(["salary_income", "gifts_received"]);

const PERSONAL_CATEGORY_TAGS = [
  "food_groceries",
  "transport",
  "bills_utilities",
  "personal_luxury",
  "clothing",
  "investment",
  "family_gifting",
] as const;

export type PersonalCategoryTag = (typeof PERSONAL_CATEGORY_TAGS)[number];

export interface CategoryTotal {
  tag: PersonalCategoryTag;
  amount: number;
}

export interface LedgerMetrics {
  // Shared / personal
  trueIncome: number;
  trueExpenses: number;
  netProfit: number;
  trueSavingsRate: number;
  categoryTotals: CategoryTotal[];

  // Business-specific
  revenue: number;
  cogs: number;
  opex: number;
  grossProfit: number;
  operationalOutflows: number;

  // Net savings amount (for internal use)
  netSaved: number;
}

function sumByTag(
  txs: Transaction[],
  type: Transaction["transaction_type"],
  tag: string,
): number {
  return txs.reduce((acc, tx) => {
    if (tx.transaction_type !== type) return acc;
    if (tx.financial_tag !== tag) return acc;
    return acc + Math.abs(Number(tx.amount));
  }, 0);
}

export function useLedgerMetrics(transactions: Transaction[]): LedgerMetrics {
  return useMemo(() => {
    // ── True income: external inflows only, excludes investment/savings liquidations ──
    const trueIncome = transactions.reduce((acc, tx) => {
      if (ASSET_TRANSFER_TAGS.has(tx.financial_tag)) return acc;
      if (tx.transaction_type !== "inflow" && !INCOME_TAGS.has(tx.financial_tag)) return acc;
      return acc + Math.abs(Number(tx.amount));
    }, 0);

    // ── True expenses: operational outflows only, excludes investment/savings deposits ──
    const trueExpenses = transactions.reduce((acc, tx) => {
      if (tx.transaction_type !== "outflow") return acc;
      if (ASSET_TRANSFER_TAGS.has(tx.financial_tag)) return acc;
      if (INCOME_TAGS.has(tx.financial_tag)) return acc;
      return acc + Math.abs(Number(tx.amount));
    }, 0);

    const netProfit = trueIncome - trueExpenses;

    // ── Savings rate: net asset generation (deposits − liquidations) ÷ true income ──
    const netSaved = transactions
      .filter((tx) => ASSET_TRANSFER_TAGS.has(tx.financial_tag))
      .reduce((sum, tx) => {
        const absAmt = Math.abs(Number(tx.amount));
        return tx.transaction_type === "outflow" ? sum + absAmt : sum - absAmt;
      }, 0);

    const trueSavingsRate =
      trueIncome > 0 ? (Math.max(0, netSaved) / trueIncome) * 100 : 0;

    // ── Personal spending by category ──
    const categoryTotals: CategoryTotal[] = PERSONAL_CATEGORY_TAGS.map((tag) => {
      if (tag !== "investment") {
        return { tag, amount: sumByTag(transactions, "outflow", tag) };
      }
      // Investment: net — deposits add, liquidations subtract
      const netInvestment = transactions.reduce((acc, tx) => {
        if (tx.financial_tag !== "investment") return acc;
        const absAmt = Math.abs(Number(tx.amount));
        const isLiquidation =
          tx.transaction_type === "inflow" || Number(tx.amount) > 0;
        return isLiquidation ? acc - absAmt : acc + absAmt;
      }, 0);
      return { tag, amount: Math.max(0, netInvestment) };
    });

    // ── Business-specific figures ──
    const revenue = transactions.reduce((acc, tx) => {
      if (tx.transaction_type !== "inflow") return acc;
      if (ASSET_TRANSFER_TAGS.has(tx.financial_tag)) return acc;
      return acc + Math.abs(Number(tx.amount));
    }, 0);

    const cogs = sumByTag(transactions, "outflow", "cogs");
    const opex = sumByTag(transactions, "outflow", "opex");
    const grossProfit = revenue - cogs;

    const operationalOutflows = transactions.reduce((acc, tx) => {
      if (tx.transaction_type !== "outflow") return acc;
      if (ASSET_TRANSFER_TAGS.has(tx.financial_tag)) return acc;
      return acc + Math.abs(Number(tx.amount));
    }, 0);

    return {
      trueIncome,
      trueExpenses,
      netProfit,
      trueSavingsRate,
      categoryTotals,
      revenue,
      cogs,
      opex,
      grossProfit,
      operationalOutflows,
      netSaved,
    };
  }, [transactions]);
}
