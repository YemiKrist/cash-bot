"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { WeeklySummaryRow, ProjectSummaryRow, Project, TaxSummary } from "@/lib/types";

// ── Weekly summary (filterable by project) ────────────────────────────────────

interface UseAnalyticsResult {
  data: WeeklySummaryRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAnalytics(projectId?: string | null): UseAnalyticsResult {
  const { user } = useAuth();
  const { activeBusiness } = useWorkspace();
  const [data, setData] = useState<WeeklySummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user || !activeBusiness) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    const params: Record<string, string> = { p_business_id: activeBusiness.id };
    if (projectId) params.p_project_id = projectId;

    const { data: rows, error: rpcError } = await supabase.rpc(
      "get_weekly_business_summary",
      params,
    );

    if (rpcError) {
      setError(rpcError.message);
      setData([]);
    } else {
      setData((rows as WeeklySummaryRow[]) ?? []);
    }

    setLoading(false);
  }, [user, activeBusiness, projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ── Per-project breakdown ─────────────────────────────────────────────────────

interface UseProjectAnalyticsResult {
  projects: ProjectSummaryRow[];
  loading: boolean;
  error: string | null;
}

export function useProjectAnalytics(): UseProjectAnalyticsResult {
  const { user } = useAuth();
  const { activeBusiness } = useWorkspace();
  const [projects, setProjects] = useState<ProjectSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user || !activeBusiness) {
      setProjects([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: rows, error: rpcError } = await supabase.rpc(
      "get_project_summary",
      { p_business_id: activeBusiness.id },
    );

    if (rpcError) {
      setError(rpcError.message);
      setProjects([]);
    } else {
      setProjects((rows as ProjectSummaryRow[]) ?? []);
    }

    setLoading(false);
  }, [user, activeBusiness]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { projects, loading, error };
}

// ── Projects list (for dropdowns) — calls /api/projects with auth token ───────

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
}

export function useProjects(): UseProjectsResult {
  const { user } = useAuth();
  const { activeBusiness } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !activeBusiness) {
      setProjects([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase.auth.getSession().then(({ data: sessionData }) => {
      const token = sessionData.session?.access_token ?? "";

      fetch(`/api/projects?businessId=${activeBusiness.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((body: Project[] | { error: string }) => {
          if (!cancelled) {
            setProjects(Array.isArray(body) ? body : []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => { cancelled = true; };
  }, [user, activeBusiness]);

  return { projects, loading };
}

// ── Tax / VAT liability for the current quarter ───────────────────────────────

interface UseTaxSummaryResult {
  data:    TaxSummary | null;
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

export function useTaxSummary(
  quarterFrom?: string,
  quarterTo?:   string,
): UseTaxSummaryResult {
  const { user }           = useAuth();
  const { activeBusiness } = useWorkspace();
  const [data,    setData]    = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !activeBusiness) { setData(null); return; }

    setLoading(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";

      const params = new URLSearchParams({ businessId: activeBusiness.id });
      if (quarterFrom) params.set("from", quarterFrom);
      if (quarterTo)   params.set("to",   quarterTo);

      const res = await fetch(`/api/analytics/tax?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? "Failed to load tax data");
        setLoading(false);
        return;
      }

      const json = await res.json() as TaxSummary | null;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user, activeBusiness, quarterFrom, quarterTo]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
