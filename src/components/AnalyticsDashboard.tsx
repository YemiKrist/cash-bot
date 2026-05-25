"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { supabase } from "@/lib/supabase";
import {
  useAnalytics,
  useProjectAnalytics,
  useProjects,
  useTaxSummary,
} from "@/hooks/useAnalytics";
import { Amt, NairaSign } from "@/components/Amt";
import { useFinancialPDFExport } from "@/components/financial-statement-pdf";
import type { WeeklySummaryRow, ProjectSummaryRow, TaxSummary } from "@/lib/types";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

// ── Project filter dropdown ───────────────────────────────────────────────────

interface ProjectFilterProps {
  selectedId: string | null;
  onChange: (id: string | null) => void;
  options: { id: string; name: string }[];
  loading: boolean;
}

function ProjectFilter({ selectedId, onChange, options, loading }: ProjectFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="h-3.5 w-3.5 shrink-0 text-zinc-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M2 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" />
      </svg>
      <div className="relative">
        <select
          value={selectedId ?? "all"}
          onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
          disabled={loading}
          className="appearance-none rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 pr-8 text-xs font-medium text-neutral-300 outline-none transition hover:border-neutral-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        >
          <option value="all">All Projects</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {selectedId && (
        <button
          onClick={() => onChange(null)}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          aria-label="Clear project filter"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  change?: number | null;
  positive?: boolean;
  sub?: string;
}

function SummaryCard({ label, value, change, positive, sub }: SummaryCardProps) {
  const valueColor =
    positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-white";

  const changeColor =
    change == null ? "text-zinc-600" : change >= 0 ? "text-emerald-500" : "text-red-500";

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold leading-none ${valueColor}`}>
        <span className="font-sans">{value}</span>
      </p>
      <div className="mt-2">
        {change != null ? (
          <span className={`text-xs font-semibold ${changeColor}`}>
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}% vs prior week
          </span>
        ) : sub ? (
          <span className="text-xs text-zinc-600">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCSV(
  rows: WeeklySummaryRow[],
  projects: ProjectSummaryRow[],
  workspaceName: string,
  activeProjectName: string | null,
) {
  const sections: string[] = [];

  const scope = activeProjectName ? ` — ${activeProjectName}` : "";
  sections.push(`WEEKLY PERFORMANCE${scope}`);
  sections.push(["Week Start", "Inflow (NGN)", "Outflow (NGN)", "Net Balance (NGN)"].join(","));
  rows.forEach((r) =>
    sections.push(
      [r.week_start, r.total_inflow.toFixed(2), r.total_outflow.toFixed(2), r.net_balance.toFixed(2)].join(","),
    ),
  );

  if (!activeProjectName && projects.length > 0) {
    sections.push("");
    sections.push("PROJECT BREAKDOWN");
    sections.push(
      ["Project", "Inflow (NGN)", "Outflow (NGN)", "Net Balance (NGN)", "Invoices", "Transactions"].join(","),
    );
    projects.forEach((p) =>
      sections.push(
        [
          `"${p.project_name}"`,
          p.total_inflow.toFixed(2),
          p.total_outflow.toFixed(2),
          p.net_balance.toFixed(2),
          p.invoice_count,
          p.tx_count,
        ].join(","),
      ),
    );
  }

  const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cashbot_${workspaceName.replace(/\s+/g, "_")}${activeProjectName ? `_${activeProjectName.replace(/\s+/g, "_")}` : ""}_analytics.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export ────────────────────────────────────────────────────────────────

function exportPDF(
  rows: WeeklySummaryRow[],
  projectRows: ProjectSummaryRow[],
  workspaceName: string,
  activeProjectName: string | null,
  totals: { inflow: number; outflow: number; net: number; margin: string },
  categories: { label: string; amount: number; pct: string }[],
) {
  const generatedAt = new Date().toLocaleString("en-NG", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const periodStart = rows.length ? fmtDate(rows[rows.length - 1].week_start) : "—";
  const periodEnd   = rows.length ? fmtDate(rows[0].week_start) : "—";

  const weekRows = rows.map((r) => `
    <tr>
      <td>${fmtDate(r.week_start)}</td>
      <td class="num green">₦${r.total_inflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
      <td class="num red">₦${r.total_outflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
      <td class="num ${r.net_balance >= 0 ? "green" : "red"}">₦${r.net_balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
    </tr>`).join("");

  const catRows = categories.map((c) => `
    <tr>
      <td>${c.label}</td>
      <td class="num">₦${c.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
      <td class="num">${c.pct}%</td>
    </tr>`).join("");

  const projSection = !activeProjectName && projectRows.length > 0 ? `
  <div class="section">
    <div class="section-title">Project Performance</div>
    <table>
      <thead><tr>
        <th>Project</th>
        <th style="text-align:right">Inflow</th>
        <th style="text-align:right">Outflow</th>
        <th style="text-align:right">Net Balance</th>
        <th style="text-align:right">Invoices</th>
      </tr></thead>
      <tbody>${projectRows.map((p) => `
        <tr>
          <td>${p.project_name}</td>
          <td class="num green">₦${p.total_inflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
          <td class="num red">₦${p.total_outflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
          <td class="num ${p.net_balance >= 0 ? "green" : "red"}">₦${p.net_balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
          <td class="num">${p.invoice_count}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : "";

  const scopeLabel = activeProjectName ? ` &mdash; ${activeProjectName}` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Cash Bot — ${workspaceName} Financial Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: #fff; padding: 40px; font-size: 12px; }
    .header { border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 28px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .brand span { color: #10b981; }
    .meta { text-align: right; color: #555; font-size: 11px; line-height: 1.6; }
    .workspace { font-size: 15px; font-weight: 700; margin-top: 12px; }
    .report-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #10b981; margin-bottom: 4px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #10b981; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
    .kpi-value { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .kpi-value.green { color: #059669; }
    .kpi-value.red { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 8px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; color: #374151; }
    tr:last-child td { border-bottom: none; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    td.green { color: #059669; }
    td.red { color: #dc2626; }
    .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 16px; color: #9ca3af; font-size: 10px; display: flex; justify-content: space-between; }
    @media print { body { padding: 20px; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="report-title">Financial Performance Statement</div>
        <div class="brand">Cash<span>Bot</span></div>
        <div class="workspace">${workspaceName}${scopeLabel}</div>
      </div>
      <div class="meta">
        Generated: ${generatedAt}<br/>
        Period: ${periodStart} — ${periodEnd}<br/>
        Weeks reported: ${rows.length}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-grid">
      <div class="kpi"><div class="kpi-label">Money In</div>
        <div class="kpi-value green">₦${totals.inflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div></div>
      <div class="kpi"><div class="kpi-label">Money Out</div>
        <div class="kpi-value red">₦${totals.outflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div></div>
      <div class="kpi"><div class="kpi-label">Take-Home Profit</div>
        <div class="kpi-value ${totals.net >= 0 ? "green" : "red"}">₦${totals.net.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div></div>
      <div class="kpi"><div class="kpi-label">Profit Margin</div>
        <div class="kpi-value ${parseFloat(totals.margin) >= 0 ? "green" : "red"}">${totals.margin}%</div></div>
    </div>
  </div>

  ${projSection}

  <div class="section">
    <div class="section-title">Capital Deployment by Category</div>
    <table>
      <thead><tr>
        <th>Category</th><th style="text-align:right">Amount (NGN)</th><th style="text-align:right">% of Outflows</th>
      </tr></thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Weekly Breakdown</div>
    <table>
      <thead><tr>
        <th>Week Starting</th><th style="text-align:right">Inflow</th><th style="text-align:right">Outflow</th><th style="text-align:right">Net Balance</th>
      </tr></thead>
      <tbody>${weekRows}</tbody>
    </table>
  </div>

  <div class="footer">
    <span>Cash Bot — Automated Financial Intelligence for Nigerian Entrepreneurs</span>
    <span>Confidential — Not for Distribution</span>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${workspaceName.replace(/\s+/g, "_")}${activeProjectName ? `_${activeProjectName.replace(/\s+/g, "_")}` : ""}_Performance_Report.html`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

// ── Category metadata ─────────────────────────────────────────────────────────

const TAG_META: Record<string, { label: string; color: string }> = {
  cogs:               { label: "Cost of Goods Sold (COGS)", color: "bg-amber-900/50 text-amber-400" },
  opex:               { label: "Operating Expenses (OPEX)", color: "bg-blue-900/50 text-blue-400" },
  personal_essential: { label: "Personal Essential",        color: "bg-violet-900/50 text-violet-400" },
  personal_luxury:    { label: "Personal Luxury",           color: "bg-pink-900/50 text-pink-400" },
  revenue:            { label: "Revenue (Inflows)",         color: "bg-emerald-900/50 text-emerald-400" },
};

// ── Tax liability card ────────────────────────────────────────────────────────

function currentQuarterLabel(): string {
  const now = new Date();
  return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
}

function TaxLiabilityCard({
  tax,
  loading,
  onAction,
  actionLabel,
}: {
  tax: TaxSummary | null;
  loading: boolean;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <div className="h-44 animate-pulse rounded-2xl bg-zinc-800" />;
  }

  // VAT not enabled — prompt to configure
  if (!tax || !tax.has_vat) {
    return (
      <div className="flex flex-col justify-between rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Estimated Tax Liability
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-400">
              VAT tracking is off
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Enable VAT in settings to see your quarterly liability estimate.
            </p>
          </div>
          <svg className="h-8 w-8 shrink-0 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          </svg>
        </div>
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  const { net_liability, output_vat, input_vat, vat_rate,
          taxable_revenue, taxable_expenses, invoice_count } = tax;
  const isOwed   = net_liability >= 0;
  const quarter  = currentQuarterLabel();

  return (
    <div className={`rounded-2xl border p-6 transition-all ${
      isOwed ? "border-amber-800/60 bg-amber-950/20" : "border-emerald-800/60 bg-emerald-950/20"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Estimated Tax Liability
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">
            {quarter} · {tax.tax_name ?? "VAT"} @ {vat_rate}%
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          isOwed ? "bg-amber-900/60 text-amber-400" : "bg-emerald-900/60 text-emerald-400"
        }`}>
          {isOwed ? "ESTIMATE DUE" : "REFUND EST."}
        </span>
      </div>

      {/* Main figure */}
      <div className="mt-4">
        <p className={`text-3xl font-bold leading-none ${isOwed ? "text-amber-400" : "text-emerald-400"}`}>
          {net_liability < 0 && <span className="font-sans">−</span>}
          <Amt value={fmt(Math.abs(net_liability))} />
        </p>
        <p className="mt-1.5 text-xs text-zinc-500">
          {isOwed
            ? `Based on ${invoice_count} invoice${invoice_count !== 1 ? "s" : ""} this quarter`
            : "Your input VAT exceeds output — refund position"}
        </p>
      </div>

      {/* Expand breakdown */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-4 flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {expanded ? "Hide" : "Show"} breakdown
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Output VAT
              <span className="ml-1 text-zinc-700">(<NairaSign />{(taxable_revenue / 1000).toFixed(0)}K gross, {vat_rate}% incl.)</span>
            </span>
            <span className="font-semibold text-amber-400">
              +<Amt value={fmt(output_vat)} />
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Input VAT
              <span className="ml-1 text-zinc-700">(expenses <NairaSign />{(taxable_expenses / 1000).toFixed(0)}K gross, {vat_rate}% incl.)</span>
            </span>
            <span className="font-semibold text-emerald-400">
              −<Amt value={fmt(input_vat)} />
            </span>
          </div>
          <div className="border-t border-zinc-700/60 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-300">Net Liability</span>
              <span className={isOwed ? "text-amber-400" : "text-emerald-400"}>
                {net_liability < 0 && <span className="font-sans">−</span>}
                <Amt value={fmt(Math.abs(net_liability))} />
              </span>
            </div>
          </div>
          <p className="pt-1 text-[10px] leading-relaxed text-zinc-600">
            This is an estimate only. Consult a tax professional for filing with FIRS.
          </p>
        </div>
      )}

      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-800" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-zinc-800" />
      <div className="h-48 rounded-2xl bg-zinc-800" />
    </div>
  );
}

// ── Project breakdown table ───────────────────────────────────────────────────

function ProjectBreakdown({
  projects,
  loading,
  selectedId,
}: {
  projects: ProjectSummaryRow[];
  loading: boolean;
  selectedId: string | null;
}) {
  const filtered = selectedId ? projects.filter((p) => p.project_id === selectedId) : projects;

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-10 text-center">
        <svg className="mb-3 h-8 w-8 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M2 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" />
        </svg>
        <p className="text-xs font-medium text-zinc-500">No projects yet</p>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          Issue an invoice with a project name to see project-level analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {[
              { label: "Project",       align: "left"  },
              { label: "Inflow",        align: "right" },
              { label: "Outflow",       align: "right" },
              { label: "Net Balance",   align: "right" },
              { label: "Invoices",      align: "right" },
              { label: "Transactions",  align: "right" },
            ].map(({ label, align }) => (
              <th
                key={label}
                className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-${align}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
          {filtered.map((p) => {
            const isUnassigned = p.project_id === null;
            const isSelected   = !isUnassigned && selectedId === p.project_id;
            return (
              <tr
                key={p.project_id ?? "__unassigned__"}
                className={`transition ${
                  isSelected
                    ? "bg-emerald-950/20"
                    : isUnassigned
                    ? "bg-zinc-800/20"
                    : "hover:bg-zinc-800/40"
                }`}
              >
                <td className="max-w-[200px] px-5 py-4 font-medium">
                  <span className={`flex items-center gap-2 ${isUnassigned ? "text-zinc-500" : "text-zinc-200"}`}>
                    {isUnassigned && (
                      <svg className="h-3.5 w-3.5 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
                      </svg>
                    )}
                    <span className="truncate">{p.project_name}</span>
                    {isSelected && (
                      <span className="shrink-0 rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        filtered
                      </span>
                    )}
                    {isUnassigned && (
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                        no project
                      </span>
                    )}
                  </span>
                </td>
                <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${isUnassigned ? "text-zinc-400" : "text-emerald-400"}`}>
                  <Amt value={fmt(p.total_inflow)} />
                </td>
                <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${isUnassigned ? "text-zinc-400" : "text-red-400"}`}>
                  {p.total_outflow > 0 ? <><span className="font-sans">−</span><Amt value={fmt(p.total_outflow)} /></> : "—"}
                </td>
                <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                  isUnassigned ? "text-zinc-400" : p.net_balance >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {p.net_balance < 0 && <span className="font-sans">−</span>}
                  <Amt value={fmt(Math.abs(p.net_balance))} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right text-zinc-400">{p.invoice_count}</td>
                <td className="whitespace-nowrap px-5 py-4 text-right text-zinc-400">{p.tx_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline project tax form helpers ───────────────────────────────────────────

const WHT_RATE_OPTIONS = [
  { value: "5",  label: "5% — Standard Contracts, Construction, Digital Infrastructures" },
  { value: "10", label: "10% — Professional Fees, Consulting, Agency Retainers" },
] as const;

function TaxToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-neutral-700"
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function TaxToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
      <TaxToggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AnalyticsDashboardProps {
  projectId: string | null;
  onProjectChange: (id: string | null, name: string | null) => void;
  onSettingsClick?: () => void;
}

export default function AnalyticsDashboard({ projectId, onProjectChange, onSettingsClick }: AnalyticsDashboardProps) {
  const { activeBusiness } = useWorkspace();

  const { projects: projectOptions, loading: projectsLoading } = useProjects();
  const { data, loading, error }                                = useAnalytics(projectId);
  const { projects, loading: projLoading }                      = useProjectAnalytics();
  const { data: taxData, loading: taxLoading }                  = useTaxSummary();

  const selectedProjectName = projectId
    ? (projectOptions.find((p) => p.id === projectId)?.name ?? null)
    : null;

  const [taxForm, setTaxForm] = useState<{
    trackVat: boolean;
    trackWht: boolean;
    whtRate: "5" | "10";
  } | null>(null);
  const [taxFormLoading, setTaxFormLoading] = useState(false);
  const [taxFormSaving,  setTaxFormSaving]  = useState(false);
  const [taxFormError,   setTaxFormError]   = useState<string | null>(null);
  const [taxFormSaveOk,  setTaxFormSaveOk]  = useState(false);
  const [exportOpen,     setExportOpen]     = useState(false);

  const totals = useMemo(() => {
    const inflow  = data.reduce((s, r) => s + r.total_inflow,  0);
    const outflow = data.reduce((s, r) => s + r.total_outflow, 0);
    const net     = inflow - outflow;
    const margin  = inflow === 0 ? "0.0" : ((net / inflow) * 100).toFixed(1);
    return { inflow, outflow, net, margin };
  }, [data]);

  const changes = useMemo(() => {
    if (data.length < 2) return { inflow: null, outflow: null, net: null };
    const [cur, prev] = [data[0], data[1]];
    return {
      inflow:  pctChange(cur.total_inflow,  prev.total_inflow),
      outflow: pctChange(cur.total_outflow, prev.total_outflow),
      net:     pctChange(cur.net_balance,   prev.net_balance),
    };
  }, [data]);

  const categories = useMemo(() => {
    const map: Record<string, number> = { cogs: 0, opex: 0, personal_essential: 0, personal_luxury: 0 };
    for (const r of data) {
      map.cogs               += r.cogs;
      map.opex               += r.opex;
      map.personal_essential += r.personal_essential;
      map.personal_luxury    += r.personal_luxury;
    }
    const totalOut = totals.outflow || 1;
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, amount]) => ({
        key,
        label:  TAG_META[key]?.label  ?? key,
        color:  TAG_META[key]?.color  ?? "bg-zinc-800 text-zinc-400",
        amount,
        pct: ((amount / totalOut) * 100).toFixed(1),
      }));
  }, [data, totals.outflow]);

  useEffect(() => {
    if (!projectId) { setTaxForm(null); return; }
    setTaxForm(null);
    setTaxFormLoading(true);
    async function loadTax() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`/api/projects/${projectId}/tax`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json() as { track_vat: boolean; track_wht: boolean; wht_rate_percent: number };
        setTaxForm({
          trackVat: d.track_vat ?? false,
          trackWht: d.track_wht ?? false,
          whtRate:  (d.wht_rate_percent ?? 5) >= 7.5 ? "10" : "5",
        });
      }
      setTaxFormLoading(false);
    }
    loadTax();
  }, [projectId]);

  async function saveTaxSettings(updated: { trackVat: boolean; trackWht: boolean; whtRate: "5" | "10" } | null) {
    if (!updated || !projectId) return;
    setTaxFormError(null);
    setTaxFormSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const res = await fetch(`/api/projects/${projectId}/tax`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        track_vat:        updated.trackVat,
        track_wht:        updated.trackWht,
        wht_rate_percent: parseFloat(updated.whtRate),
      }),
    });
    setTaxFormSaving(false);
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      setTaxFormError(json.error ?? "Sync failed.");
      return;
    }
    setTaxFormSaveOk(true);
    setTimeout(() => setTaxFormSaveOk(false), 2500);
  }

  const workspaceName = activeBusiness?.name ?? "Personal Ledger";

  const { exporting, exportBusinessStatement, exportProjectStatement } =
    useFinancialPDFExport();

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <p className="text-sm font-medium text-zinc-500">Select a business or project to view analytics.</p>
      </div>
    );
  }

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-6 py-8 text-center">
        <p className="text-sm font-semibold text-red-400">Failed to load analytics</p>
        <p className="mt-1 text-xs text-red-600">{error}</p>
      </div>
    );
  }

  if (data.length === 0 && !projectId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <svg className="mb-4 h-10 w-10 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
        <p className="text-sm font-medium text-zinc-500">No analytics data yet</p>
        <p className="mt-1 text-xs text-zinc-600">Log transactions to generate your weekly performance report.</p>
      </div>
    );
  }

  const exportCats = categories.map(({ label, amount, pct }) => ({ label, amount, pct }));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {projectId ? (
            <button
              onClick={() => onProjectChange(null, null)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to {workspaceName}
            </button>
          ) : (
            <h2 className="text-sm font-semibold text-zinc-300">
              Weekly Performance — {workspaceName}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ProjectFilter
            selectedId={projectId}
            onChange={(id) => {
              const name = id ? (projectOptions.find((p) => p.id === id)?.name ?? null) : null;
              onProjectChange(id, name);
            }}
            options={projectOptions.map((p) => ({ id: p.id, name: p.name }))}
            loading={projectsLoading}
          />

          <div className="h-4 w-px bg-zinc-700" />

          {/* ── Unified Export dropdown ───────────────────────────────────── */}
          <div className="relative">
            {exportOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
            )}
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="relative z-50 flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export ↓
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
                <button
                  onClick={() => { downloadCSV(data, projects, workspaceName, selectedProjectName ?? null); setExportOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  CSV
                </button>
                <button
                  onClick={() => { exportPDF(data, projects, workspaceName, selectedProjectName ?? null, totals, exportCats); setExportOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  PDF
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-700" />

          {/* ── Tax statement exports ─────────────────────────────────── */}
          <button
            onClick={() => exportBusinessStatement(activeBusiness.id, workspaceName)}
            disabled={exporting}
            title="Export an audit-ready A4 tax compliance statement for this business"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-600 hover:bg-emerald-950/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-600 border-t-emerald-300" />
            ) : (
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 8h10M7 12h6M7 16h4" />
              </svg>
            )}
            Business Tax Summary
          </button>

          {projectId && selectedProjectName && (
            <button
              onClick={() => exportProjectStatement(projectId, selectedProjectName)}
              disabled={exporting}
              title="Export an audit-ready A4 financial statement for this project contract"
              className="flex items-center gap-1.5 rounded-lg border border-blue-800/60 bg-blue-950/30 px-3.5 py-2 text-xs font-semibold text-blue-300 transition hover:border-blue-600 hover:bg-blue-950/50 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-blue-600 border-t-blue-300" />
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 13h6M9 17h4" />
                </svg>
              )}
              Project Statement
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <SummaryCard label="Money In"          value={fmt(totals.inflow)}  change={changes.inflow}  positive={true} />
        <SummaryCard label="Money Out"         value={fmt(totals.outflow)} change={changes.outflow !== null ? -changes.outflow : null} positive={false} />
        <SummaryCard label="Take-Home Profit"  value={fmt(totals.net)}     change={changes.net}     positive={totals.net >= 0} />
        <SummaryCard
          label="Profit Margin"
          value={`${totals.margin}%`}
          positive={parseFloat(totals.margin) >= 0}
          sub={`Across ${data.length} week${data.length !== 1 ? "s" : ""}${selectedProjectName ? ` · ${selectedProjectName}` : ""}`}
        />
      </div>

      {/* Contract Billing & Compliance — inline when project is selected */}
      {projectId && (
        <div className="rounded-2xl border border-neutral-800 bg-zinc-900">
          <div className="flex items-start justify-between border-b border-neutral-800 px-6 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Contract Billing &amp; Compliance
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Configure tax rules specifically for this project contract.
              </p>
            </div>
            {selectedProjectName && (
              <span className="ml-4 mt-0.5 shrink-0 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                {selectedProjectName}
              </span>
            )}
          </div>

          {taxFormLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-500" />
            </div>
          ) : taxForm ? (
            <div className="space-y-4 px-6 py-5">
              <div className="mx-auto max-w-4xl space-y-4">
                <TaxToggleRow
                  label="Track 7.5% VAT for this Project Invoice"
                  description="Splits output VAT from each inflow so you can remit to FIRS via TaxPro-Max."
                  checked={taxForm.trackVat}
                  onChange={(v) => {
                    const updated = { ...taxForm, trackVat: v };
                    setTaxForm(updated);
                    saveTaxSettings(updated);
                  }}
                />
                {taxForm.trackVat && (
                  <div className="rounded-xl border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-xs leading-relaxed text-blue-300">
                    <span className="font-semibold">How it works: </span>
                    Each inflow is treated as VAT-inclusive. True revenue = gross ÷ 1.075.
                    The extracted VAT appears as an output liability on your analytics dashboard.
                  </div>
                )}

                <TaxToggleRow
                  label="Track Withholding Tax (WHT)"
                  description="Client deducts WHT before paying. Track credit notes for FIRS TCC clearance."
                  checked={taxForm.trackWht}
                  onChange={(v) => {
                    const updated = { ...taxForm, trackWht: v };
                    setTaxForm(updated);
                    saveTaxSettings(updated);
                  }}
                />
                {taxForm.trackWht && (
                  <div className="space-y-2 pl-1">
                    <label className="block text-xs font-medium text-neutral-400">WHT Rate</label>
                    <div className="relative">
                      <select
                        value={taxForm.whtRate}
                        onChange={(e) => {
                          const updated = { ...taxForm, whtRate: e.target.value as "5" | "10" };
                          setTaxForm(updated);
                          saveTaxSettings(updated);
                        }}
                        className="block w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 pr-10 text-sm text-neutral-200 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        {WHT_RATE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                )}

                {taxForm.trackVat && taxForm.trackWht && (
                  <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-300">
                    <span className="font-semibold">Both VAT &amp; WHT active: </span>
                    VAT splits true revenue from the tax collected.
                    WHT is separately withheld by the client before payment.
                    Both breakdowns appear in your WhatsApp confirmation.
                  </div>
                )}

                {taxFormError && (
                  <p className="rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-xs text-red-400">
                    {taxFormError}
                  </p>
                )}
                {taxFormSaveOk && (
                  <p className="rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-xs text-emerald-400">
                    ⚡ Project Tax Profile Synced: Calculations updated.
                  </p>
                )}
                {taxFormSaving && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="h-3 w-3 animate-spin rounded-full border border-neutral-600 border-t-emerald-500" />
                    Syncing…
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Tax liability card */}
      <TaxLiabilityCard
        tax={taxData}
        loading={taxLoading}
        onAction={
          projectId && selectedProjectName
            ? () => exportProjectStatement(projectId, selectedProjectName)
            : onSettingsClick
        }
        actionLabel={
          projectId
            ? "📄 View Project Audit Statement"
            : "📊 View Business Tax Breakdown"
        }
      />

      {/* Empty state when a filter yields no data */}
      {data.length === 0 && projectId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-12 text-center">
          <p className="text-sm font-medium text-zinc-500">No transactions for this project yet.</p>
          <button onClick={() => onProjectChange(null, null)} className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition">
            ← Back to {workspaceName}
          </button>
        </div>
      ) : (
        <>
          {/* Weekly table */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  {["Week Starting", "Inflow", "Outflow", "Net Balance"].map((h) => (
                    <th key={h} className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 ${h === "Week Starting" ? "text-left" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
                {data.map((row) => (
                  <tr key={row.week_start} className="hover:bg-zinc-800/40 transition">
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-400">{fmtDate(row.week_start)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-emerald-400"><Amt value={fmt(row.total_inflow)} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-red-400"><span className="font-sans">−</span><Amt value={fmt(row.total_outflow)} /></td>
                    <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${row.net_balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.net_balance < 0 && <span className="font-sans">−</span>}<Amt value={fmt(Math.abs(row.net_balance))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Project breakdown */}
          <div>
            <h2 className="mb-4 text-sm font-semibold text-zinc-300">Project Performance</h2>
            <ProjectBreakdown projects={projects} loading={projLoading} selectedId={projectId} />
          </div>

          {/* Capital deployment */}
          {categories.length > 0 && (
            <div>
              <h2 className="mb-4 text-sm font-semibold text-zinc-300">Capital Deployment</h2>
              <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      <th className="px-5 py-3.5 text-left  text-xs font-semibold uppercase tracking-wider text-zinc-500">Category</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Deployed</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">% of Outflows</th>
                      <th className="px-5 py-3.5 text-left  text-xs font-semibold uppercase tracking-wider text-zinc-500">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
                    {categories.map((cat) => (
                      <tr key={cat.key} className="hover:bg-zinc-800/40 transition">
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.color}`}>{cat.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-zinc-200"><Amt value={fmt(cat.amount)} /></td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-zinc-300">{cat.pct}%</td>
                        <td className="px-5 py-4">
                          <div className="h-1.5 w-full min-w-[80px] max-w-[120px] rounded-full bg-zinc-800">
                            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${cat.pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
