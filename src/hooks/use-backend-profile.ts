import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBackendAuthHeaders } from "@/lib/backend-auth";
import { isDemoMode } from "@/lib/demo";

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

export type BackendProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
};

export function useBackendProfile(): { profile: BackendProfile | null; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<BackendProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDemoMode() || !user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const headers = await getBackendAuthHeaders();
      const hasAuth =
        Boolean(headers.Authorization) ||
        Boolean(headers["x-dev-user-id"] && headers["x-dev-user-email"]);
      if (!hasAuth) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, { headers });
        if (!res.ok) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        const body = (await res.json()) as BackendProfile;
        if (!cancelled) {
          setProfile(body);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { profile, loading: authLoading || loading };
}
