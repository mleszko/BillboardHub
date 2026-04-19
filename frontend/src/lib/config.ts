export const appConfig = {
  backendUrl:
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ??
    "http://localhost:8000",
  defaultMode: process.env.NEXT_PUBLIC_DEFAULT_MODE ?? "auth",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export const apiBaseUrl = appConfig.backendUrl;
