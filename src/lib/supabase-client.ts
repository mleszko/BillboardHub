import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function resolveSupabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
}

function resolveSupabaseAnonToken(): string {
  const preferred = (import.meta.env.VITE_SUPABASE_ANON as string | undefined)?.trim() ?? "";
  if (preferred) return preferred;
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";
}

export function isSupabaseConfigured(): boolean {
  const url = resolveSupabaseUrl();
  const anonToken = resolveSupabaseAnonToken();
  return Boolean(url && anonToken);
}

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON must be set for Supabase auth (legacy VITE_SUPABASE_ANON_KEY is still supported).",
    );
  }
  if (!client) {
    const url = resolveSupabaseUrl();
    const anonToken = resolveSupabaseAnonToken();
    client = createClient(url, anonToken, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return client;
}
