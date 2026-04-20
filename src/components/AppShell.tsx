import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HubertWidget } from "./HubertWidget";
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo";
import { stats } from "@/lib/mock-data";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { getBackendAuthHeaders } from "@/lib/backend-auth";

interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

type ContractsResponse = {
  items: Array<{
    expiry_date: string;
  }>;
};

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";
const GLOBAL_SEARCH_KEY = "bbhub:global-search-value";

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    let alive = true;
    const loadNotifications = async () => {
      if (isDemoMode()) {
        if (alive) setNotifications(stats().expiring30);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/contracts`, {
          headers: await getBackendAuthHeaders(),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as ContractsResponse;
        const now = Date.now();
        const expiring30 = (payload.items ?? []).filter((item) => {
          const days = Math.ceil(
            (new Date(item.expiry_date).getTime() - now) / (1000 * 60 * 60 * 24),
          );
          return days <= 30;
        }).length;
        if (alive) setNotifications(expiring30);
      } catch {
        if (alive) setNotifications(0);
      }
    };
    void loadNotifications();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = window.sessionStorage.getItem(GLOBAL_SEARCH_KEY) || "";
    setGlobalSearch(current);
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="hidden min-w-0 flex-1 md:block">
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 md:flex-initial">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj billboardu, klienta…"
                className="h-9 w-64 pl-8"
                value={globalSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setGlobalSearch(value);
                  window.sessionStorage.setItem(GLOBAL_SEARCH_KEY, value);
                  window.dispatchEvent(new CustomEvent("bbhub:global-search", { detail: value }));
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const query = (e.currentTarget.value || "").trim();
                  window.sessionStorage.setItem(GLOBAL_SEARCH_KEY, query);
                  window.dispatchEvent(new CustomEvent("bbhub:global-search", { detail: query }));
                  if (location.pathname !== "/contracts") {
                    navigate({ to: "/contracts" });
                  }
                }}
              />
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {notifications > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-destructive p-0 text-[10px] text-destructive-foreground">
                  {notifications}
                </Badge>
              )}
            </Button>
            {actions}
          </div>
        </header>
        <div className="md:hidden border-b bg-card px-4 py-3">
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <main className="flex-1 bg-background">{children}</main>
      </SidebarInset>
      <HubertWidget />
    </SidebarProvider>
  );
}
