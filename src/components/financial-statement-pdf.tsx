"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Raw DB shapes ─────────────────────────────────────────────────────────────

interface RawTransaction {
  id:               number;
  created_at:       string;
  description:      string | null;
  transaction_type: "inflow" | "outflow";
  financial_tag:    string;
  amount:           number;
  project_id:       string | null;
}

interface ProjectTaxRow {
  id:               string;
  name:             string;
  track_vat:        boolean;
  track_wht:        boolean;
  wht_rate_percent: number;
}

// ── Enriched ledger row (after tax computation) ───────────────────────────────

interface LedgerRow {
  date:         string;
  description:  string;
  project_name: string;
  category:     string;
  gross:        number;
  vat_amount:   number;
  wht_amount:   number;
  net_cash:     number;
  is_inflow:    boolean;
  is_wren:      boolean; // COGS or OpEx — WREN-compliant deductible
}

// ── Tag labels (compact for table) ───────────────────────────────────────────

const TAG_LABEL: Record<string, string> = {
  revenue:            "Revenue",
  cogs:               "COGS",
  opex:               "OpEx",
  personal_essential: "Personal",
  personal_luxury:    "Luxury",
};

// ── Tax computation per transaction ──────────────────────────────────────────

const VAT_RATE = 0.075; // Finance Act 2019 — 7.5%

