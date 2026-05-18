export interface Project {
  id: string;
  business_id: string;
  name: string;
  created_at: string;
}

export interface ProjectSummaryRow {
  project_id: string | null;   // null for the "Unassigned" bucket row
  project_name: string;
  total_inflow: number;
  total_outflow: number;
  net_balance: number;
  invoice_count: number;
  tx_count: number;
}

export interface WeeklySummaryRow {
  week_start: string;
  total_inflow: number;
  total_outflow: number;
  net_balance: number;
  revenue: number;
  cogs: number;
  opex: number;
  personal_essential: number;
  personal_luxury: number;
}

export interface Transaction {
  id: number;
  created_at: string;
  description: string | null;
  transaction_type: "inflow" | "outflow";
  financial_tag: string;
  amount: number;
  project_id: string | null;
}

export type InvoiceStatus = "unpaid" | "partially_paid" | "paid";

export interface Invoice {
  id: string;
  business_id: string;
  invoice_number: string;
  client_name: string;
  project_id: string | null;
  project: { name: string } | null;
  total_amount: number;
  due_date: string | null;
  status: InvoiceStatus;
}
