import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Map,
  FileText,
  Settings,
  Sparkles,
  Radio,
  FileSpreadsheet,
  Heart,
  Rocket,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BetaBadge } from "./BetaBadge";
import { useEffect, useState } from "react";
import { endDemo, isDemoMode } from "@/lib/demo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useBackendProfile } from "@/hooks/use-backend-profile";

// Stable post-login core. These features must work 100%.
const CORE = [
  { title: "Dashboard", url: "/app", icon: FileText },
  { title: "Map View", url: "/map", icon: Map },
  { title: "Contracts", url: "/contracts", icon: FileText },
  { title: "Excel Importer", url: "/import", icon: FileSpreadsheet },
  { title: "Ustawienia", url: "/settings", icon: Settings },
];

// Demo-only "wodotryski". Hidden in standard logged-in mode.
const DEMO_PREVIEW = [
  { title: "Mapa nośników", url: "/map", icon: Map, beta: true },
  { title: "Inventory", url: "/inventory", icon: Sparkles, beta: true },
  { title: "Hubert AI", url: "/ai-intake", icon: Bot, beta: true },
  { title: "AI Intake", url: "/ai-intake", icon: Sparkles, beta: true },
];

const RESOURCES = [
  { title: "Roadmap", url: "/roadmap", icon: Rocket },
  { title: "Wsparcie", url: "/support", icon: Heart },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [demo, setDemo] = useState(false);
  const { user, signOut, authConfigured } = useAuth();
  const { profile } = useBackendProfile();
  useEffect(() => setDemo(isDemoMode()), []);

  const displayName = demo
    ? "Mateusz (demo)"
    : profile?.full_name?.trim() ||
      user?.email ||
      (authConfigured ? "Niezalogowany" : "Dev (lokalnie)");
  const displaySub = demo
    ? "Demo Mode"
    : profile?.company_name?.trim() || (authConfigured ? "Sesja Supabase" : "Nagłówki dev");
  const initials = (() => {
    if (demo) return "MD";
    const name = profile?.full_name?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    const email = user?.email?.trim();
    if (email) return email.slice(0, 2).toUpperCase();
    return authConfigured ? "?" : "D";
  })();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Radio className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              BillboardHub
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              {demo ? "Demo · Podlaskie" : "Stable Core"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Rdzeń</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CORE.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {demo && (
          <SidebarGroup>
            <SidebarGroupLabel>Upcoming Preview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {DEMO_PREVIEW.map((item) => {
                  const active = path === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          {item.beta && <BetaBadge className="ml-auto" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Zasoby</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {RESOURCES.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DemoFooter />
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 p-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {initials.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-medium text-sidebar-foreground">{displayName}</div>
            <div className="truncate text-sidebar-foreground/60">{displaySub}</div>
          </div>
          {!demo && user ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-[10px]"
              onClick={() => {
                void signOut().then(() => navigate({ to: "/auth" }));
              }}
            >
              Wyloguj
            </Button>
          ) : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function DemoFooter() {
  const [demo, setDemo] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    setDemo(isDemoMode());
  }, []);
  if (!demo) return null;
  return (
    <button
      onClick={() => {
        endDemo();
        navigate({ to: "/" });
      }}
      className="mb-1 flex items-center justify-between gap-2 rounded-md border border-sidebar-primary/30 bg-sidebar-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-primary/20 group-data-[collapsible=icon]:hidden"
    >
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sidebar-primary" />
        Tryb demo
      </span>
      <span className="text-sidebar-foreground/60">Wyjdź</span>
    </button>
  );
}
