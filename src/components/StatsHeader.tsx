import { Card } from "@/components/ui/card";
import { ArrowUpRight, AlertTriangle, Building2, TrendingUp, Percent } from "lucide-react";
import { formatPLN, stats } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type StatsHeaderData = {
  total: number;
  occupancy: number;
  monthlyValue: number;
  expiring30: number;
};

export function StatsHeader({ data }: { data?: StatsHeaderData }) {
  const s = data ?? stats();
  const items = [
    {
      label: "Total Billboards",
      value: s.total.toString(),
      delta: data ? "Aktywne kontrakty" : "+2 vs last month",
      icon: Building2,
      tone: "default" as const,
    },
    {
      label: "Occupancy Rate",
      value: `${s.occupancy}%`,
      delta: data ? "Wg stanu portfela" : "+4 pts MoM",
      icon: Percent,
      tone: "success" as const,
    },
    {
      label: "Wartość umów / mc",
      value: formatPLN(s.monthlyValue),
      delta: data ? "Suma czynszów netto" : "+12% MoM",
      icon: TrendingUp,
      tone: "success" as const,
    },
    {
      label: "Expiring < 30 days",
      value: s.expiring30.toString(),
      delta: "Action required",
      icon: AlertTriangle,
      tone: "critical" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {items.map((it) => (
        <Card
          key={it.label}
          className={cn(
            "relative overflow-hidden p-4 transition-shadow hover:shadow-md md:p-5",
            it.tone === "critical" && "border-destructive/40 bg-destructive/5",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:text-xs">
                {it.label}
              </p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight md:text-3xl">{it.value}</p>
            </div>
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10",
                it.tone === "success" && "bg-success/15 text-success",
                it.tone === "critical" && "bg-destructive/15 text-destructive",
                it.tone === "default" && "bg-primary/10 text-primary",
              )}
            >
              <it.icon className="h-4 w-4 md:h-5 md:w-5" />
            </div>
          </div>
          <div
            className={cn(
              "mt-3 flex items-center gap-1 text-[11px] font-medium md:text-xs",
              it.tone === "critical" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {it.tone !== "critical" && <ArrowUpRight className="h-3 w-3" />}
            {it.delta}
          </div>
        </Card>
      ))}
    </div>
  );
}
