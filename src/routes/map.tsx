import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BillboardMap } from "@/components/BillboardMap";
import { BillboardDetailPanel } from "@/components/BillboardDetailPanel";
import { useEffect, useMemo, useState } from "react";
import { Billboard, billboards } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { DemoPreviewBadge } from "@/components/DemoPreviewBadge";
import { isDemoMode } from "@/lib/demo";
import { requireSessionForAppRoute } from "@/lib/require-session";
import { getBackendAuthHeaders } from "@/lib/backend-auth";

export const Route = createFileRoute("/map")({
  beforeLoad: () => requireSessionForAppRoute(),
  head: () => ({
    meta: [
      { title: "Map View — BillboardHub" },
      {
        name: "description",
        content: "Interactive geospatial map of all billboards with live contract status.",
      },
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

type BackendContract = {
  id: string;
  contract_number: string | null;
  billboard_code: string | null;
  billboard_type: string | null;
  advertiser_name: string;
  city: string | null;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  expiry_date: string;
  contract_status: string;
  monthly_rent_net: number | null;
};

type ContractsResponse = {
  items: BackendContract[];
};

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

const mapPhotos = [
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1568430462989-44163eb1752f?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=70",
];

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  bialystok: { lat: 53.1325, lng: 23.1688 },
  białystok: { lat: 53.1325, lng: 23.1688 },
  suwalki: { lat: 54.1118, lng: 22.9309 },
  suwałki: { lat: 54.1118, lng: 22.9309 },
  lomza: { lat: 53.1781, lng: 22.0594 },
  łomża: { lat: 53.1781, lng: 22.0594 },
  augustow: { lat: 53.8445, lng: 22.9798 },
  augustów: { lat: 53.8445, lng: 22.9798 },
};

function statusFromBackend(contractStatus: string, expiryDate: string): Billboard["status"] {
  if (contractStatus === "terminated") return "vacant";
  if (contractStatus === "expired") return "critical";
  const d = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (d <= 30) return "critical";
  if (d <= 60) return "expiring_soon";
  return "active";
}

function mapBillboardType(value: string | null): Billboard["type"] {
  if (value === "led") return "LED";
  if (value === "backlight") return "Backlight";
  if (value === "citylight") return "Citylight";
  return "Frontlight";
}

function defaultSize(type: Billboard["type"]): string {
  if (type === "Citylight") return "1.2 x 1.8 m";
  if (type === "Backlight") return "6 x 3 m";
  if (type === "LED") return "12 x 4 m";
  return "12 x 3 m";
}

function estimateImpressions(type: Billboard["type"]): number {
  if (type === "LED") return 50000;
  if (type === "Backlight") return 28000;
  if (type === "Citylight") return 12000;
  return 24000;
}

function hash01(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

function fallbackCoords(item: BackendContract): { lat: number; lng: number } | null {
  const rawCity = (item.city || "").trim().toLowerCase();
  const center = CITY_CENTERS[rawCity];
  if (!center) return null;
  const seed = `${item.id}:${item.location_address || ""}:${item.contract_number || ""}`;
  const jitterLat = (hash01(`${seed}:lat`) - 0.5) * 0.06;
  const jitterLng = (hash01(`${seed}:lng`) - 0.5) * 0.1;
  return { lat: center.lat + jitterLat, lng: center.lng + jitterLng };
}

function MapPage() {
  const [demo, setDemo] = useState(false);
  const [backendRows, setBackendRows] = useState<BackendContract[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Billboard | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDemo(isDemoMode());
  }, []);

  useEffect(() => {
    if (demo) {
      setReady(true);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        setLoadError(null);
        const response = await fetch(`${API_BASE_URL}/contracts`, {
          headers: await getBackendAuthHeaders(),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Nie udało się pobrać kontraktów.");
        }
        const payload = (await response.json()) as ContractsResponse;
        if (!alive) return;
        setBackendRows(payload.items ?? []);
      } catch (err) {
        if (!alive) return;
        setBackendRows([]);
        setLoadError(err instanceof Error ? err.message : "Błąd ładowania mapy.");
      } finally {
        if (alive) setReady(true);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [demo]);

  const mapRows = useMemo<Billboard[]>(() => {
    if (demo) return billboards;
    return backendRows
      .map((item, idx) => {
        const type = mapBillboardType(item.billboard_type);
        const hasExact = Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
        const approx = !hasExact ? fallbackCoords(item) : null;
        const lat = hasExact ? Number(item.latitude) : approx?.lat;
        const lng = hasExact ? Number(item.longitude) : approx?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: item.id,
          code:
            item.billboard_code ||
            item.contract_number ||
            `CTR-${item.id.slice(0, 8).toUpperCase()}`,
          city: item.city || "—",
          address: item.location_address || "Adres z umowy",
          lat,
          lng,
          type,
          size: defaultSize(type),
          monthlyPrice: item.monthly_rent_net || 0,
          status: statusFromBackend(item.contract_status, item.expiry_date),
          client: item.advertiser_name,
          contractStart: item.start_date || undefined,
          contractEnd: item.expiry_date,
          creativePhoto: mapPhotos[idx % mapPhotos.length],
          dailyImpressions: estimateImpressions(type),
        };
      })
      .filter((row): row is Billboard => Boolean(row));
  }, [backendRows, demo]);

  const criticalCount = mapRows.filter((b) => b.status === "critical").length;
  const activeCount = mapRows.filter((b) => b.status === "active").length;

  useEffect(() => {
    if (!selected) return;
    const fresh = mapRows.find((row) => row.id === selected.id) || null;
    setSelected(fresh);
    if (!fresh) setOpen(false);
  }, [mapRows, selected]);

  return (
    <AppShell title="Map View" subtitle="Geolokalizacja całego portfela">
      <div className="relative h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
        {demo && (
          <div className="absolute left-4 right-4 top-4 z-[400] md:left-6 md:right-auto md:max-w-md">
            <DemoPreviewBadge />
          </div>
        )}
        {!demo && loadError && (
          <Card className="absolute left-4 right-4 top-4 z-[400] border-destructive/30 bg-destructive/10 md:left-6 md:max-w-md">
            <CardContent className="p-3 text-xs text-destructive">{loadError}</CardContent>
          </Card>
        )}
        {!ready && (
          <Card className="absolute left-4 right-4 top-4 z-[400] md:left-6 md:max-w-md">
            <CardContent className="p-3 text-xs text-muted-foreground">
              Ładowanie mapy...
            </CardContent>
          </Card>
        )}
        <BillboardMap
          billboards={mapRows}
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
          <Stat label="Total" value={mapRows.length.toString()} />
          <Divider />
          <Stat label="Aktywne" value={activeCount.toString()} tone="success" />
          <Divider />
          <Stat label="Krytyczne" value={criticalCount.toString()} tone="destructive" />
        </Card>

        <BillboardDetailPanel billboard={selected} open={open} onOpenChange={setOpen} />
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
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
