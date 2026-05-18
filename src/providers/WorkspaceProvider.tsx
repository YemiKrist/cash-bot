"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export interface Business {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

interface WorkspaceContextValue {
  businesses: Business[];
  activeBusiness: Business | null; // null = Personal Ledger
  setActiveBusiness: (b: Business | null) => void;
  createBusiness: (name: string) => Promise<string | null>; // returns error message or null
  loadingBusinesses: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  businesses: [],
  activeBusiness: null,
  setActiveBusiness: () => {},
  createBusiness: async () => null,
  loadingBusinesses: true,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    if (!user) {
      setBusinesses([]);
      setLoadingBusinesses(false);
      return;
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) console.error("[WorkspaceProvider] fetchBusinesses:", error.message);
    setBusinesses(data ?? []);
    setLoadingBusinesses(false);
  }, [user]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const createBusiness = useCallback(
    async (name: string): Promise<string | null> => {
      if (!user) return "Not authenticated.";
      const { error } = await supabase
        .from("businesses")
        .insert({ user_id: user.id, name: name.trim() });
      if (error) {
        console.error("[WorkspaceProvider] createBusiness:", error.message);
        return error.message;
      }
      await fetchBusinesses();
      return null;
    },
    [user, fetchBusinesses]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        businesses,
        activeBusiness,
        setActiveBusiness,
        createBusiness,
        loadingBusinesses,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
