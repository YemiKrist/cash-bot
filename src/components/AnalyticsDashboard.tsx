"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  useAnalytics,
  useProjectAnalytics,
  useProjects,
  useTaxSummary,
} from "@/hooks/useAnalytics";
import { Amt, NairaSign } from "@/components/Amt";
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
      <div class="kpi"><div class="kpi-label">Total Inflow</div>
        <div class="kpi-value green">₦${totals.inflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div></div>
      <div class="kpi"><div class="kpi-label">Total Outflow</div>
        <div class="kpi-value red">₦${totals.outflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div></div>
      <div class="kpi"><div class="kpi-label">Net Balance</div>
        <div class="kpi-value ${totals.net >= 0 ? "green" : "red"}">₦${totals.net.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div></div>
      <div class="kpi"><div class="kpi-label">Net Profit Margin</div>
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
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Please allow pop-ups to export the PDF report."); return; }
  win.document.write(html);
  win.document.close();
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
  onConfigure,
}: {
  tax: TaxSummary | null;
  loading: boolean;
  onConfigure?: () => void;
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
        {onConfigure && (
          <button
            onClick={onConfigure}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 py-2 text-xs font-semibold text-zinc-400 transition hover:border-emerald-600 hover:text-emerald-400"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configure VAT Settings
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
              <span className="ml-1 text-zinc-700">(invoiced <NairaSign />{(taxable_revenue / 1000).toFixed(0)}K × {vat_rate}%)</span>
            </span>
            <span className="font-semibold text-amber-400">
              +<Amt value={fmt(output_vat)} />
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Input VAT
              <span className="ml-1 text-zinc-700">(expenses <NairaSign />{(taxable_expenses / 1000).toFixed(0)}K × {vat_rate}%)</span>
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

  const workspaceName = activeBusiness?.name ?? "Personal Ledger";

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <p className="text-sm font-medium text-zinc-500">Select a business workspace to view analytics.</p>
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

          <button
            onClick={() => downloadCSV(data, projects, workspaceName, selectedProjectName ?? null)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
          <button
            onClick={() => exportPDF(data, projects, workspaceName, selectedProjectName ?? null, totals, exportCats)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <SummaryCard label="Total Inflow"      value={fmt(totals.inflow)}  change={changes.inflow}  positive={true} />
        <SummaryCard label="Total Outflow"     value={fmt(totals.outflow)} change={changes.outflow !== null ? -changes.outflow : null} positive={false} />
        <SummaryCard label="Net Balance"       value={fmt(totals.net)}     change={changes.net}     positive={totals.net >= 0} />
        <SummaryCard
          label="Net Profit Margin"
          value={`${totals.margin}%`}
          positive={parseFloat(totals.margin) >= 0}
          sub={`Across ${data.length} week${data.length !== 1 ? "s" : ""}${selectedProjectName ? ` · ${selectedProjectName}` : ""}`}
        />
      </div>

      {/* Tax liability card */}
      <TaxLiabilityCard tax={taxData} loading={taxLoading} onConfigure={onSettingsClick} />

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
