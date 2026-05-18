"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { WeeklySummaryRow } from "@/lib/types";

interface UseAnalyticsResult {
  data: WeeklySummaryRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAnalytics(): UseAnalyticsResult {
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

    const { data: rows, error: rpcError } = await supabase.rpc(
      "get_weekly_business_summary",
      { p_business_id: activeBusiness.id },
    );

    if (rpcError) {
      setError(rpcError.message);
      setData([]);
    } else {
      setData((rows as WeeklySummaryRow[]) ?? []);
    }

    setLoading(false);
  }, [user, activeBusiness]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
