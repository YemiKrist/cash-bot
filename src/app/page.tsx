"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BusinessSettings from "@/components/BusinessSettings";
import ReminderSettings from "@/components/ReminderSettings";
import TransactionModal from "@/components/TransactionModal";
import InvoiceModal from "@/components/InvoiceModal";
import InvoiceList from "@/components/InvoiceList";
import AnalyticsSummary from "@/components/AnalyticsSummary";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import ProjectSettings from "@/components/ProjectSettings";
import { Amt } from "@/components/Amt";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { Transaction, Invoice } from "@/lib/types";

type Tab = "transactions" | "invoices" | "analytics";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toFixed(0)}`;
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

// ── Business avatar helpers ───────────────────────────────────────────────────

const BIZ_PALETTE = [
  "bg-violet-600", "bg-blue-600", "bg-emerald-600", "bg-amber-500",
  "bg-rose-600",   "bg-cyan-600", "bg-orange-500",  "bg-indigo-600",
];

function bizInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function bizColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return BIZ_PALETTE[h % BIZ_PALETTE.length];
}

const TAG_COLORS: Record<string, string> = {
  revenue: "bg-emerald-900/50 text-emerald-400",
  cogs: "bg-amber-900/50 text-amber-400",
  opex: "bg-blue-900/50 text-blue-400",
  personal_essential: "bg-violet-900/50 text-violet-400",
  personal_luxury: "bg-pink-900/50 text-pink-400",
};

// ── Bottom nav icons ──────────────────────────────────────────────────────────

function IconTransactions() {
  return (
    <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconInvoices() {
  return (
    <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// ── Mobile bottom nav tab ─────────────────────────────────────────────────────

function MobileNavTab({
  icon,
  label,
  active,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-1 pb-1 pt-2 transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-30"
          : active
          ? "text-emerald-400"
          : "text-zinc-500 active:text-zinc-300"
      }`}
    >
      <span className={`transition-transform duration-150 ${active ? "scale-110" : ""}`}>
        {icon}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
    </button>
  );
}

// ── Mobile compact summary strip ──────────────────────────────────────────────

function MobileSummaryBar({ transactions }: { transactions: Transaction[] }) {
  const totalIn = transactions
    .filter((t) => t.transaction_type === "inflow")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.transaction_type === "outflow")
    .reduce((s, t) => s + t.amount, 0);
  const net = totalIn - totalOut;

  return (
    <div className="flex border-b border-zinc-800">
      <div className="flex flex-1 flex-col items-center border-r border-zinc-800 px-2 py-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">In</p>
        <p className="mt-1 text-sm font-bold text-emerald-400">
          <Amt value={formatCompact(totalIn)} />
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center border-r border-zinc-800 px-2 py-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Out</p>
        <p className="mt-1 text-sm font-bold text-red-400">
          <Amt value={formatCompact(totalOut)} />
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center px-2 py-3">
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Net</p>
        <p className={`mt-1 text-sm font-bold ${net >= 0 ? "text-white" : "text-red-400"}`}>
          {net < 0 && <span className="font-sans text-xs">−</span>}
          <Amt value={formatCompact(Math.abs(net))} />
        </p>
      </div>
    </div>
  );
}

// ── Per-row action menu (⋮ hamburger) ────────────────────────────────────────

