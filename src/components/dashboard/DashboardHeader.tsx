"use client";

import { WorkspaceMenu } from "@/components/dashboard/WorkspaceMenu";
import { useWorkspace } from "@/providers/WorkspaceProvider";

interface Props {
  projectName: string | null;
  projectId: string | null;
  activeTab: string;
  showAnalytics: boolean;
  onToggleAnalytics: () => void;
  onAddTx: () => void;
  onAddInv: () => void;
  onProjectRenamed: (name: string) => void;
  onProjectDeleted: () => void;
  onWorkspaceMutated: () => void;
  onOpenMenu?: () => void;
}

export function DashboardHeader({
  projectName, projectId, activeTab, showAnalytics,
  onToggleAnalytics, onAddTx, onAddInv,
  onProjectRenamed, onProjectDeleted, onWorkspaceMutated, onOpenMenu,
}: Props) {
  const { activeBusiness } = useWorkspace();

  const title = projectName
    ? `${projectName} - ${activeBusiness?.name ?? ""}`
    : activeBusiness?.name ?? "Personal Ledger";

  return (
    <header className="hidden items-center justify-between gap-3 border-b border-zinc-800 bg-[#0f172a]/60 px-8 py-5 lg:flex">
      <div className="flex min-w-0 items-center gap-3">
        {onOpenMenu && (
          <button onClick={onOpenMenu} className="flex-shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition xl:hidden" aria-label="Open menu">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
            Active Business/Project
          </p>
          <h1 className="mt-0.5 truncate text-2xl font-bold text-white">{title}</h1>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <WorkspaceMenu
          activeProjectId={projectId}
          activeProjectName={projectName}
          onProjectRenamed={onProjectRenamed}
          onProjectDeleted={onProjectDeleted}
          onWorkspaceMutated={onWorkspaceMutated}
        />
        {activeBusiness && activeTab === "invoices" && (
          <button onClick={onAddInv} className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition">
            + Issue Invoice
          </button>
        )}
        <button
          onClick={onToggleAnalytics}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${showAnalytics ? "border-emerald-500 text-emerald-400" : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Analytics
        </button>
        <button onClick={onAddTx} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 transition">
          + Add Transaction
        </button>
      </div>
    </header>
  );
}
