"use client";

import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useSidebarState } from "@/hooks/useSidebarState";
import { EntityList } from "@/components/sidebar/EntityList";

interface Props {
  open: boolean;
  onClose: () => void;
  onProjectClick?: (id: string, name: string) => void;
  onSettingsClick?: () => void;
  onReminderSettingsClick?: () => void;
  projectsRefreshKey?: number;
  activeProjectId?: string | null;
}

export default function Sidebar({ open, onClose, onProjectClick, onSettingsClick, onReminderSettingsClick, projectsRefreshKey, activeProjectId }: Props) {
  const { activeBusiness } = useWorkspace();
  const state = useSidebarState(projectsRefreshKey);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-shrink-0 flex-col border-r border-zinc-800/60 bg-[#0f172a] px-3 py-5 transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>

        <div className="mb-6 flex items-center justify-between px-2">
          <span className="text-lg font-bold tracking-tight text-white">
            Sabi<span className="text-emerald-400">CFO</span>
          </span>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-white transition lg:hidden" aria-label="Close menu">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <EntityList
          projects={state.projects}
          activeProjectId={activeProjectId ?? null}
          onProjectClick={(id, name) => { onProjectClick?.(id, name); onClose(); }}
          onClose={onClose}
          addingBiz={state.addingBiz} setAddingBiz={state.setAddingBiz}
          newBizName={state.newBizName} setNewBizName={state.setNewBizName}
          savingBiz={state.savingBiz} bizError={state.bizError} setBizError={state.setBizError}
          onCreateBiz={(name) => state.handleCreateBiz(name)}
          addingProject={state.addingProject} setAddingProject={state.setAddingProject}
          newProjectName={state.newProjectName} setNewProjectName={state.setNewProjectName}
          savingProject={state.savingProject} projectError={state.projectError} setProjectError={state.setProjectError}
          onCreateProject={(name) => state.handleCreateProject(name)}
        />

        <div className="mt-3 border-t border-zinc-800/60 pt-3 space-y-0.5">
          {activeBusiness && onSettingsClick && (
            <button onClick={() => { onSettingsClick(); onClose(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300 transition">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Business Settings
            </button>
          )}
          {onReminderSettingsClick && (
            <button onClick={() => { onReminderSettingsClick(); onClose(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300 transition">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Reminder Settings
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/40 hover:text-red-400 transition">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
