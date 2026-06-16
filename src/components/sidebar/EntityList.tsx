"use client";

import { bizColor, bizInitials } from "@/lib/tagConfig";
import { useWorkspace, type Business } from "@/providers/WorkspaceProvider";

interface Project { id: string; name: string }

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onProjectClick: (id: string, name: string) => void;
  onClose: () => void;
  addingBiz: boolean; setAddingBiz: (v: boolean) => void;
  newBizName: string; setNewBizName: (v: string) => void;
  savingBiz: boolean; bizError: string | null; setBizError: (v: string | null) => void;
  onCreateBiz: (name: string) => void;
  addingProject: boolean; setAddingProject: (v: boolean) => void;
  newProjectName: string; setNewProjectName: (v: string) => void;
  savingProject: boolean; projectError: string | null; setProjectError: (v: string | null) => void;
  onCreateProject: (name: string) => void;
}

const inputCls = "w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition";
const saveBtnCls = "flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 transition";
const cancelBtnCls = "flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition";

export function EntityList({ projects, activeProjectId, onProjectClick, onClose, addingBiz, setAddingBiz, newBizName, setNewBizName, savingBiz, bizError, setBizError, onCreateBiz, addingProject, setAddingProject, newProjectName, setNewProjectName, savingProject, projectError, setProjectError, onCreateProject }: Props) {
  const { businesses, activeBusiness, setActiveBusiness } = useWorkspace();

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto">
      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Business / Project</p>

      <button onClick={() => { setActiveBusiness(null); onClose(); }}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${!activeBusiness ? "bg-zinc-800/80 text-white" : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"}`}>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-bold text-white ${!activeBusiness ? "ring-1 ring-emerald-500 ring-offset-1 ring-offset-[#0f172a]" : ""}`}>PL</span>
        Personal Ledger
      </button>

      {businesses.map((b) => (
        <div key={b.id}>
          <button onClick={() => { setActiveBusiness(b); onClose(); }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${activeBusiness?.id === b.id && !activeProjectId ? "bg-zinc-800/80 text-white" : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${bizColor(b.name)} ${activeBusiness?.id === b.id && !activeProjectId ? "ring-1 ring-emerald-500 ring-offset-1 ring-offset-[#0f172a]" : ""}`}>{bizInitials(b.name)}</span>
            <span className="truncate">{b.name}</span>
          </button>

          {activeBusiness?.id === b.id && (
            <div className="ml-5 mt-0.5 border-l border-zinc-700/50 pb-1 pl-3">
              {projects.map((p) => (
                <button key={p.id} onClick={() => { onProjectClick(p.id, p.name); onClose(); }}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs transition ${p.id === activeProjectId ? "bg-zinc-700/60 text-zinc-200 font-medium" : "text-zinc-500 hover:bg-zinc-700/40 hover:text-zinc-300"}`}>
                  <svg className="h-3 w-3 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z" /></svg>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              {addingProject ? (
                <form onSubmit={(e) => { e.preventDefault(); onCreateProject(newProjectName); }} className="mt-1.5 space-y-1.5">
                  <input autoFocus value={newProjectName} onChange={(e) => { setNewProjectName(e.target.value); setProjectError(null); }} placeholder="Project name" className={inputCls} />
                  {projectError && <p className="text-[11px] text-red-400">{projectError}</p>}
                  <div className="flex gap-1.5">
                    <button type="submit" disabled={savingProject || !newProjectName.trim()} className={saveBtnCls}>{savingProject ? "..." : "Save"}</button>
                    <button type="button" onClick={() => { setAddingProject(false); setNewProjectName(""); setProjectError(null); }} className={cancelBtnCls}>Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddingProject(true)} className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition">
                  <span>+</span> Add Project
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {addingBiz ? (
        <form onSubmit={(e) => { e.preventDefault(); onCreateBiz(newBizName); }} className="mt-1.5 px-1 space-y-1.5">
          <input autoFocus value={newBizName} onChange={(e) => { setNewBizName(e.target.value); setBizError(null); }} placeholder="Business name" className={inputCls} />
          {bizError && <p className="text-[11px] text-red-400">{bizError}</p>}
          <div className="flex gap-1.5">
            <button type="submit" disabled={savingBiz || !newBizName.trim()} className={saveBtnCls}>{savingBiz ? "..." : "Save"}</button>
            <button type="button" onClick={() => { setAddingBiz(false); setNewBizName(""); setBizError(null); }} className={cancelBtnCls}>Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAddingBiz(true)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-600 hover:text-zinc-400 transition">
          + Add Business
        </button>
      )}
    </nav>
  );
}
