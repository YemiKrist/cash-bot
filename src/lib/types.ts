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

export interface TaxSummary {
  has_vat:          boolean;
  tax_name?:        string;
  vat_rate:         number;
  output_vat:       number;
  input_vat:        number;
  net_liability:    number;
  taxable_revenue:  number;
  taxable_expenses: number;
  invoice_count:    number;
}

export interface BusinessInvoiceSettings {
  business_id:    string;
  has_vat:        boolean;
  tax_name:       string;
  tax_percentage: number;
  updated_at:     string | null;
}

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
