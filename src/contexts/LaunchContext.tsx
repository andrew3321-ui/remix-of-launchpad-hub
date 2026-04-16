import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./AuthContext";

interface Launch {
  id: string;
  name: string;
  slug: string | null;
  status: string;
}

interface LaunchContextType {
  launches: Launch[];
  activeLaunch: Launch | null;
  setActiveLaunch: (launch: Launch | null) => void;
  loading: boolean;
  refreshLaunches: () => Promise<void>;
}

const LaunchContext = createContext<LaunchContextType>({
  launches: [],
  activeLaunch: null,
  setActiveLaunch: () => {},
  loading: true,
  refreshLaunches: async () => {},
});

export const useLaunch = () => useContext(LaunchContext);

export function LaunchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [activeLaunch, setActiveLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLaunches = useCallback(async () => {
    if (!user) {
      setLaunches([]);
      setActiveLaunch(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("launches")
      .select("id, name, slug, status")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao atualizar lancamentos",
        description: error.message,
        variant: "destructive",
      });
      setLaunches([]);
      setActiveLaunch(null);
      setLoading(false);
      return;
    }

    if (data) {
      setLaunches(data);
      setActiveLaunch((prev) => {
        if (prev && data.find((l) => l.id === prev.id)) {
          return data.find((l) => l.id === prev.id)!;
        }
        return data.length > 0 ? data[0] : null;
      });
    }
    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    fetchLaunches();
  }, [fetchLaunches]);

  return (
    <LaunchContext.Provider
      value={{ launches, activeLaunch, setActiveLaunch, loading, refreshLaunches: fetchLaunches }}
    >
      {children}
    </LaunchContext.Provider>
  );
}