function TxMenu({
  tx,
  onEdit,
  onDelete,
  tableRow = false,
}: {
  tx: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  tableRow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setConfirming(false); }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200"
        aria-label="Transaction options"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5"  r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-1 w-40 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {confirming ? (
            <div className="px-3 py-3">
              <p className="mb-2.5 text-xs font-medium text-zinc-300">Delete this transaction?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete?.(tx); setOpen(false); setConfirming(false); }}
                  className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white transition hover:bg-red-500"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg bg-zinc-800 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <>
              {onEdit && (
                <button
                  onClick={() => { onEdit(tx); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => setConfirming(true)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 transition hover:bg-zinc-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mobile transaction card ───────────────────────────────────────────────────

function TransactionCard({
  tx,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}) {
  const isInflow = tx.transaction_type === "inflow";
  return (
    <div className="group flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3.5 transition-colors active:bg-zinc-800">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isInflow ? "bg-emerald-950/80" : "bg-red-950/80"
        }`}
      >
        {isInflow ? (
          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">
          {tx.description ?? <span className="italic text-zinc-500">No description</span>}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              TAG_COLORS[tx.financial_tag] ?? "bg-zinc-800 text-zinc-400"
            }`}
          >
            {tagLabel(tx.financial_tag)}
          </span>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="truncate text-[10px] text-zinc-500">{formatDate(tx.created_at)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className={`text-right text-sm font-semibold ${isInflow ? "text-emerald-400" : "text-red-400"}`}>
          {!isInflow && <span className="font-sans text-xs">−</span>}
          <Amt value={formatCurrency(tx.amount)} />
        </div>
        <TxMenu tx={tx} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ── Desktop workspace heading ─────────────────────────────────────────────────

function WorkspaceHeading({
  projectName,
  onBusinessClick,
}: {
  projectName: string | null;
  onBusinessClick?: () => void;
}) {
  const { activeBusiness } = useWorkspace();
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
        Active Business/Project
      </p>
      <h1 className="mt-0.5 truncate text-2xl font-bold text-white">
        {projectName ? (
          <>
            {projectName}
            <button
              type="button"
              onClick={onBusinessClick}
              className="text-xl font-normal text-zinc-500 transition hover:text-zinc-300 hover:underline underline-offset-2"
            >
              {" "}— {activeBusiness?.name}
            </button>
          </>
        ) : (
          activeBusiness ? activeBusiness.name : "Personal Ledger"
        )}
      </h1>
    </div>
  );
}

// ── Desktop ledger table ──────────────────────────────────────────────────────

interface LedgerTableProps {
  transactions: Transaction[];
  loading: boolean;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

function LedgerTable({ transactions, loading, onEdit, onDelete }: LedgerTableProps) {
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
        <svg className="mb-4 h-10 w-10 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 17H7A5 5 0 0 1 7 7h2" />
          <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <p className="text-sm font-medium text-zinc-500">No transactions yet</p>
        <p className="mt-1 text-xs text-zinc-600">Hit "+ Add Transaction" to record your first entry.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {["Date", "Description", "Type", "Tag", "Amount", ""].map((h, i) => (
              <th
                key={i}
                className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 ${
                  i === 4 ? "text-right" : i === 5 ? "w-10" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
          {transactions.map((tx) => (
            <tr key={tx.id} className="group transition hover:bg-zinc-800/40">
              <td className="whitespace-nowrap px-5 py-4 text-zinc-400">{formatDate(tx.created_at)}</td>
              <td className="max-w-[220px] truncate px-5 py-4 text-zinc-200">
                {tx.description ?? <span className="italic text-zinc-600">—</span>}
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    tx.transaction_type === "inflow" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      tx.transaction_type === "inflow" ? "bg-emerald-400" : "bg-red-400"
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
                className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                  tx.transaction_type === "inflow" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {tx.transaction_type === "outflow" && <span className="font-sans">−</span>}
                <Amt value={formatCurrency(tx.amount)} />
              </td>
              <td className="py-4 pl-3 pr-5 text-right">
                <TxMenu tx={tx} onEdit={onEdit} onDelete={onDelete} tableRow />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Workspace manage menu (⋮ button near Add Transaction) ────────────────────

type MenuMode = "idle" | "renameBiz" | "confirmDeleteBiz" | "renameProj" | "confirmDeleteProj";

interface WorkspaceMenuProps {
  activeProjectId: string | null;
  activeProjectName: string | null;
  onProjectRenamed: (newName: string) => void;
  onProjectDeleted: () => void;
  onWorkspaceMutated: () => void;
}

function WorkspaceMenu({
  activeProjectId,
  activeProjectName,
  onProjectRenamed,
  onProjectDeleted,
  onWorkspaceMutated,
}: WorkspaceMenuProps) {
  const { activeBusiness, renameBusiness, deleteBusiness } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MenuMode>("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [showProjSettings, setShowProjSettings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("idle");
        setError(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!activeBusiness) return null;

  function openMenu() {
    setMode("idle");
    setInput("");
    setError(null);
    setOpen((o) => !o);
  }

  async function handleRenameBiz(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setWorking(true);
    setError(null);
    const err = await renameBusiness(activeBusiness!.id, input.trim());
    setWorking(false);
    if (err) { setError(err); return; }
    setOpen(false);
    setMode("idle");
  }

  async function handleDeleteBiz() {
    setWorking(true);
    await deleteBusiness(activeBusiness!.id);
    setWorking(false);
    setOpen(false);
    setMode("idle");
  }

  async function handleRenameProj(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeProjectId) return;
    setWorking(true);
    setError(null);
    const { error: err } = await supabase
      .from("projects")
      .update({ name: input.trim() })
      .eq("id", activeProjectId);
    setWorking(false);
    if (err) { setError(err.message); return; }
    onProjectRenamed(input.trim());
    onWorkspaceMutated();
    setOpen(false);
    setMode("idle");
  }

  async function handleDeleteProj() {
    if (!activeProjectId) return;
    setWorking(true);
    await supabase.from("projects").delete().eq("id", activeProjectId);
    setWorking(false);
    onProjectDeleted();
    onWorkspaceMutated();
    setOpen(false);
    setMode("idle");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openMenu}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
        aria-label="Manage business/project"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {mode === "idle" && (
            <div className="p-1.5">
              {activeProjectId && (
                <>
                  <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Project: {activeProjectName}
                  </p>
                  <button
                    onClick={() => { setMode("renameProj"); setInput(activeProjectName ?? ""); setError(null); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                  >
                    <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Rename Project
                  </button>

                  {/* Contract Billing & Compliance */}
                  <button
                    onClick={() => { setOpen(false); setMode("idle"); setShowProjSettings(true); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                  >
                    <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>
                      Contract Billing &amp; Compliance
                      <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400">
                        VAT · WHT
                      </span>
                    </span>
                  </button>

                  <div className="my-1 border-t border-zinc-800" />
                  <button
                    onClick={() => { setMode("confirmDeleteProj"); setError(null); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-950/50"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Delete Project
                  </button>
                  <div className="my-1.5 border-t border-zinc-800" />
                </>
              )}
              <p className="px-2.5 pb-1 pt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Business: {activeBusiness.name}
              </p>
              <button
                onClick={() => { setMode("renameBiz"); setInput(activeBusiness.name); setError(null); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Rename Business
              </button>
              <button
                onClick={() => { setMode("confirmDeleteBiz"); setError(null); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-950/50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete Business
              </button>
            </div>
          )}

          {(mode === "renameBiz" || mode === "renameProj") && (
            <form
              onSubmit={mode === "renameBiz" ? handleRenameBiz : handleRenameProj}
              className="p-3"
            >
              <p className="mb-2 text-xs font-semibold text-zinc-400">
                {mode === "renameBiz" ? "Rename Business" : "Rename Project"}
              </p>
              <input
                autoFocus
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(null); }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
              <div className="mt-2 flex gap-1.5">
                <button
                  type="submit"
                  disabled={working || !input.trim()}
                  className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition"
                >
                  {working ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("idle"); setError(null); }}
                  className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {(mode === "confirmDeleteBiz" || mode === "confirmDeleteProj") && (
            <div className="p-3">
              <p className="mb-1 text-xs font-semibold text-zinc-300">
                {mode === "confirmDeleteBiz"
                  ? `Delete "${activeBusiness.name}"?`
                  : `Delete "${activeProjectName}"?`}
              </p>
              <p className="mb-3 text-xs text-zinc-500">This can't be undone.</p>
              {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={mode === "confirmDeleteBiz" ? handleDeleteBiz : handleDeleteProj}
                  disabled={working}
                  className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {working ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => { setMode("idle"); setError(null); }}
                  className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showProjSettings && activeProjectId && (
        <ProjectSettings
          projectId={activeProjectId}
          projectName={activeProjectName ?? ""}
          onClose={() => setShowProjSettings(false)}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeBusiness, businesses, setActiveBusiness } = useWorkspace();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [showTxModal, setShowTxModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analyticsProjectId, setAnalyticsProjectId] = useState<string | null>(null);
  const [analyticsProjectName, setAnalyticsProjectName] = useState<string | null>(null);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  type DatePreset = "day" | "week" | "month" | "year" | "custom";
  const [activePreset, setActivePreset] = useState<DatePreset>("month");
  const [startDate,    setStartDate]    = useState<Date>(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0); });
  const [endDate,      setEndDate]      = useState<Date>(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59, 999); });
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    setSearchQuery("");
    setActivePreset("month");
    setCustomStart("");
    setCustomEnd("");
    const n = new Date();
    setStartDate(new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0));
    setEndDate(new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59, 999));
  }, [activeBusiness, activeTab]);

  useEffect(() => {
    setActiveTab("transactions");
    setAnalyticsProjectId(null);
    setAnalyticsProjectName(null);
  }, [activeBusiness]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTx(true);
    let query = supabase
      .from("transactions")
      .select("id, created_at, description, transaction_type, financial_tag, amount, project_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (activeBusiness) {
      query = query.eq("business_id", activeBusiness.id);
    } else {
      query = query.is("business_id", null);
    }
    if (analyticsProjectId) {
      query = query.eq("project_id", analyticsProjectId);
    }
    const { data } = await query;
    setTransactions((data as Transaction[]) ?? []);
    setLoadingTx(false);
  }, [user, activeBusiness, analyticsProjectId]);

  const fetchInvoices = useCallback(async () => {
    if (!activeBusiness) return;
    setLoadingInv(true);
    let invQuery = supabase
      .from("invoices")
      .select("id, business_id, invoice_number, client_name, project_id, project:projects(name), total_amount, due_date, status")
      .eq("business_id", activeBusiness.id)
      .order("due_date", { ascending: true });
    if (analyticsProjectId) {
      invQuery = invQuery.eq("project_id", analyticsProjectId);
    }
    const { data } = await invQuery;
    setInvoices((data as unknown as Invoice[]) ?? []);
    setLoadingInv(false);
  }, [activeBusiness, analyticsProjectId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
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

  function applyPreset(preset: Exclude<DatePreset, "custom">) {
    const n = new Date();
    const [y, m, d] = [n.getFullYear(), n.getMonth(), n.getDate()];
    let s: Date, e: Date;
    if (preset === "day") {
      s = new Date(y, m, d, 0, 0, 0, 0);
      e = new Date(y, m, d, 23, 59, 59, 999);
    } else if (preset === "week") {
      const dow = n.getDay();
      s = new Date(y, m, d - dow, 0, 0, 0, 0);
      e = new Date(y, m, d + (6 - dow), 23, 59, 59, 999);
    } else if (preset === "month") {
      s = new Date(y, m, 1, 0, 0, 0, 0);
      e = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } else {
      s = new Date(y, 0, 1, 0, 0, 0, 0);
      e = new Date(y, 11, 31, 23, 59, 59, 999);
    }
    setStartDate(s);
    setEndDate(e);
    setActivePreset(preset);
  }

  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      tx.description?.toLowerCase().includes(q) ||
      tx.financial_tag?.toLowerCase().includes(q) ||
      tx.transaction_type?.toLowerCase().includes(q) ||
      tx.amount?.toString().includes(q);
    const txDate = new Date(tx.created_at);
    const matchesDate = txDate >= startDate && txDate <= endDate;
    return matchesSearch && matchesDate;
  });

  async function handleDeleteTx(tx: Transaction) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    fetchTransactions();
  }

  async function handleDeleteInv(inv: Invoice) {
    await supabase.from("invoices").delete().eq("id", inv.id);
    fetchInvoices();
  }

  function clearProject() {
    setAnalyticsProjectId(null);
    setAnalyticsProjectName(null);
  }

  function fabAction() {
    if (activeTab === "invoices" && activeBusiness) {
      setShowInvModal(true);
    } else {
      setShowTxModal(true);
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onProjectClick={(id, name) => {
          setAnalyticsProjectId(id);
          setAnalyticsProjectName(name);
          setActiveTab("analytics");
          setSidebarOpen(false);
        }}
        onSettingsClick={() => setShowSettings(true)}
        onReminderSettingsClick={() => setShowReminderSettings(true)}
        projectsRefreshKey={projectsRefreshKey}
        activeProjectId={analyticsProjectId}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* ── Mobile header ───────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 transition"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {analyticsProjectId && activeBusiness ? (
              <button
                type="button"
                onClick={clearProject}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-zinc-400 transition active:bg-zinc-800 hover:text-zinc-200"
                aria-label={`Back to ${activeBusiness.name}`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="max-w-[120px] truncate">{activeBusiness.name}</span>
              </button>
            ) : (
              <span className="text-base font-bold tracking-tight text-white">
                Cash<span className="text-emerald-400">Bot</span>
              </span>
            )}
          </div>

          {/* Workspace chip + manage menu */}
          <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => setWorkspaceDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 active:bg-zinc-700 transition"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="max-w-[120px] truncate">
                {analyticsProjectName ?? activeBusiness?.name ?? "Personal"}
              </span>
              <svg
                className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${workspaceDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {workspaceDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setWorkspaceDropdownOpen(false)}
                />
                {/* Dropdown panel */}
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
                  <p className="px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Switch Business/Project
                  </p>
                  <div className="p-1">
                    {/* Personal Ledger */}
                    <button
                      onClick={() => {
                        setActiveBusiness(null);
                        clearProject();
                        setWorkspaceDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        activeBusiness === null
                          ? "bg-emerald-950/60 text-emerald-400"
                          : "text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700"
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-bold text-white ${
                        activeBusiness === null ? "ring-1 ring-emerald-400 ring-offset-1 ring-offset-zinc-900" : ""
                      }`}>
                        PL
                      </span>
                      <span className="flex-1 truncate">Personal Ledger</span>
                      {activeBusiness === null && (
                        <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    {/* Business workspaces */}
                    {businesses.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setActiveBusiness(b);
                          clearProject();
                          setWorkspaceDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          activeBusiness?.id === b.id
                            ? "bg-emerald-950/60 text-emerald-400"
                            : "text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700"
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${bizColor(b.name)} ${
                          activeBusiness?.id === b.id ? "ring-1 ring-emerald-400 ring-offset-1 ring-offset-zinc-900" : ""
                        }`}>
                          {bizInitials(b.name)}
                        </span>
                        <span className="flex-1 truncate">{b.name}</span>
                        {activeBusiness?.id === b.id && (
                          <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <WorkspaceMenu
            activeProjectId={analyticsProjectId}
            activeProjectName={analyticsProjectName}
            onProjectRenamed={(name) => setAnalyticsProjectName(name)}
            onProjectDeleted={() => { setAnalyticsProjectId(null); setAnalyticsProjectName(null); }}
            onWorkspaceMutated={() => setProjectsRefreshKey((k) => k + 1)}
          />
          </div>
        </header>

        {/* ── Desktop header ───────────────────────────────────────────────── */}
        <header className="hidden items-center justify-between gap-3 border-b border-zinc-800 px-8 py-5 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex-shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition xl:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <WorkspaceHeading projectName={analyticsProjectName} onBusinessClick={clearProject} />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <WorkspaceMenu
              activeProjectId={analyticsProjectId}
              activeProjectName={analyticsProjectName}
              onProjectRenamed={(name) => setAnalyticsProjectName(name)}
              onProjectDeleted={() => { setAnalyticsProjectId(null); setAnalyticsProjectName(null); }}
              onWorkspaceMutated={() => setProjectsRefreshKey((k) => k + 1)}
              />
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
              onClick={() => setActiveTab(activeTab === "analytics" ? "transactions" : "analytics")}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === "analytics"
                  ? "border-emerald-500 text-emerald-400 hover:border-emerald-400"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
              }`}
              aria-label="Toggle analytics"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6"  y1="20" x2="6"  y2="14" />
              </svg>
              Analytics
            </button>
            <button
              onClick={() => setShowTxModal(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition"
            >
              <span className="text-base leading-none">＋</span>
              Add Transaction
            </button>
          </div>
        </header>

        {/* ── Summary strips ───────────────────────────────────────────────── */}
        {activeTab !== "analytics" && (
          <>
            {/* Mobile 3-number bar */}
            <div className="lg:hidden">
              <MobileSummaryBar transactions={transactions} />
            </div>
            {/* Desktop full KPI grid */}
            <div className="hidden lg:block">
              <AnalyticsSummary transactions={transactions} />
            </div>
          </>
        )}

        {/* ── Desktop tabs ─────────────────────────────────────────────────── */}
        {activeBusiness && (
          <div className="hidden overflow-x-auto border-b border-zinc-800 px-8 lg:flex">
            {(["transactions", "invoices"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative mr-6 shrink-0 whitespace-nowrap pb-3 pt-3 text-sm font-medium capitalize transition ${
                  activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "transactions" ? "Transactions" : "Invoices & A/R"}
                {activeTab === tab && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 lg:px-8 lg:py-6 lg:pb-6">
          {activeTab === "analytics" ? (
            activeBusiness ? (
              <AnalyticsDashboard
                projectId={analyticsProjectId}
                onProjectChange={(id, name) => {
                  setAnalyticsProjectId(id);
                  setAnalyticsProjectName(name);
                }}
                onSettingsClick={() => setShowSettings(true)}
              />
            ) : (
              <AnalyticsSummary transactions={transactions} />
            )
          ) : activeTab === "invoices" && activeBusiness ? (
            <InvoiceList invoices={invoices} loading={loadingInv} onEdit={setEditingInv} onDelete={handleDeleteInv} />
          ) : (
            <>
              {/* Search + date filter toolbar */}
              {!loadingTx && (
                <div className="mb-4 space-y-2">
                  {/* Search input */}
                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search transactions by description, tag, or keyword..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-10 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-500 transition hover:text-zinc-200"
                        aria-label="Clear search"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Date filter row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(["day", "week", "month", "year"] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          activePreset === preset
                            ? "bg-emerald-500 text-zinc-950"
                            : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {preset === "day" ? "Today" : preset === "week" ? "This Week" : preset === "month" ? "This Month" : "This Year"}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setActivePreset("custom")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        activePreset === "custom"
                          ? "bg-emerald-500 text-zinc-950"
                          : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      Custom
                    </button>

                    {activePreset === "custom" && (
                      <>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => {
                            setCustomStart(e.target.value);
                            if (e.target.value) setStartDate(new Date(e.target.value + "T00:00:00"));
                          }}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-emerald-500 [color-scheme:dark]"
                        />
                        <span className="text-xs text-zinc-600">→</span>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => {
                            setCustomEnd(e.target.value);
                            if (e.target.value) setEndDate(new Date(e.target.value + "T23:59:59"));
                          }}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-emerald-500 [color-scheme:dark]"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile card list */}
              <div className="space-y-2 lg:hidden">
                {loadingTx ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-zinc-800" />
                  ))
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80">
                      <svg className="h-8 w-8 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                        <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    </div>
                    <p className="text-base font-semibold text-zinc-400">No transactions yet</p>
                    <p className="mt-1 text-sm text-zinc-600">Tap + to record your first entry</p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm text-zinc-500">
                      {searchQuery
                        ? <>🔍 No transactions matching <span className="font-medium text-zinc-300">"{searchQuery}"</span> in this period.</>
                        : "No transactions in this date range."}
                    </p>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => <TransactionCard key={tx.id} tx={tx} onEdit={setEditingTx} onDelete={handleDeleteTx} />)
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block">
                {!loadingTx && filteredTransactions.length === 0 ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20">
                    <p className="text-sm text-zinc-500">
                      {searchQuery
                        ? <>🔍 No transactions matching <span className="font-medium text-zinc-300">"{searchQuery}"</span> in this period.</>
                        : "No transactions in this date range."}
                    </p>
                  </div>
                ) : (
                  <LedgerTable transactions={filteredTransactions} loading={loadingTx} onEdit={setEditingTx} onDelete={handleDeleteTx} />
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md lg:hidden">
          <div className="relative flex items-end">
            <MobileNavTab
              icon={<IconTransactions />}
              label="Ledger"
              active={activeTab === "transactions"}
              onClick={() => setActiveTab("transactions")}
            />
            <MobileNavTab
              icon={<IconInvoices />}
              label="Bills"
              active={activeTab === "invoices"}
              onClick={() => { if (activeBusiness) setActiveTab("invoices"); }}
              disabled={!activeBusiness}
            />

            {/* FAB — elevated above the nav bar */}
            <div className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={fabAction}
                className="relative -translate-y-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30 transition-transform active:scale-95 active:bg-emerald-400"
                aria-label={activeTab === "invoices" && activeBusiness ? "Issue Invoice" : "Add Transaction"}
              >
                <svg className="h-6 w-6 text-zinc-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            <MobileNavTab
              icon={<IconAnalytics />}
              label="Analytics"
              active={activeTab === "analytics"}
              onClick={() => setActiveTab(activeTab === "analytics" ? "transactions" : "analytics")}
            />
            <MobileNavTab
              icon={<IconMenu />}
              label="Menu"
              active={false}
              onClick={() => setSidebarOpen(true)}
            />
          </div>
          {/* iPhone home indicator clearance */}
          <div className="h-5" />
        </nav>

      </main>

      {(showTxModal || editingTx) && (
        <TransactionModal
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
          onSaved={fetchTransactions}
          initialData={editingTx ?? undefined}
        />
      )}
      {(showInvModal || editingInv) && (
        <InvoiceModal
          onClose={() => { setShowInvModal(false); setEditingInv(null); }}
          onSaved={fetchInvoices}
          initialData={editingInv ?? undefined}
        />
      )}
      {showSettings && (
        <BusinessSettings onClose={() => setShowSettings(false)} />
      )}
      {showReminderSettings && (
        <ReminderSettings onClose={() => setShowReminderSettings(false)} />
      )}
    </div>
  );
}
