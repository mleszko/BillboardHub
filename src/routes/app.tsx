import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ContractFormDialog,
  apiContractToFormValues,
  billboardToFormValues,
  type ContractFormValues,
} from "@/components/ContractFormDialog";
import { AppShell } from "@/components/AppShell";
import { HubertWelcomePanel } from "@/components/HubertWelcomePanel";
import { StatsHeader } from "@/components/StatsHeader";
import { RevenueChart } from "@/components/RevenueChart";
import { RecentActivity } from "@/components/RecentActivity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { daysRemaining, formatPLN } from "@/lib/mock-data";
import type { Billboard } from "@/lib/mock-data";
import { format } from "date-fns";
import {
  Search,
  ArrowUpDown,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Sparkles,
  ArrowRight,
  Pencil,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { getBillboards, useBillboards } from "@/lib/data-store";
import { requireSessionForAppRoute } from "@/lib/require-session";
import { getBackendAuthHeaders } from "@/lib/backend-auth";

const TEMPLATE_HREF =
  "data:text/csv;charset=utf-8,Kod,Miasto,Adres,Klient,Cena_mies_PLN,Data_poczatku,Data_wygasniecia,Typ,Rozmiar%0ABIA-001,Bia%C5%82ystok,al.%20Jana%20Paw%C5%82a%20II%2057,Biedronka,8400,2024-09-01,2026-09-01,LED,12x4%20m";

export const Route = createFileRoute("/app")({
  beforeLoad: () => requireSessionForAppRoute(),
  head: () => ({
    meta: [
      { title: "Umowy — BillboardHub" },
      {
        name: "description",
        content:
          "Stabilny rdzeń BillboardHub — czytelna lista umów, alerty wygaśnięcia, import z Excela.",
      },
    ],
  }),
  component: AppPage,
});

type SortKey = "expiry" | "client" | "city" | "price";
type SortDir = "asc" | "desc";

type ContractItem = {
  id: string;
  contract_number: string | null;
  billboard_code: string | null;
  billboard_type: string | null;
  advertiser_name: string;
  city: string | null;
  location_address: string | null;
  surface_size?: string | null;
  start_date?: string | null;
  expiry_date: string;
  expiry_unknown?: boolean;
  contract_status: string;
  monthly_rent_net: number | null;
};

type ContractsResponse = {
  items: ContractItem[];
};

type DashboardRow = {
  id: string;
  advertiserName: string;
  city: string | null;
  reference: string | null;
  locationAddress: string | null;
  expiryDate: string;
  expiryUnknown: boolean;
  monthlyRentNet: number;
  badgeStatus: "active" | "expiring_soon" | "critical" | "vacant";
};

type RevenuePoint = {
  month: string;
  revenue: number;
};

type ActivityItem = {
  id: number;
  type: "payment" | "renewal" | "alert" | "ai";
  text: string;
  when: string;
  amount?: number;
};

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";
const GLOBAL_SEARCH_KEY = "bbhub:global-search-value";

function daysRemainingFromIso(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function toStatusBadge(
  contractStatus: string,
  expiryDate: string,
  expiryUnknown?: boolean,
): "active" | "expiring_soon" | "critical" | "vacant" {
  if (contractStatus === "expired") return "critical";
  if (contractStatus === "terminated") return "vacant";
  if (expiryUnknown) return "active";
  const days = daysRemainingFromIso(expiryDate);
  if (days <= 30) return "critical";
  if (days <= 60) return "expiring_soon";
  return "active";
}

function AppPage() {
  const [demo, setDemo] = useState(false);
  const { data: demoBillboards, ready: demoReady } = useBillboards();
  const [all, setAll] = useState<ContractItem[]>([]);
  const [backendReady, setBackendReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractDialogMode, setContractDialogMode] = useState<"create" | "edit">("create");
  const [contractDialogInitial, setContractDialogInitial] = useState<ContractFormValues | null>(
    null,
  );

  const loadContractsFromApi = async () => {
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
      setAll(payload.items ?? []);
    } catch (err) {
      setAll([]);
      setLoadError(err instanceof Error ? err.message : "Błąd ładowania kontraktów.");
    }
  };

  useEffect(() => {
    setDemo(isDemoMode());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQ(window.sessionStorage.getItem(GLOBAL_SEARCH_KEY) || "");
    }
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setQ(custom.detail || "");
    };
    window.addEventListener("bbhub:global-search", handler as EventListener);
    return () => window.removeEventListener("bbhub:global-search", handler as EventListener);
  }, []);

  useEffect(() => {
    if (demo) {
      setBackendReady(true);
      return;
    }
    let alive = true;
    void (async () => {
      await loadContractsFromApi();
      if (alive) setBackendReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [demo]);

  const openNewContract = () => {
    setContractDialogMode("create");
    setContractDialogInitial(null);
    setContractDialogOpen(true);
  };

  const openEditContract = (row: DashboardRow) => {
    if (demo) {
      if (!row.id.startsWith("local-")) return;
      const b = getBillboards().find((x) => x.id === row.id);
      if (!b) return;
      setContractDialogMode("edit");
      setContractDialogInitial(billboardToFormValues(b));
      setContractDialogOpen(true);
      return;
    }
    const c = all.find((x) => x.id === row.id);
    if (!c) return;
    setContractDialogMode("edit");
    setContractDialogInitial(apiContractToFormValues(c));
    setContractDialogOpen(true);
  };

  const dashboardRows = useMemo<DashboardRow[]>(() => {
    if (demo) {
      return demoBillboards
        .filter((b: Billboard) => Boolean(b.client && b.contractEnd))
        .map((b) => ({
          id: b.id,
          advertiserName: b.client || "Brak klienta",
          city: b.city,
          reference: b.code,
          locationAddress: b.address,
          expiryDate: b.contractEnd || new Date().toISOString(),
          expiryUnknown: Boolean(b.expiryUnknown),
          monthlyRentNet: b.monthlyPrice || 0,
          badgeStatus: b.status,
        }));
    }
    return all.map((c) => ({
      id: c.id,
      advertiserName: c.advertiser_name,
      city: c.city,
      reference: c.contract_number || c.billboard_code,
      locationAddress: c.location_address,
      expiryDate: c.expiry_date,
      expiryUnknown: Boolean(c.expiry_unknown),
      monthlyRentNet: c.monthly_rent_net || 0,
      badgeStatus: toStatusBadge(c.contract_status, c.expiry_date, c.expiry_unknown),
    }));
  }, [all, demo, demoBillboards]);

  const ready = demo ? demoReady : backendReady;

  const cities = useMemo(
    () =>
      Array.from(
        new Set(dashboardRows.map((b) => b.city).filter((c): c is string => Boolean(c))),
      ).sort(),
    [dashboardRows],
  );

  const contracts = useMemo(() => {
    const filtered = dashboardRows
      .filter((b) => (city === "all" ? true : b.city === city))
      .filter((b) => {
        const ql = q.trim().toLowerCase();
        if (!ql) return true;
        return (
          b.advertiserName.toLowerCase().includes(ql) ||
          (b.reference || "").toLowerCase().includes(ql) ||
          (b.city || "").toLowerCase().includes(ql) ||
          (b.locationAddress || "").toLowerCase().includes(ql)
        );
      });

    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "client":
          return a.advertiserName.localeCompare(b.advertiserName) * dir;
        case "city":
          return (a.city || "").localeCompare(b.city || "") * dir;
        case "price":
          return (a.monthlyRentNet - b.monthlyRentNet) * dir;
        case "expiry":
        default:
          return (new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()) * dir;
      }
    });
  }, [dashboardRows, q, city, sortKey, sortDir]);

  const summary = useMemo(() => {
    const total = dashboardRows.length;
    const expiring30 = dashboardRows.filter(
      (r) => !r.expiryUnknown && daysRemainingFromIso(r.expiryDate) <= 30,
    ).length;
    const monthlyValue = dashboardRows.reduce((sum, r) => sum + (r.monthlyRentNet || 0), 0);
    const occupancy = total > 0 ? 100 : 0;
    return { total, expiring30, monthlyRevenue: monthlyValue, occupancy };
  }, [dashboardRows]);

  const projectedRevenue = useMemo<RevenuePoint[]>(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, idx) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + idx, 1);
      const label = monthDate.toLocaleDateString("pl-PL", { month: "short" });
      const revenue = dashboardRows.reduce((sum, row) => {
        const expiry = new Date(row.expiryDate);
        return expiry >= monthDate ? sum + (row.monthlyRentNet || 0) : sum;
      }, 0);
      return {
        month: label.charAt(0).toUpperCase() + label.slice(1),
        revenue,
      };
    });
  }, [dashboardRows]);

  const activityFeed = useMemo<ActivityItem[]>(() => {
    const nextExpiring = [...dashboardRows]
      .filter((row) => !row.expiryUnknown)
      .map((row) => ({ ...row, days: daysRemainingFromIso(row.expiryDate) }))
      .filter((row) => row.days >= 0)
      .sort((a, b) => a.days - b.days)[0];
    return [
      {
        id: 1,
        type: "payment",
        text: `Aktualna wartość umów: ${formatPLN(summary.monthlyRevenue)}/mc`,
        when: "na żywo",
        amount: summary.monthlyRevenue,
      },
      {
        id: 2,
        type: "alert",
        text: nextExpiring
          ? `${nextExpiring.advertiserName} — umowa wygasa za ${nextExpiring.days} dni (${nextExpiring.reference || "brak numeru"})`
          : "Brak umów z bliskim terminem wygaśnięcia.",
        when: "na żywo",
      },
      {
        id: 3,
        type: "renewal",
        text: `Umowy wygasające <30 dni: ${summary.expiring30}`,
        when: "na żywo",
      },
      {
        id: 4,
        type: "ai",
        text: `Hubert monitoruje ${summary.total} aktywnych kontraktów.`,
        when: "na żywo",
      },
    ];
  }, [dashboardRows, summary]);

  const expiringDemo = useMemo(() => {
    if (!demo) return [];
    return demoBillboards
      .filter((b) => {
        const d = daysRemaining(b);
        return d !== null && d <= 60;
      })
      .sort((a, b) => (daysRemaining(a) ?? 0) - (daysRemaining(b) ?? 0))
      .slice(0, 5);
  }, [demo, demoBillboards]);

  const expiring30 = contracts.filter((b) => {
    if (b.expiryUnknown) return false;
    const d = daysRemainingFromIso(b.expiryDate);
    return d <= 30;
  });
  const expiring60 = contracts.filter((b) => {
    if (b.expiryUnknown) return false;
    const d = daysRemainingFromIso(b.expiryDate);
    return d > 30 && d <= 60;
  });

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Empty-state onboarding screen — shown when the user has no data.
  // Demo mode never lands here because demo injects mock data.
  if (ready && contracts.length === 0) {
    return (
      <AppShell title="Witaj w BillboardHub" subtitle="Zacznij od zaimportowania portfela">
        <OnboardingScreen />
      </AppShell>
    );
  }

  if (demo) {
    return (
      <>
        <AppShell
          title="Dashboard"
          subtitle="Stan portfela nośników reklamowych — Podlaskie"
          actions={
            <Button size="sm" className="gap-1.5" onClick={openNewContract}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nowy billboard</span>
            </Button>
          }
        >
          <div className="space-y-4 p-3 md:space-y-6 md:p-6">
            <HubertWelcomePanel />
            <StatsHeader data={summary} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
              <div className="lg:col-span-2">
                <RevenueChart data={projectedRevenue} />
              </div>
              <RecentActivity items={activityFeed} />
            </div>

            <Card>
              <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                <div>
                  <h3 className="text-base font-semibold">Wymagają uwagi</h3>
                  <p className="text-xs text-muted-foreground">Umowy wygasające w ciągu 60 dni</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1">
                  <Link to="/contracts">
                    Wszystkie <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <CardContent className="space-y-2">
                {expiringDemo.map((b) => {
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
        <ContractFormDialog
          open={contractDialogOpen}
          onOpenChange={setContractDialogOpen}
          mode={contractDialogMode}
          demo={demo}
          apiBaseUrl={API_BASE_URL}
          initial={contractDialogInitial}
          onSaved={() => void loadContractsFromApi()}
        />
      </>
    );
  }

  return (
    <>
      <AppShell
        title="Umowy"
        subtitle="Stabilny rdzeń — wszystkie aktywne kontrakty"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={openNewContract}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nowy billboard</span>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/import">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {demo ? "Załaduj demo plik" : "Importuj Excel"}
                </span>
              </Link>
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-10">
          <HubertWelcomePanel liveSummary={summary} portfolioCities={cities} />
          <StatsHeader data={summary} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">
              <RevenueChart data={projectedRevenue} />
            </div>
            <RecentActivity items={activityFeed} />
          </div>
          {/* Alerts */}
          {!demo && loadError && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
            </Card>
          )}
          <section className="grid gap-3 sm:grid-cols-2">
            <AlertCard tone="critical" count={expiring30.length} label="Wygasają w ciągu 30 dni" />
            <AlertCard
              tone="warning"
              count={expiring60.length}
              label="Wygasają w ciągu 31–60 dni"
            />
          </section>

          {/* Filters */}
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  const value = e.target.value;
                  setQ(value);
                  window.sessionStorage.setItem(GLOBAL_SEARCH_KEY, value);
                }}
                placeholder="Szukaj klienta, miasta, lokalizacji…"
                className="h-10 pl-9"
              />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-10 w-full sm:w-48">
                <SelectValue placeholder="Miasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie miasta</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Table — Zen minimal */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">{contracts.length} umów</h2>
              <span className="text-[11px] text-muted-foreground">
                Kliknij nagłówek, aby sortować
              </span>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {contracts.map((b) => {
                const d = b.expiryUnknown ? null : daysRemainingFromIso(b.expiryDate);
                return (
                  <Card key={b.id} className="border-0 shadow-none ring-1 ring-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold leading-tight">{b.advertiserName}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {b.city || "—"} · {b.reference || "Brak numeru umowy"}
                          </div>
                        </div>
                        <StatusBadge status={b.badgeStatus} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="tabular-nums">
                          {b.expiryUnknown ? (
                            <span className="text-muted-foreground">Brak daty wygaśnięcia</span>
                          ) : (
                            <>
                              {format(new Date(b.expiryDate), "dd.MM.yyyy")}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {d != null && d < 0 ? "wygasła" : `${d} dni`}
                              </span>
                            </>
                          )}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatPLN(b.monthlyRentNet || 0)}
                        </span>
                      </div>
                      {(!demo || b.id.startsWith("local-")) && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEditContract(b)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edytuj
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">
                      <SortBtn
                        label="Lokalizacja"
                        active={sortKey === "city"}
                        dir={sortDir}
                        onClick={() => setSort("city")}
                      />
                    </th>
                    <th className="px-4 py-3">
                      <SortBtn
                        label="Klient"
                        active={sortKey === "client"}
                        dir={sortDir}
                        onClick={() => setSort("client")}
                      />
                    </th>
                    <th className="px-4 py-3">
                      <SortBtn
                        label="Wygaśnięcie"
                        active={sortKey === "expiry"}
                        dir={sortDir}
                        onClick={() => setSort("expiry")}
                      />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortBtn
                        label="Cena/mc"
                        active={sortKey === "price"}
                        dir={sortDir}
                        onClick={() => setSort("price")}
                        alignRight
                      />
                    </th>
                    <th className="px-4 py-3 w-32">Status</th>
                    <th className="px-4 py-3 w-28 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((b) => {
                    const d = b.expiryUnknown ? null : daysRemainingFromIso(b.expiryDate);
                    return (
                      <tr
                        key={b.id}
                        className="border-b last:border-0 transition-colors hover:bg-accent/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.city || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.reference || "Brak numeru umowy"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{b.advertiserName}</td>
                        <td className="px-4 py-3">
                          {b.expiryUnknown ? (
                            <div className="text-sm text-muted-foreground">Brak w imporcie</div>
                          ) : (
                            <>
                              <div className="tabular-nums">
                                {format(new Date(b.expiryDate), "dd.MM.yyyy")}
                              </div>
                              <div
                                className={cn(
                                  "text-xs tabular-nums",
                                  d != null && d <= 30
                                    ? "text-destructive font-semibold"
                                    : "text-muted-foreground",
                                )}
                              >
                                {d != null && d < 0 ? "wygasła" : `${d} dni pozostało`}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatPLN(b.monthlyRentNet || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.badgeStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(!demo || b.id.startsWith("local-")) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => openEditContract(b)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Edytuj</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </AppShell>
      <ContractFormDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        mode={contractDialogMode}
        demo={demo}
        apiBaseUrl={API_BASE_URL}
        initial={contractDialogInitial}
        onSaved={() => void loadContractsFromApi()}
      />
    </>
  );
}

function OnboardingScreen() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Witaj w BillboardHub</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
        Twój portfel jest pusty. Zacznij od zaimportowania danych z Excela — AI rozpozna kolumny i
        zmapuje je w 90 sekund.
      </p>

      <div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3">
        <Button asChild size="lg" className="h-12 gap-2 text-base">
          <Link to="/import">
            <FileSpreadsheet className="h-5 w-5" />
            Importuj dane z Excela
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <a
          href={TEMPLATE_HREF}
          download="billboardhub_szablon.csv"
          className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Pobierz szablon CSV
        </a>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Twoje dane są oddzielone od trybu demo — tu zobaczysz wyłącznie to, co sam wgrasz.
      </p>
    </div>
  );
}

function AlertCard({
  tone,
  count,
  label,
}: {
  tone: "critical" | "warning";
  count: number;
  label: string;
}) {
  return (
    <Card
      className={cn(
        "border-0 ring-1",
        tone === "critical"
          ? "ring-destructive/30 bg-destructive/5"
          : "ring-warning/40 bg-warning/5",
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            tone === "critical"
              ? "bg-destructive/15 text-destructive"
              : "bg-warning/20 text-warning-foreground",
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-3xl font-semibold tabular-nums leading-none">{count}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
  alignRight,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  alignRight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "text-foreground",
        alignRight && "ml-auto",
      )}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "h-3 w-3 opacity-50",
          active && "opacity-100",
          active && dir === "desc" && "rotate-180",
        )}
      />
    </button>
  );
}
