import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Map,
  Package,
  FileText,
  Settings,
  Sparkles,
  Radio,
  FileSpreadsheet,
  Heart,
  Rocket,
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
import { useNavigate } from "@tanstack/react-router";

const operations = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Map View", url: "/map", icon: Map },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Contracts", url: "/contracts", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

const labs = [
  { title: "AI Intake", url: "/ai-intake", icon: Sparkles, beta: true },
  { title: "Excel Importer", url: "/import", icon: FileSpreadsheet, beta: true },
];

const resources = [
  { title: "Roadmap", url: "/roadmap", icon: Rocket },
  { title: "Wsparcie", url: "/support", icon: Heart },
];

export function AppSidebar() {
  const location = useLocation();
  const path = location.pathname;

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
              Podlaskie OOH
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operations.map((item) => {
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

        <SidebarGroup>
          <SidebarGroupLabel>AI Labs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {labs.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
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

        <SidebarGroup>
          <SidebarGroupLabel>Zasoby</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {resources.map((item) => {
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
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/60 p-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            AK
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-medium text-sidebar-foreground">Anna Kowalska</div>
            <div className="truncate text-sidebar-foreground/60">CEO · Podlaskie Estate</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function DemoFooter() {
  const [demo, setDemo] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setDemo(isDemoMode()); }, []);
  if (!demo) return null;
  return (
    <button
      onClick={() => { endDemo(); navigate({ to: "/" }); }}
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
