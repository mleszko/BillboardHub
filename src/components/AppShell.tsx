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

interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemoMode()), []);
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="hidden min-w-0 flex-1 md:block">
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 md:flex-initial">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj billboardu, klienta…"
                className="h-9 w-64 pl-8"
              />
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-destructive p-0 text-[10px] text-destructive-foreground">
                3
              </Badge>
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
      {demo && <HubertWidget />}
    </SidebarProvider>
  );
}
