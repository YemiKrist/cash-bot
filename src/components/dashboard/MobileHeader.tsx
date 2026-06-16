"use client";

import { useState } from "react";
import { WorkspaceMenu } from "@/components/dashboard/WorkspaceMenu";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { bizColor, bizInitials } from "@/lib/tagConfig";

interface Props {
  projectName: string | null;
  projectId: string | null;
  onOpenSidebar: () => void;
  onClearProject: () => void;
  onProjectRenamed: (name: string) => void;
  onProjectDeleted: () => void;
  onWorkspaceMutated: () => void;
}

export function MobileHeader({ projectName, projectId, onOpenSidebar, onClearProject, onProjectRenamed, onProjectDeleted, onWorkspaceMutated }: Props) {
  const { activeBusiness, businesses, setActiveBusiness } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-[#0f172a]/80 px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2">
        <button onClick={onOpenSidebar} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 transition" aria-label="Open menu">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {projectId && activeBusiness ? (
          <button type="button" onClick={onClearProject} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            <span className="max-w-[120px] truncate">{activeBusiness.name}</span>
          </button>
        ) : (
          <span className="text-base font-bold tracking-tight text-white">
            Sabi<span className="text-emerald-400">CFO</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative">
          <button onClick={() => setDropdownOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="max-w-[120px] truncate">{projectName ?? activeBusiness?.name ?? "Personal"}</span>
            <svg className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
              <div className="p-1.5">
                <button onClick={() => { setActiveBusiness(null); setDropdownOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${!activeBusiness ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800"}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-bold text-white">PL</span>
                  Personal Ledger
                </button>
                {businesses.map((b) => (
                  <button key={b.id} onClick={() => { setActiveBusiness(b); setDropdownOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${activeBusiness?.id === b.id ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${bizColor(b.name)}`}>{bizInitials(b.name)}</span>
                    <span className="flex-1 truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <WorkspaceMenu activeProjectId={projectId} activeProjectName={projectName} onProjectRenamed={onProjectRenamed} onProjectDeleted={onProjectDeleted} onWorkspaceMutated={onWorkspaceMutated} />
      </div>
    </header>
  );
}
