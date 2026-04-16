import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import {
  getSupabaseConnectionConfig,
  subscribeToSupabaseConnection,
  supabase,
  type SupabaseConnectionConfig,
} from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string | null } | null;
  loading: boolean;
  connection: SupabaseConnectionConfig;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  connection: getSupabaseConnectionConfig(),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(getSupabaseConnectionConfig());
  const [connectionVersion, setConnectionVersion] = useState(0);

  useEffect(() => {
    return subscribeToSupabaseConnection((nextConnection) => {
      setConnection(nextConnection);
      setConnectionVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setSession(null);
    setUser(null);
    setProfile(null);

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.warn("profile lookup skipped:", error.message);
        return null;
      }

      return data;
    };

    // Safety timeout - never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn("Auth loading timeout - forcing loaded state");
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("getSession error:", error);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).then((data) => {
          if (mounted) setProfile(data);
        });
      }
      setLoading(false);
    }).catch((err) => {
      console.error("getSession catch:", err);
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const data = await loadProfile(session.user.id);
          if (mounted) setProfile(data);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [connectionVersion]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, connection, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
