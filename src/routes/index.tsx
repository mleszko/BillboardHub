import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatsHeader } from "@/components/StatsHeader";
import { RevenueChart } from "@/components/RevenueChart";
import { RecentActivity } from "@/components/RecentActivity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billboards, daysRemaining, formatPLN } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BillboardHub" },
      { name: "description", content: "Overview of billboard inventory, occupancy, revenue, and expiring contracts." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const expiring = billboards
    .filter((b) => {
      const d = daysRemaining(b);
      return d !== null && d <= 60;
    })
    .sort((a, b) => (daysRemaining(a) ?? 0) - (daysRemaining(b) ?? 0))
    .slice(0, 5);

  return (
    <AppShell
      title="Dashboard"
      subtitle="Stan portfela nośników reklamowych — Podlaskie"
      actions={
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nowy billboard</span>
        </Button>
      }
    >
      <div className="space-y-4 p-3 md:space-y-6 md:p-6">
        <StatsHeader />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <RecentActivity />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Wymagają uwagi</CardTitle>
              <p className="text-xs text-muted-foreground">Umowy wygasające w ciągu 60 dni</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/contracts">
                Wszystkie <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiring.map((b) => {
              const d = daysRemaining(b)!;
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {b.code}
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">{b.client}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.city} · {b.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Pozostało
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {d < 0 ? "wygasła" : `${d} dni`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Wartość/mc
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatPLN(b.monthlyPrice)}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="hidden md:inline-flex">
                      Przedłuż
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
