"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { WeeklySummaryRow } from "@/lib/types";

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

// ── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  change?: number | null;
  positive?: boolean;
  sub?: string;
}

function SummaryCard({ label, value, change, positive, sub }: SummaryCardProps) {
  const valueColor =
    positive === true
      ? "text-emerald-400"
      : positive === false
      ? "text-red-400"
      : "text-white";

  const glow =
    positive === true
      ? "shadow-[0_0_18px_-4px_rgba(52,211,153,0.25)]"
      : positive === false
      ? "shadow-[0_0_18px_-4px_rgba(248,113,113,0.2)]"
      : "";

  const changeColor =
    change === null || change === undefined
      ? "text-zinc-600"
      : change >= 0
      ? "text-emerald-500"
      : "text-red-500";

  const changePrefix = change !== null && change !== undefined && change > 0 ? "+" : "";

  return (
    <div
      className={`flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6 ${glow}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-3 font-mono text-2xl font-bold leading-none ${valueColor}`}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {change !== null && change !== undefined ? (
          <span className={`text-xs font-semibold ${changeColor}`}>
            {changePrefix}
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

function downloadCSV(rows: WeeklySummaryRow[], workspaceName: string) {
  const header = ["Week Start", "Inflow (NGN)", "Outflow (NGN)", "Net Balance (NGN)"];
  const lines = rows.map((r) =>
    [
      r.week_start,
      r.total_inflow.toFixed(2),
      r.total_outflow.toFixed(2),
      r.net_balance.toFixed(2),
    ].join(",")
  );

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `cashbot_${workspaceName.replace(/\s+/g, "_")}_weekly_summary.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF / Print export ────────────────────────────────────────────────────────

function exportPDF(
  rows: WeeklySummaryRow[],
  workspaceName: string,
  totals: { inflow: number; outflow: number; net: number; margin: string },
  categories: { label: string; amount: number; pct: string }[],
) {
  const generatedAt = new Date().toLocaleString("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const periodStart = rows.length ? fmtDate(rows[rows.length - 1].week_start) : "—";
  const periodEnd = rows.length ? fmtDate(rows[0].week_start) : "—";

  const weekRows = rows
    .map(
      (r) => `
      <tr>
        <td>${fmtDate(r.week_start)}</td>
        <td class="num green">₦${r.total_inflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
        <td class="num red">₦${r.total_outflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
        <td class="num ${r.net_balance >= 0 ? "green" : "red"}">₦${r.net_balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
      </tr>`
    )
    .join("");

  const catRows = categories
    .map(
      (c) => `
      <tr>
        <td>${c.label}</td>
        <td class="num">₦${c.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
        <td class="num">${c.pct}%</td>
      </tr>`
    )
    .join("");

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
    .brand { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #111; }
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
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="report-title">Financial Performance Statement</div>
        <div class="brand">Cash<span>Bot</span></div>
        <div class="workspace">${workspaceName}</div>
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
      <div class="kpi">
        <div class="kpi-label">Total Inflow</div>
        <div class="kpi-value green">₦${totals.inflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total Outflow</div>
        <div class="kpi-value red">₦${totals.outflow.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Net Balance</div>
        <div class="kpi-value ${totals.net >= 0 ? "green" : "red"}">₦${totals.net.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Net Profit Margin</div>
        <div class="kpi-value ${parseFloat(totals.margin) >= 0 ? "green" : "red"}">${totals.margin}%</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Capital Deployment by Category</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right">Amount (NGN)</th>
          <th style="text-align:right">% of Outflows</th>
        </tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Weekly Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Week Starting</th>
          <th style="text-align:right">Inflow</th>
          <th style="text-align:right">Outflow</th>
          <th style="text-align:right">Net Balance</th>
        </tr>
      </thead>
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
  if (!win) {
    alert("Please allow pop-ups to export the PDF report.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── Category helpers ──────────────────────────────────────────────────────────

const TAG_META: Record<string, { label: string; color: string }> = {
  cogs: { label: "Cost of Goods Sold (COGS)", color: "bg-amber-900/50 text-amber-400" },
  opex: { label: "Operating Expenses (OPEX)", color: "bg-blue-900/50 text-blue-400" },
  personal_essential: { label: "Personal Essential", color: "bg-violet-900/50 text-violet-400" },
  personal_luxury: { label: "Personal Luxury", color: "bg-pink-900/50 text-pink-400" },
  revenue: { label: "Revenue (Inflows)", color: "bg-emerald-900/50 text-emerald-400" },
};

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

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const { activeBusiness } = useWorkspace();
  const { data, loading, error } = useAnalytics();

  // Aggregate totals across all weeks
  const totals = useMemo(() => {
    const inflow = data.reduce((s, r) => s + r.total_inflow, 0);
    const outflow = data.reduce((s, r) => s + r.total_outflow, 0);
    const net = inflow - outflow;
    const margin = inflow === 0 ? "0.0" : ((net / inflow) * 100).toFixed(1);
    return { inflow, outflow, net, margin };
  }, [data]);

  // % change vs prior week (data is sorted DESC from RPC)
  const changes = useMemo(() => {
    if (data.length < 2) return { inflow: null, outflow: null, net: null };
    const [cur, prev] = [data[0], data[1]];
    return {
      inflow: pctChange(cur.total_inflow, prev.total_inflow),
      outflow: pctChange(cur.total_outflow, prev.total_outflow),
      net: pctChange(cur.net_balance, prev.net_balance),
    };
  }, [data]);

  // Category breakdown across all weeks, sorted by amount DESC
  const categories = useMemo(() => {
    const map: Record<string, number> = {
      cogs: 0,
      opex: 0,
      personal_essential: 0,
      personal_luxury: 0,
    };
    for (const r of data) {
      map.cogs += r.cogs;
      map.opex += r.opex;
      map.personal_essential += r.personal_essential;
      map.personal_luxury += r.personal_luxury;
    }
    const totalOut = totals.outflow || 1;
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, amount]) => ({
        key,
        label: TAG_META[key]?.label ?? key,
        color: TAG_META[key]?.color ?? "bg-zinc-800 text-zinc-400",
        amount,
        pct: ((amount / totalOut) * 100).toFixed(1),
      }));
  }, [data, totals.outflow]);

  // Data for export helpers
  const exportCategories = categories.map((c) => ({
    label: c.label,
    amount: c.amount,
    pct: c.pct,
  }));

  const workspaceName = activeBusiness?.name ?? "Personal Ledger";

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <p className="text-sm font-medium text-zinc-500">
          Select a business workspace to view analytics.
        </p>
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

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
        <svg className="mb-4 h-10 w-10 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M3 3v18h18" />
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
        <p className="text-sm font-medium text-zinc-500">No analytics data yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Log transactions to generate your weekly performance report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryCard
          label="Total Inflow"
          value={fmt(totals.inflow)}
          change={changes.inflow}
          positive={true}
        />
        <SummaryCard
          label="Total Outflow"
          value={fmt(totals.outflow)}
          change={changes.outflow !== null ? -changes.outflow : null}
          positive={false}
        />
        <SummaryCard
          label="Net Balance"
          value={fmt(totals.net)}
          change={changes.net}
          positive={totals.net >= 0}
        />
        <SummaryCard
          label="Net Profit Margin"
          value={`${totals.margin}%`}
          positive={parseFloat(totals.margin) >= 0}
          sub={`Across ${data.length} week${data.length !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Export controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">
          Weekly Performance — {workspaceName}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCSV(data, workspaceName)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download CSV
          </button>
          <button
            onClick={() =>
              exportPDF(data, workspaceName, totals, exportCategories)
            }
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Weekly breakdown table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {["Week Starting", "Inflow", "Outflow", "Net Balance"].map((h) => (
                <th
                  key={h}
                  className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 ${
                    h === "Week Starting" ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
            {data.map((row) => (
              <tr key={row.week_start} className="hover:bg-zinc-800/40 transition">
                <td className="whitespace-nowrap px-5 py-4 text-zinc-400">
                  {fmtDate(row.week_start)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-mono font-semibold text-emerald-400">
                  {fmt(row.total_inflow)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-mono font-semibold text-red-400">
                  −{fmt(row.total_outflow)}
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-4 text-right font-mono font-semibold ${
                    row.net_balance >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {row.net_balance < 0 && "−"}
                  {fmt(Math.abs(row.net_balance))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Capital deployment breakdown */}
      {categories.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            Capital Deployment
          </h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Category
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Total Deployed
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    % of Outflows
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
                {categories.map((cat) => (
                  <tr key={cat.key} className="hover:bg-zinc-800/40 transition">
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.color}`}
                      >
                        {cat.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-mono font-semibold text-zinc-200">
                      {fmt(cat.amount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-zinc-300">
                      {cat.pct}%
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-1.5 w-full min-w-[80px] max-w-[120px] rounded-full bg-zinc-800">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${cat.pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
