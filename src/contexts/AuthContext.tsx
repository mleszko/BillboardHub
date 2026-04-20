import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authConfigured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authConfigured);

  const refreshSession = useCallback(async () => {
    if (!authConfigured) {
      setSession(null);
      setLoading(false);
      return;
    }
    const { data } = await getSupabaseClient().auth.getSession();
    setSession(data.session);
  }, [authConfigured]);

  useEffect(() => {
    if (!authConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [authConfigured]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!authConfigured) {
        return {
          error: new Error(
            "Logowanie przez Supabase nie jest skonfigurowane. Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY w pliku .env.",
          ),
        };
      }
      const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    },
    [authConfigured],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!authConfigured) {
        return {
          error: new Error(
            "Rejestracja wymaga skonfigurowanego Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).",
          ),
        };
      }
      const { error } = await getSupabaseClient().auth.signUp({ email, password });
      return { error: error ? new Error(error.message) : null };
    },
    [authConfigured],
  );

  const signOut = useCallback(async () => {
    if (!authConfigured) return;
    await getSupabaseClient().auth.signOut();
    setSession(null);
  }, [authConfigured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authConfigured,
      signIn,
      signUp,
      signOut,
      refreshSession,
    }),
    [session, loading, authConfigured, signIn, signUp, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
