"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";

// ── Icons ───────────────────────────────────────────────────────────────────

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onProjectClick?: (projectId: string, projectName: string) => void;
  onSettingsClick?: () => void;
}

export default function Sidebar({ open, onClose, onProjectClick, onSettingsClick }: SidebarProps) {
  const { businesses, activeBusiness, setActiveBusiness, createBusiness, renameBusiness, deleteBusiness } =
    useWorkspace();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Business edit/delete
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [editingBizName, setEditingBizName] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);
  const [editBizError, setEditBizError] = useState<string | null>(null);
  const [confirmDeleteBizId, setConfirmDeleteBizId] = useState<string | null>(null);
  const [deletingBiz, setDeletingBiz] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Project edit/delete
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [savingEditProject, setSavingEditProject] = useState(false);
  const [editProjectError, setEditProjectError] = useState<string | null>(null);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    if (!activeBusiness) {
      setProjects([]);
      setAddingProject(false);
      return;
    }
    supabase
      .from("projects")
      .select("id, name")
      .eq("business_id", activeBusiness.id)
      .order("name")
      .then(({ data }) => {
        setProjects((data as { id: string; name: string }[]) ?? []);
      });
  }, [activeBusiness]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setCreateError(null);
    const err = await createBusiness(newName);
    setSaving(false);
    if (err) {
      setCreateError(err);
      return;
    }
    setNewName("");
    setAdding(false);
  }

  async function handleRenameBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBizId || !editingBizName.trim()) return;
    setSavingBiz(true);
    setEditBizError(null);
    const err = await renameBusiness(editingBizId, editingBizName);
    setSavingBiz(false);
    if (err) { setEditBizError(err); return; }
    setEditingBizId(null);
  }

  async function handleDeleteBusiness(id: string) {
    setDeletingBiz(true);
    await deleteBusiness(id);
    setDeletingBiz(false);
    setConfirmDeleteBizId(null);
  }

  async function handleEditProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProjectId || !editingProjectName.trim()) return;
    setSavingEditProject(true);
    setEditProjectError(null);
    const { error } = await supabase
      .from("projects")
      .update({ name: editingProjectName.trim() })
      .eq("id", editingProjectId);
    setSavingEditProject(false);
    if (error) { setEditProjectError(error.message); return; }
    setEditingProjectId(null);
    refreshProjects();
  }

  async function handleDeleteProject(id: string) {
    setDeletingProject(true);
    await supabase.from("projects").delete().eq("id", id);
    setDeletingProject(false);
    setConfirmDeleteProjectId(null);
    refreshProjects();
  }

  async function refreshProjects() {
    if (!activeBusiness) return;
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("business_id", activeBusiness.id)
      .order("name");
    setProjects((data as { id: string; name: string }[]) ?? []);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed || !activeBusiness) return;
    setSavingProject(true);
    setProjectError(null);
    const { error } = await supabase
      .from("projects")
      .insert({ business_id: activeBusiness.id, name: trimmed });
    setSavingProject(false);
    if (error) {
      setProjectError(error.message);
      return;
    }
    setNewProjectName("");
    setAddingProject(false);
    refreshProjects();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-shrink-0 flex-col
          border-r border-zinc-800 bg-zinc-950 px-3 py-5
          transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Wordmark + mobile close */}
        <div className="mb-6 flex items-center justify-between px-2">
          <span className="text-lg font-bold tracking-tight text-white">
            Cash<span className="text-emerald-400">Bot</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:text-white transition lg:hidden"
            aria-label="Close menu"
          >
            <XIcon />
          </button>
        </div>

        {/* Workspace list */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Workspaces
          </p>

          <button
            onClick={() => { setActiveBusiness(null); onClose(); }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
              activeBusiness === null
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
            }`}
          >
            <span className={activeBusiness === null ? "text-emerald-400" : "text-zinc-500"}>
              <WalletIcon />
            </span>
            Personal Ledger
          </button>

          {businesses.map((b) => (
            <div key={b.id}>
              {editingBizId === b.id ? (
                <form onSubmit={handleRenameBusiness} className="px-1 py-0.5">
                  <input
                    autoFocus
                    value={editingBizName}
                    onChange={(e) => { setEditingBizName(e.target.value); setEditBizError(null); }}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  {editBizError && <p className="mt-1 text-xs text-red-400">{editBizError}</p>}
                  <div className="mt-1.5 flex gap-1.5">
                    <button type="submit" disabled={savingBiz || !editingBizName.trim()} className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition">
                      {savingBiz ? "…" : "Save"}
                    </button>
                    <button type="button" onClick={() => { setEditingBizId(null); setEditBizError(null); }} className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : confirmDeleteBizId === b.id ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-red-950/40 px-2.5 py-2">
                  <span className="flex-1 truncate text-xs text-red-300">Delete "{b.name}"?</span>
                  <button
                    onClick={() => handleDeleteBusiness(b.id)}
                    disabled={deletingBiz}
                    className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    {deletingBiz ? "…" : "Delete"}
                  </button>
                  <button onClick={() => setConfirmDeleteBizId(null)} className="rounded-lg p-1 text-zinc-500 transition hover:text-zinc-300">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="group flex items-center rounded-lg transition hover:bg-zinc-800/60">
                  <button
                    onClick={() => { setActiveBusiness(b); onClose(); }}
                    className={`flex flex-1 items-center gap-2.5 px-2.5 py-2 text-sm transition ${
                      activeBusiness?.id === b.id ? "text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className={activeBusiness?.id === b.id ? "text-emerald-400" : "text-zinc-500"}>
                      <BuildingIcon />
                    </span>
                    <span className="truncate">{b.name}</span>
                  </button>
                  <div className="flex items-center gap-0.5 pr-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => { setEditingBizId(b.id); setEditingBizName(b.name); setEditBizError(null); setConfirmDeleteBizId(null); }}
                      className="rounded p-1 text-zinc-600 hover:text-zinc-300 transition"
                      aria-label="Rename business"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setConfirmDeleteBizId(b.id); setEditingBizId(null); }}
                      className="rounded p-1 text-zinc-600 hover:text-red-400 transition"
                      aria-label="Delete business"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {activeBusiness?.id === b.id && (
                <div className="ml-5 mt-0.5 border-l border-zinc-800 pl-3 pb-1">
                  {projects.map((p) => (
                    <div key={p.id}>
                      {editingProjectId === p.id ? (
                        <form onSubmit={handleEditProject} className="py-0.5">
                          <input
                            autoFocus
                            value={editingProjectName}
                            onChange={(e) => { setEditingProjectName(e.target.value); setEditProjectError(null); }}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                          />
                          {editProjectError && <p className="mt-1 text-xs text-red-400">{editProjectError}</p>}
                          <div className="mt-1 flex gap-1">
                            <button type="submit" disabled={savingEditProject || !editingProjectName.trim()} className="flex-1 rounded-lg bg-emerald-500 py-1 text-[10px] font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition">
                              {savingEditProject ? "…" : "Save"}
                            </button>
                            <button type="button" onClick={() => { setEditingProjectId(null); setEditProjectError(null); }} className="flex-1 rounded-lg border border-zinc-700 py-1 text-[10px] text-zinc-400 hover:text-white transition">
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : confirmDeleteProjectId === p.id ? (
                        <div className="flex items-center gap-1 rounded-md bg-red-950/40 px-1.5 py-1.5">
                          <span className="flex-1 truncate text-[10px] text-red-300">Delete?</span>
                          <button
                            onClick={() => handleDeleteProject(p.id)}
                            disabled={deletingProject}
                            className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-500 disabled:opacity-50 transition"
                          >
                            {deletingProject ? "…" : "Delete"}
                          </button>
                          <button onClick={() => setConfirmDeleteProjectId(null)} className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="group flex items-center rounded-md transition hover:bg-zinc-800/60">
                          <button
                            onClick={() => { onProjectClick?.(p.id, p.name); onClose(); }}
                            className="flex flex-1 items-center gap-2 px-1.5 py-1.5 text-left text-xs text-zinc-400 hover:text-zinc-200 transition"
                          >
                            <span className="shrink-0 text-zinc-500"><FolderIcon /></span>
                            <span className="truncate">{p.name}</span>
                          </button>
                          <div className="flex items-center gap-0.5 pr-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              onClick={() => { setEditingProjectId(p.id); setEditingProjectName(p.name); setEditProjectError(null); setConfirmDeleteProjectId(null); }}
                              className="rounded p-0.5 text-zinc-600 hover:text-zinc-300 transition"
                              aria-label="Rename project"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setConfirmDeleteProjectId(p.id); setEditingProjectId(null); }}
                              className="rounded p-0.5 text-zinc-600 hover:text-red-400 transition"
                              aria-label="Delete project"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addingProject ? (
                    <form onSubmit={handleCreateProject} className="mt-1.5">
                      <input
                        autoFocus
                        value={newProjectName}
                        onChange={(e) => { setNewProjectName(e.target.value); setProjectError(null); }}
                        placeholder="Project name"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                      />
                      {projectError && <p className="mt-1 text-xs text-red-400">{projectError}</p>}
                      <div className="mt-1.5 flex gap-1.5">
                        <button type="submit" disabled={savingProject || !newProjectName.trim()} className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition">
                          {savingProject ? "…" : "Save"}
                        </button>
                        <button type="button" onClick={() => { setAddingProject(false); setNewProjectName(""); setProjectError(null); }} className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setAddingProject(true)} className="mt-0.5 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition">
                      <span className="leading-none">＋</span>
                      Add Project
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {adding ? (
            <form onSubmit={handleCreate} className="mt-1 px-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
                placeholder="Business name"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              {createError && (
                <p className="mt-1.5 rounded-lg border border-red-800 bg-red-950/60 px-2.5 py-1.5 text-[11px] leading-snug text-red-400">
                  {createError}
                </p>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button type="submit" disabled={saving || !newName.trim()} className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => { setAdding(false); setNewName(""); setCreateError(null); }} className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition">
              <span className="text-base leading-none">＋</span>
              Add Business
            </button>
          )}
        </nav>

        {/* Sign out */}
        <div className="border-t border-zinc-800 pt-3 space-y-0.5">
          {activeBusiness && onSettingsClick && (
            <button
              onClick={() => { onSettingsClick(); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Business Settings
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-red-400 transition"
          >
            <LogOutIcon />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
