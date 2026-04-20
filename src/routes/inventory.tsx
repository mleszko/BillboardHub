import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { billboards, formatPLN } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillboardDetailPanel } from "@/components/BillboardDetailPanel";
import { requireSessionForAppRoute } from "@/lib/require-session";

export const Route = createFileRoute("/inventory")({
  beforeLoad: () => requireSessionForAppRoute(),
  head: () => ({
    meta: [
      { title: "Inventory — BillboardHub" },
      {
        name: "description",
        content: "Complete billboard inventory with status, format, and pricing.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "vacant" | "critical">("all");
  const [selected, setSelected] = useState<(typeof billboards)[number] | null>(null);
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    return billboards.filter((b) => {
      if (filter === "active" && b.status !== "active") return false;
      if (filter === "vacant" && b.status !== "vacant") return false;
      if (filter === "critical" && b.status !== "critical") return false;
      const ql = q.toLowerCase();
      return (
        !ql ||
        b.code.toLowerCase().includes(ql) ||
        b.city.toLowerCase().includes(ql) ||
        b.address.toLowerCase().includes(ql) ||
        b.client?.toLowerCase().includes(ql)
      );
    });
  }, [q, filter]);

  return (
    <AppShell title="Inventory" subtitle={`${billboards.length} nośników w portfelu`}>
      <div className="space-y-4 p-3 md:space-y-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Szukaj po kodzie, mieście, kliencie…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">Wszystkie</TabsTrigger>
              <TabsTrigger value="active">Aktywne</TabsTrigger>
              <TabsTrigger value="vacant">Wolne</TabsTrigger>
              <TabsTrigger value="critical">Krytyczne</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((b) => (
            <Card
              key={b.id}
              className="group cursor-pointer overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => {
                setSelected(b);
                setOpen(true);
              }}
            >
              <div className="relative h-32 overflow-hidden bg-muted">
                <img
                  src={b.creativePhoto}
                  alt={b.client ?? "Vacant"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute left-2 top-2">
                  <StatusBadge status={b.status} className="bg-white/90 backdrop-blur" />
                </div>
                <div className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                  {b.code}
                </div>
              </div>
              <CardContent className="space-y-2 p-3">
                <div>
                  <div className="truncate text-sm font-semibold">{b.client ?? "Wolny nośnik"}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" /> {b.city} · {b.address}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">{b.type}</span>
                  <span className="text-muted-foreground">{b.size}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Eye className="h-3 w-3" /> {(b.dailyImpressions / 1000).toFixed(0)}k/dzień
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatPLN(b.monthlyPrice)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <BillboardDetailPanel billboard={selected} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
