"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { Transaction, Invoice } from "@/lib/types";

export function useTransactions(projectId: string | null) {
  const { user } = useAuth();
  const { activeBusiness } = useWorkspace();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTx(true);
    let q = supabase
      .from("transactions")
      .select("id, created_at, description, transaction_type, financial_tag, amount, project_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (activeBusiness) q = q.eq("business_id", activeBusiness.id);
    else q = q.is("business_id", null);
    if (projectId) q = q.eq("project_id", projectId);
    const { data } = await q;
    setTransactions((data as Transaction[]) ?? []);
    setLoadingTx(false);
  }, [user, activeBusiness, projectId]);

  const deleteTx = useCallback(async (tx: Transaction) => {
    await supabase.from("transactions").delete().eq("id", tx.id);
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loadingTx, fetchTransactions, deleteTx };
}

export function useInvoices(projectId: string | null) {
  const { activeBusiness } = useWorkspace();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!activeBusiness) return;
    setLoadingInv(true);
    let q = supabase
      .from("invoices")
      .select("id, business_id, invoice_number, client_name, project_id, project:projects(name), total_amount, due_date, status")
      .eq("business_id", activeBusiness.id)
      .order("due_date", { ascending: true });
    if (projectId) q = q.eq("project_id", projectId);
    const { data } = await q;
    setInvoices((data as unknown as Invoice[]) ?? []);
    setLoadingInv(false);
  }, [activeBusiness, projectId]);

  const deleteInv = useCallback(async (inv: Invoice) => {
    await supabase.from("invoices").delete().eq("id", inv.id);
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, loadingInv, fetchInvoices, deleteInv };
}
