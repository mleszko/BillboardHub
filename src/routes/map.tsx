import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BillboardMap } from "@/components/BillboardMap";
import { BillboardDetailPanel } from "@/components/BillboardDetailPanel";
import { useState } from "react";
import { Billboard, billboards } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map View — BillboardHub" },
      { name: "description", content: "Interactive geospatial map of all billboards with live contract status." },
    ],
  }),
  component: MapPage,
});

const legend = [
  { label: "Aktywny", cls: "bg-success" },
  { label: "Wygasa < 60 dni", cls: "bg-warning" },
  { label: "Wygasa < 30 dni", cls: "bg-destructive" },
  { label: "Wolny", cls: "bg-muted-foreground/60" },
];

function MapPage() {
  const [selected, setSelected] = useState<Billboard | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AppShell title="Map View" subtitle="Geolokalizacja całego portfela">
      <div className="relative h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
        <div className="absolute left-4 right-4 top-4 z-[400] md:left-6 md:right-auto md:max-w-md">
          <DemoPreviewBadge />
        </div>
        <BillboardMap
          billboards={billboards}
          selectedId={selected?.id}
          onSelect={(b) => {
            setSelected(b);
            setOpen(true);
          }}
        />

        {/* Legend */}
        <Card className="pointer-events-auto absolute bottom-4 left-4 z-[400] flex flex-col gap-1.5 p-3 shadow-lg md:left-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Status umowy
          </div>
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${l.cls}`} />
              {l.label}
            </div>
          ))}
        </Card>

        {/* Stats float */}
        <Card className="pointer-events-auto absolute right-4 top-4 z-[400] hidden gap-3 p-3 shadow-lg md:right-6 md:flex">
          <Stat label="Total" value={billboards.length.toString()} />
          <Divider />
          <Stat
            label="Aktywne"
            value={billboards.filter((b) => b.status === "active").length.toString()}
            tone="success"
          />
          <Divider />
          <Stat
            label="Krytyczne"
            value={billboards.filter((b) => b.status === "critical").length.toString()}
            tone="destructive"
          />
        </Card>

        <BillboardDetailPanel billboard={selected} open={open} onOpenChange={setOpen} />
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-border" />;
}