function enrichRow(tx: RawTransaction, proj: ProjectTaxRow | null): LedgerRow {
  const isInflow = tx.transaction_type === "inflow";
  const isWren   = !isInflow && (tx.financial_tag === "cogs" || tx.financial_tag === "opex");

  let vatAmount = 0;
  let whtAmount = 0;

  if (isInflow && proj) {
    if (proj.track_vat) vatAmount = tx.amount - tx.amount / (1 + VAT_RATE);
    if (proj.track_wht) whtAmount = tx.amount * (proj.wht_rate_percent / 100);
  }

  return {
    date:         tx.created_at.slice(0, 10),
    description:  tx.description ?? "(no description)",
    project_name: proj?.name ?? "—",
    category:     TAG_LABEL[tx.financial_tag] ?? tx.financial_tag,
    gross:        tx.amount,
    vat_amount:   vatAmount,
    wht_amount:   whtAmount,
    net_cash:     isInflow ? tx.amount - whtAmount : tx.amount,
    is_inflow:    isInflow,
    is_wren:      isWren,
  };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function ngn(n: number): string {
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── HTML document builder ─────────────────────────────────────────────────────

function buildStatementHTML(
  scope:         "business" | "project",
  workspaceName: string,
  rows:          LedgerRow[],
): string {
  const now = new Date();
  const generatedAt = now.toLocaleString("en-NG", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;

  // ── Aggregates ──────────────────────────────────────────────────────────────
  const inflows        = rows.filter((r) => r.is_inflow);
  const grossRevenue   = inflows.reduce((s, r) => s + r.gross, 0);
  const totalOpex      = rows.filter((r) => r.is_wren).reduce((s, r) => s + r.gross, 0);
  const totalVat       = rows.reduce((s, r) => s + r.vat_amount, 0);
  const totalWht       = rows.reduce((s, r) => s + r.wht_amount, 0);
  const totalNetCash   = inflows.reduce((s, r) => s + r.net_cash, 0);

  // ── Table rows ──────────────────────────────────────────────────────────────
  const TRUNC = 500;
  const truncated = rows.length > TRUNC;
  const displayRows = rows.slice(0, TRUNC);

  const tableBody = displayRows.map((r) => {
    const grossClass  = r.is_inflow  ? "emerald" : "muted";
    const grossPrefix = r.is_inflow  ? "" : "&#8722;";
    const netCell     = r.is_inflow  ? `₦${ngn(r.net_cash)}` : "&#8212;";

    return `<tr>
      <td class="date">${fmtDate(r.date)}</td>
      <td class="desc">${esc(r.description)}</td>
      <td class="proj">${esc(r.project_name)}</td>
      <td class="cat">${esc(r.category)}</td>
      <td class="r ${grossClass}">${grossPrefix}&#8358;${ngn(r.gross)}</td>
      <td class="r ${r.vat_amount > 0 ? "amber" : "muted"}">${r.vat_amount > 0 ? `&#8358;${ngn(r.vat_amount)}` : "&#8212;"}</td>
      <td class="r ${r.wht_amount > 0 ? "violet" : "muted"}">${r.wht_amount > 0 ? `&#8358;${ngn(r.wht_amount)}` : "&#8212;"}</td>
      <td class="r">${netCell}</td>
    </tr>`;
  }).join("\n");

  const truncNote = truncated
    ? `<tr><td colspan="8" class="trunc-note">
        Showing the 500 most recent transactions. Export CSV from the dashboard for the complete ledger.
       </td></tr>`
    : "";

  const docTypeLabel = scope === "business"
    ? "Business Tax Summary"
    : "Project Contract Statement";

  const scopeDescription = scope === "business"
    ? "Aggregates all inflow receipts and deductible expenditures across all active client contracts and overhead cost centres under this business entity."
    : "Isolates all inflow receipts and expenditures recorded against this specific client contract for audit and compliance reporting.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(workspaceName)} — ${docTypeLabel}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Document header ─────────────────────────────────────────────── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2.5pt solid #0f172a;
      padding-bottom: 10pt;
      margin-bottom: 16pt;
    }
    .brand {
      font-size: 17pt;
      font-weight: 900;
      letter-spacing: -0.5pt;
      color: #0f172a;
    }
    .brand em { color: #10b981; font-style: normal; }
    .header-right { text-align: right; }
    .doc-type-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.8pt;
      color: #10b981;
    }
    .doc-date {
      font-size: 8pt;
      color: #64748b;
      margin-top: 2pt;
    }

    /* ── Title block ─────────────────────────────────────────────────── */
    .title-block {
      margin-bottom: 16pt;
    }
    .workspace-name {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4pt;
      line-height: 1.2;
    }
    .statement-scope {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 4pt;
      line-height: 1.5;
      max-width: 80%;
    }
    .statement-pills {
      display: flex;
      gap: 8pt;
      margin-top: 8pt;
    }
    .pill {
      display: inline-block;
      border: 0.75pt solid #e2e8f0;
      border-radius: 100pt;
      padding: 2pt 8pt;
      font-size: 7pt;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.8pt;
    }
    .pill.green { border-color: #bbf7d0; color: #059669; background: #f0fdf4; }

    /* ── Section heading ─────────────────────────────────────────────── */
    .section-heading {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5pt;
      color: #64748b;
      border-bottom: 0.75pt solid #e2e8f0;
      padding-bottom: 5pt;
      margin-top: 18pt;
      margin-bottom: 10pt;
    }

    /* ── KPI summary grid ────────────────────────────────────────────── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 9pt;
    }
    .kpi {
      border: 0.75pt solid #e2e8f0;
      border-radius: 5pt;
      padding: 10pt 11pt 9pt;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1pt;
      color: #94a3b8;
      margin-bottom: 5pt;
    }
    .kpi-value {
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: -0.3pt;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
      line-height: 1.2;
    }
    .kpi-value.emerald { color: #059669; }
    .kpi-value.slate   { color: #475569; }
    .kpi-value.amber   { color: #b45309; }
    .kpi-value.violet  { color: #6d28d9; }
    .kpi-sub {
      font-size: 6.5pt;
      color: #94a3b8;
      margin-top: 3.5pt;
      line-height: 1.4;
    }

    /* ── Ledger table ────────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tbody tr { page-break-inside: avoid; }

    thead th {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.9pt;
      color: #64748b;
      background: #f8fafc;
      border-top: 1.5pt solid #0f172a;
      border-bottom: 0.75pt solid #cbd5e1;
      padding: 6pt 6pt;
      text-align: left;
      white-space: nowrap;
    }
    thead th.r { text-align: right; }

    tbody td {
      font-size: 8.5pt;
      color: #334155;
      padding: 5pt 6pt;
      border-bottom: 0.5pt solid #f1f5f9;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody td.r    { text-align: right; font-variant-numeric: tabular-nums; }
    tbody td.date { white-space: nowrap; font-size: 8pt; }
    tbody td.desc { font-size: 8pt; color: #0f172a; }
    tbody td.proj { font-size: 7.5pt; color: #475569; }
    tbody td.cat  {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6pt;
      color: #64748b;
    }
    .emerald { color: #059669; font-weight: 700; }
    .amber   { color: #b45309; font-weight: 600; }
    .violet  { color: #6d28d9; font-weight: 600; }
    .muted   { color: #94a3b8; }

    /* Total row */
    tfoot td {
      border-top: 1.5pt solid #0f172a;
      border-bottom: none;
      font-weight: 800;
      font-size: 8.5pt;
      padding: 6pt 6pt;
    }
    tfoot td.r { text-align: right; font-variant-numeric: tabular-nums; }

    /* Truncation notice */
    .trunc-note {
      font-size: 7.5pt;
      color: #94a3b8;
      font-style: italic;
      text-align: center;
      padding: 8pt 0 !important;
      border-top: 0.5pt solid #e2e8f0 !important;
      border-bottom: none !important;
    }

    /* ── Compliance note ─────────────────────────────────────────────── */
    .compliance-note {
      margin-top: 14pt;
      border: 0.75pt solid #e2e8f0;
      border-left: 2.5pt solid #10b981;
      border-radius: 3pt;
      padding: 8pt 10pt;
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.6;
      background: #f8fafc;
    }
    .compliance-note strong { color: #0f172a; }

    /* ── Footer ──────────────────────────────────────────────────────── */
    .doc-footer {
      margin-top: 20pt;
      border-top: 0.5pt solid #e2e8f0;
      padding-top: 8pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      color: #94a3b8;
    }
    .doc-footer .brand-sm {
      font-weight: 800;
      color: #10b981;
      font-size: 8pt;
    }
    .doc-footer .brand-sm span { color: #0f172a; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Document header -->
  <header class="doc-header">
    <div class="brand">Cash<em>Bot</em></div>
    <div class="header-right">
      <div class="doc-type-label">${docTypeLabel}</div>
      <div class="doc-date">Generated: ${generatedAt}</div>
    </div>
  </header>

  <!-- Title block -->
  <div class="title-block">
    <div class="workspace-name">${esc(workspaceName)}</div>
    <div class="statement-scope">${scopeDescription}</div>
    <div class="statement-pills">
      <span class="pill green">Currency: NGN (&#8358;)</span>
      <span class="pill">${quarter}</span>
      <span class="pill">${rows.length.toLocaleString()} transaction${rows.length !== 1 ? "s" : ""}</span>
    </div>
  </div>

  <!-- Core financial summary -->
  <div class="section-heading">Core Financial Summary</div>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Gross Revenue</div>
      <div class="kpi-value emerald">&#8358;${ngn(grossRevenue)}</div>
      <div class="kpi-sub">Total inflow receipts (VAT-inclusive)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Deductible OpEx</div>
      <div class="kpi-value slate">&#8358;${ngn(totalOpex)}</div>
      <div class="kpi-sub">WREN-compliant COGS &amp; operating costs</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">VAT Liabilities Collected</div>
      <div class="kpi-value amber">&#8358;${ngn(totalVat)}</div>
      <div class="kpi-sub">Output VAT to remit via FIRS TaxPro-Max</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">WHT Credit Notes</div>
      <div class="kpi-value violet">&#8358;${ngn(totalWht)}</div>
      <div class="kpi-sub">Anticipated TCC offset at FIRS clearance</div>
    </div>
  </div>

  <!-- Transaction ledger -->
  <div class="section-heading">Transaction Ledger</div>
  <table>
    <thead>
      <tr>
        <th style="width:9%">Date</th>
        <th style="width:22%">Description</th>
        <th style="width:12%">Project</th>
        <th style="width:7%">Category</th>
        <th class="r" style="width:13%">Gross Amount</th>
        <th class="r" style="width:12%">VAT Collected</th>
        <th class="r" style="width:12%">WHT Deducted</th>
        <th class="r" style="width:13%">Net Cash-at-Hand</th>
      </tr>
    </thead>
    <tbody>
      ${tableBody}
      ${truncNote}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">Totals (inflows)</td>
        <td class="r emerald">&#8358;${ngn(grossRevenue)}</td>
        <td class="r amber">&#8358;${ngn(totalVat)}</td>
        <td class="r violet">&#8358;${ngn(totalWht)}</td>
        <td class="r">&#8358;${ngn(totalNetCash)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Compliance note -->
  <div class="compliance-note">
    <strong>Compliance note &mdash;</strong>
    VAT figures are computed at the Nigerian statutory rate of <strong>7.5%</strong> (Finance Act 2019) extracted from VAT-inclusive inflow amounts.
    WHT deductions are recorded as advance tax credits against annual FIRS clearance under CITA s.81.
    This statement is generated by <strong>Cash Bot</strong> and is intended for internal financial management and preparatory audit use.
    It does not replace a certified audit report or official FIRS filing.
  </div>

  <!-- Footer -->
  <footer class="doc-footer">
    <div>
      <span class="brand-sm">Cash<span>Bot</span></span>
      &nbsp;&mdash;&nbsp;Automated Financial Intelligence for Nigerian Entrepreneurs
    </div>
    <div>CONFIDENTIAL &middot; NOT FOR DISTRIBUTION</div>
  </footer>

</body>
</html>`;
}

// ── Silent Blob anchor download — zero pop-up risk ───────────────────────────

function downloadAsBlob(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

// ── Public hook ───────────────────────────────────────────────────────────────

interface UseFinancialPDFExportResult {
  exporting:               boolean;
  exportBusinessStatement: (businessId: string, businessName: string) => Promise<void>;
  exportProjectStatement:  (projectId: string,  projectName: string)  => Promise<void>;
}

export function useFinancialPDFExport(): UseFinancialPDFExportResult {
  const [exporting, setExporting] = useState(false);

  async function exportBusinessStatement(
    businessId:   string,
    businessName: string,
  ): Promise<void> {
    setExporting(true);
    try {
      const [txRes, projRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, created_at, description, transaction_type, financial_tag, amount, project_id")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("projects")
          .select("id, name, track_vat, track_wht, wht_rate_percent")
          .eq("business_id", businessId),
      ]);

      const txns  = (txRes.data  ?? []) as RawTransaction[];
      const projs = (projRes.data ?? []) as ProjectTaxRow[];
      const projMap = new Map(projs.map((p) => [p.id, p]));

      const rows = txns.map((tx) =>
        enrichRow(tx, tx.project_id ? (projMap.get(tx.project_id) ?? null) : null)
      );

      downloadAsBlob(
        buildStatementHTML("business", businessName, rows),
        `${businessName.replace(/\s+/g, "_")}_Business_Tax_Summary.html`,
      );
    } finally {
      setExporting(false);
    }
  }

  async function exportProjectStatement(
    projectId:   string,
    projectName: string,
  ): Promise<void> {
    setExporting(true);
    try {
      const [txRes, projRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, created_at, description, transaction_type, financial_tag, amount, project_id")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("projects")
          .select("id, name, track_vat, track_wht, wht_rate_percent")
          .eq("id", projectId)
          .maybeSingle(),
      ]);

      const txns = (txRes.data ?? []) as RawTransaction[];
      const proj = projRes.data as ProjectTaxRow | null;

      const rows = txns.map((tx) => enrichRow(tx, proj));

      downloadAsBlob(
        buildStatementHTML("project", projectName, rows),
        `${projectName.replace(/\s+/g, "_")}_FIRS_Audit_Statement.html`,
      );
    } finally {
      setExporting(false);
    }
  }

  return { exporting, exportBusinessStatement, exportProjectStatement };
}
