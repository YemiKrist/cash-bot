"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TransactionModal from "@/components/TransactionModal";
import InvoiceModal from "@/components/InvoiceModal";
import InvoiceList from "@/components/InvoiceList";
import AnalyticsSummary from "@/components/AnalyticsSummary";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { Transaction, Invoice } from "@/lib/types";

type Tab = "transactions" | "invoices" | "analytics";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    revenue: "Revenue",
    cogs: "COGS",
    opex: "OPEX",
    personal_essential: "Essential",
    personal_luxury: "Luxury",
  };
  return map[tag] ?? tag;
}

const TAG_COLORS: Record<string, string> = {
  revenue: "bg-emerald-900/50 text-emerald-400",
  cogs: "bg-amber-900/50 text-amber-400",
  opex: "bg-blue-900/50 text-blue-400",
  personal_essential: "bg-violet-900/50 text-violet-400",
  personal_luxury: "bg-pink-900/50 text-pink-400",
};

// ── Sub-components ───────────────────────────────────────────────────────────

function WorkspaceHeading() {
  const { activeBusiness } = useWorkspace();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
        Active Workspace
      </p>
      <h1 className="mt-0.5 text-2xl font-bold text-white">
        {activeBusiness ? activeBusiness.name : "Personal Ledger"}
      </h1>
    </div>
  );
}

interface LedgerTableProps {
  transactions: Transaction[];
  loading: boolean;
}

function LedgerTable({ transactions, loading }: LedgerTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <svg
          className="mb-4 h-10 w-10 text-zinc-700"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M9 17H7A5 5 0 0 1 7 7h2" />
          <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <p className="text-sm font-medium text-zinc-500">No transactions yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Hit "+ Add Transaction" to record your first entry.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Date
            </th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Description
            </th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Type
            </th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Tag
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
          {transactions.map((tx) => (
            <tr key={tx.id} className="group hover:bg-zinc-800/40 transition">
              <td className="whitespace-nowrap px-5 py-4 text-zinc-400">
                {formatDate(tx.created_at)}
              </td>
              <td className="max-w-[220px] truncate px-5 py-4 text-zinc-200">
                {tx.description ?? <span className="text-zinc-600 italic">—</span>}
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    tx.transaction_type === "inflow"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      tx.transaction_type === "inflow"
                        ? "bg-emerald-400"
                        : "bg-red-400"
                    }`}
                  />
                  {tx.transaction_type === "inflow" ? "Inflow" : "Outflow"}
                </span>
              </td>
              <td className="px-5 py-4">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    TAG_COLORS[tx.financial_tag] ?? "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {tagLabel(tx.financial_tag)}
                </span>
              </td>
              <td
                className={`whitespace-nowrap px-5 py-4 text-right font-mono font-semibold ${
                  tx.transaction_type === "inflow"
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {tx.transaction_type === "outflow" && "−"}
                {formatCurrency(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeBusiness } = useWorkspace();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [showTxModal, setShowTxModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Reset to transactions tab whenever the workspace changes
  useEffect(() => {
    setActiveTab("transactions");
  }, [activeBusiness]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTx(true);

    let query = supabase
      .from("transactions")
      .select("id, created_at, description, transaction_type, financial_tag, amount")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (activeBusiness) {
      query = query.eq("business_id", activeBusiness.id);
    } else {
      query = query.is("business_id", null);
    }

    const { data } = await query;
    setTransactions((data as Transaction[]) ?? []);
    setLoadingTx(false);
  }, [user, activeBusiness]);

  const fetchInvoices = useCallback(async () => {
    if (!activeBusiness) return;
    setLoadingInv(true);
    const { data } = await supabase
      .from("invoices")
      .select("id, business_id, invoice_number, client_name, project_name, total_amount, due_date, status")
      .eq("business_id", activeBusiness.id)
      .order("due_date", { ascending: true });
    setInvoices((data as Invoice[]) ?? []);
    setLoadingInv(false);
  }, [activeBusiness]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (activeBusiness) fetchInvoices();
    else setInvoices([]);
  }, [activeBusiness, fetchInvoices]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          <p className="text-xs text-zinc-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-5">
          <WorkspaceHeading />
          <div className="flex items-center gap-2">
            {activeBusiness && activeTab === "invoices" && (
              <button
                onClick={() => setShowInvModal(true)}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
              >
                <span className="text-base leading-none">＋</span>
                Issue Invoice
              </button>
            )}
            <button
              onClick={() => setShowTxModal(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition"
            >
              <span className="text-base leading-none">＋</span>
              Add Transaction
            </button>
          </div>
        </header>

        {/* Analytics */}
        <AnalyticsSummary transactions={transactions} />

        {/* Tabs — only shown for business workspaces */}
        {activeBusiness && (
          <div className="flex border-b border-zinc-800 px-8">
            {(["transactions", "invoices", "analytics"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative pb-3 pt-3 text-sm font-medium capitalize transition mr-6 ${
                  activeTab === tab
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "transactions"
                  ? "Transactions"
                  : tab === "invoices"
                  ? "Invoices & A/R"
                  : "Analytics"}
                {activeTab === tab && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!activeBusiness || activeTab === "transactions" ? (
            <LedgerTable transactions={transactions} loading={loadingTx} />
          ) : activeTab === "invoices" ? (
            <InvoiceList invoices={invoices} loading={loadingInv} />
          ) : (
            <AnalyticsDashboard />
          )}
        </div>
      </main>

      {showTxModal && (
        <TransactionModal
          onClose={() => setShowTxModal(false)}
          onSaved={fetchTransactions}
        />
      )}

      {showInvModal && (
        <InvoiceModal
          onClose={() => setShowInvModal(false)}
          onSaved={fetchInvoices}
        />
      )}
    </div>
  );
}
