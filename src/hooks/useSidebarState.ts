"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export function useSidebarState(projectsRefreshKey?: number) {
  const { activeBusiness, createBusiness } = useWorkspace();

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [addingBiz, setAddingBiz] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBusiness) { setProjects([]); setAddingProject(false); return; }
    supabase.from("projects").select("id, name").eq("business_id", activeBusiness.id).order("name")
      .then(({ data }) => setProjects((data as { id: string; name: string }[]) ?? []));
  }, [activeBusiness, projectsRefreshKey]);

  async function handleCreateBiz(name: string): Promise<boolean> {
    setSavingBiz(true); setBizError(null);
    const err = await createBusiness(name);
    setSavingBiz(false);
    if (err) { setBizError(err); return false; }
    setNewBizName(""); setAddingBiz(false);
    return true;
  }

  async function handleCreateProject(name: string): Promise<boolean> {
    if (!activeBusiness) return false;
    setSavingProject(true); setProjectError(null);
    const { data: p, error: e } = await supabase.from("projects")
      .insert({ business_id: activeBusiness.id, name }).select("id").single() as
      { data: { id: string } | null; error: { message: string } | null };
    if (e || !p) { setSavingProject(false); setProjectError(e?.message ?? "Failed."); return false; }
    const keywords = name.toLowerCase().split(/[\s\-_/]+/).filter((w) => w.length >= 2);
    await supabase.from("sub_projects").insert({ project_id: p.id, keywords });
    setSavingProject(false); setNewProjectName(""); setAddingProject(false);
    const { data } = await supabase.from("projects").select("id, name")
      .eq("business_id", activeBusiness.id).order("name");
    setProjects((data as { id: string; name: string }[]) ?? []);
    return true;
  }

  return {
    projects,
    addingBiz, setAddingBiz, newBizName, setNewBizName, savingBiz, bizError, setBizError, handleCreateBiz,
    addingProject, setAddingProject, newProjectName, setNewProjectName, savingProject, projectError, setProjectError, handleCreateProject,
  };
}
