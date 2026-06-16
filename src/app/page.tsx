"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BusinessSettings from "@/components/BusinessSettings";
import ReminderSettings from "@/components/ReminderSettings";
import TransactionModal from "@/components/TransactionModal";
import InvoiceModal from "@/components/InvoiceModal";
import InvoiceList from "@/components/InvoiceList";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import AnalyticsSummary from "@/components/AnalyticsSummary";
import { KPIMatrix } from "@/components/dashboard/KPIMatrix";
import { LedgerTable } from "@/components/dashboard/LedgerTable";
import { TxFilters } from "@/components/dashboard/TxFilters";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { MobileSummaryBar } from "@/components/dashboard/MobileSummaryBar";
import { MobileNavBar } from "@/components/dashboard/MobileNavBar";
import { TransactionCard } from "@/components/dashboard/TransactionCard";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useTransactions, useInvoices } from "@/hooks/useTransactions";
import { useDateFilter } from "@/hooks/useDateFilter";
import type { Transaction, Invoice } from "@/lib/types";

type Tab = "transactions" | "invoices" | "analytics";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeBusiness } = useWorkspace();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("transactions");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);

  const { transactions, loadingTx, fetchTransactions, deleteTx } = useTransactions(projectId);
  const { invoices, loadingInv, fetchInvoices, deleteInv } = useInvoices(projectId);
  const filter = useDateFilter(transactions);

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { if (activeBusiness) fetchInvoices(); }, [activeBusiness, fetchInvoices]);
  useEffect(() => { setTab("transactions"); setProjectId(null); setProjectName(null); filter.reset(); }, [activeBusiness]);

  const onProjectClick = useCallback((id: string, name: string) => {
    setProjectId(id); setProjectName(name); setTab("analytics");
  }, []);

  function clearProject() { setProjectId(null); setProjectName(null); }

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020617]">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  const showAnalytics = tab === "analytics";

  return (
    <div className="flex h-screen bg-[#020617]">
      <Sidebar
        open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onProjectClick={onProjectClick}
        onSettingsClick={() => setShowSettings(true)}
        onReminderSettingsClick={() => setShowReminders(true)}
        projectsRefreshKey={projectsRefreshKey}
        activeProjectId={projectId}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader
          projectName={projectName} projectId={projectId}
          onOpenSidebar={() => setSidebarOpen(true)} onClearProject={clearProject}
          onProjectRenamed={setProjectName} onProjectDeleted={clearProject}
          onWorkspaceMutated={() => setProjectsRefreshKey((k) => k + 1)}
        />
        <DashboardHeader
          projectName={projectName} projectId={projectId}
          activeTab={tab} showAnalytics={showAnalytics}
          onToggleAnalytics={() => setTab(showAnalytics ? "transactions" : "analytics")}
          onAddTx={() => setShowTxModal(true)}
          onAddInv={() => setShowInvModal(true)}
          onProjectRenamed={setProjectName} onProjectDeleted={clearProject}
          onWorkspaceMutated={() => setProjectsRefreshKey((k) => k + 1)}
          onOpenMenu={() => setSidebarOpen(true)}
        />

        {tab !== "analytics" && (
          <>
            <div className="lg:hidden"><MobileSummaryBar transactions={transactions} /></div>
            <div className="hidden px-8 py-4 lg:block">
              <KPIMatrix transactions={transactions} isBusiness={!!activeBusiness} />
            </div>
          </>
        )}

        {activeBusiness && (
          <div className="hidden overflow-x-auto border-b border-zinc-800 px-8 lg:flex">
            {(["transactions", "invoices"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`relative mr-6 shrink-0 whitespace-nowrap pb-3 pt-3 text-sm font-medium capitalize transition ${tab === t ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                {t === "transactions" ? "Transactions" : "Invoices & A/R"}
                {tab === t && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 lg:px-8 lg:py-6 lg:pb-6">
          {showAnalytics ? (
            activeBusiness
              ? <AnalyticsDashboard projectId={projectId} onProjectChange={(id, name) => { setProjectId(id); setProjectName(name); }} onSettingsClick={() => setShowSettings(true)} />
              : <AnalyticsSummary transactions={transactions} />
          ) : tab === "invoices" && activeBusiness ? (
            <InvoiceList invoices={invoices} loading={loadingInv} onEdit={setEditingInv} onDelete={deleteInv} />
          ) : (
            <>
              {!loadingTx && <TxFilters searchQuery={filter.searchQuery} onSearch={filter.setSearchQuery} activePreset={filter.activePreset} customStart={filter.customStart} customEnd={filter.customEnd} onPreset={filter.applyPreset} onCustomToggle={() => filter.setActivePreset("custom")} onCustomStart={(v) => { filter.setCustomStart(v); if (v) filter.setStartDate(new Date(v + "T00:00:00")); }} onCustomEnd={(v) => { filter.setCustomEnd(v); if (v) filter.setEndDate(new Date(v + "T23:59:59")); }} />}
              <div className="space-y-2 lg:hidden">
                {loadingTx ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-zinc-800" />) : filter.filteredTransactions.map((tx) => <TransactionCard key={tx.id} tx={tx} onEdit={setEditingTx} onDelete={deleteTx} />)}
              </div>
              <div className="hidden lg:block">
                <LedgerTable transactions={filter.filteredTransactions} loading={loadingTx} onEdit={setEditingTx} onDelete={deleteTx} />
              </div>
            </>
          )}
        </div>

        <MobileNavBar activeTab={tab} hasBusiness={!!activeBusiness} onTab={setTab} onAdd={() => (tab === "invoices" && activeBusiness) ? setShowInvModal(true) : setShowTxModal(true)} onOpenSidebar={() => setSidebarOpen(true)} />
      </main>

      {(showTxModal || editingTx) && <TransactionModal onClose={() => { setShowTxModal(false); setEditingTx(null); }} onSaved={fetchTransactions} initialData={editingTx ?? undefined} defaultProjectId={projectId ?? undefined} />}
      {(showInvModal || editingInv) && <InvoiceModal onClose={() => { setShowInvModal(false); setEditingInv(null); }} onSaved={fetchInvoices} initialData={editingInv ?? undefined} />}
      {showSettings && <BusinessSettings onClose={() => setShowSettings(false)} />}
      {showReminders && <ReminderSettings onClose={() => setShowReminders(false)} />}
    </div>
  );
}
