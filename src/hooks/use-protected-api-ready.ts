import { useAuth } from "@/contexts/AuthContext";
import { isDemoMode } from "@/lib/demo";
import { isSupabaseConfigured } from "@/lib/supabase-client";

/**
 * Guards protected backend calls until auth state is settled.
 * This avoids firing /contracts requests with empty headers while Supabase
 * is still restoring a persisted session.
 */
export function useProtectedApiReady(): boolean {
  const { loading, user } = useAuth();

  if (isDemoMode()) return true;
  if (!isSupabaseConfigured()) return true;
  if (loading) return false;
  return Boolean(user);
}
