import { isDemoMode } from "@/lib/demo";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";

const DEV_USER_ID = "demo-user-1";
const DEV_USER_EMAIL = "demo@billboardhub.local";

/** Headers for FastAPI when calling protected routes. */
export async function getBackendAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined" && isDemoMode()) {
    return {
      "x-dev-user-id": DEV_USER_ID,
      "x-dev-user-email": DEV_USER_EMAIL,
    };
  }
  if (!isSupabaseConfigured()) {
    return {
      "x-dev-user-id": DEV_USER_ID,
      "x-dev-user-email": DEV_USER_EMAIL,
    };
  }
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export async function getBackendAuthHeadersOrThrow(): Promise<Record<string, string>> {
  const headers = await getBackendAuthHeaders();
  if (
    !headers.Authorization &&
    isSupabaseConfigured() &&
    typeof window !== "undefined" &&
    !isDemoMode()
  ) {
    throw new Error("Brak aktywnej sesji. Zaloguj się ponownie.");
  }
  return headers;
}
