import { redirect } from "@tanstack/react-router";
import { isDemoMode } from "@/lib/demo";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";

/**
 * For protected app routes: require Supabase session when auth is configured.
 * Skips on SSR, demo mode, or when Supabase env is missing (dev header fallback).
 */
export async function requireSessionForAppRoute(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDemoMode()) return;
  if (!isSupabaseConfigured()) return;
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/auth" });
  }
}
