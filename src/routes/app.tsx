import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
import { useBillboards } from "@/lib/data-store";
import { format } from "date-fns";
import {
  Search,
  ArrowUpDown,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATE_HREF =
  "data:text/csv;charset=utf-8,Kod,Miasto,Adres,Klient,Cena_mies_PLN,Data_poczatku,Data_wygasniecia,Typ,Rozmiar%0ABIA-001,Bia%C5%82ystok,al.%20Jana%20Paw%C5%82a%20II%2057,Biedronka,8400,2024-09-01,2026-09-01,LED,12x4%20m";

export const Route = createFileRoute("/app")({
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

function AppPage() {
  const { data: all, ready } = useBillboards();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const cities = useMemo(
    () => Array.from(new Set(all.map((b) => b.city))).sort(),
    [all],
  );

  const contracts = useMemo(() => {
    const filtered = all
      .filter((b) => b.client && b.contractEnd)
      .filter((b) => (city === "all" ? true : b.city === city))
      .filter((b) => {
        const ql = q.trim().toLowerCase();
        if (!ql) return true;
        return (
          b.client!.toLowerCase().includes(ql) ||
          b.address.toLowerCase().includes(ql) ||
          b.code.toLowerCase().includes(ql) ||
          b.city.toLowerCase().includes(ql)
        );
      });

    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "client":
          return a.client!.localeCompare(b.client!) * dir;
        case "city":
          return a.city.localeCompare(b.city) * dir;
        case "price":
          return (a.monthlyPrice - b.monthlyPrice) * dir;
        case "expiry":
        default:
          return (
            (new Date(a.contractEnd!).getTime() -
              new Date(b.contractEnd!).getTime()) *
            dir
          );
      }
    });
  }, [all, q, city, sortKey, sortDir]);

  const expiring30 = contracts.filter((b) => {
    const d = daysRemaining(b);
    return d !== null && d <= 30;
  });
  const expiring60 = contracts.filter((b) => {
    const d = daysRemaining(b);
    return d !== null && d > 30 && d <= 60;
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
  if (ready && all.length === 0) {
    return (
      <AppShell title="Witaj w BillboardHub" subtitle="Zacznij od zaimportowania portfela">
        <OnboardingScreen />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Umowy"
      subtitle="Stabilny rdzeń — wszystkie aktywne kontrakty"
      actions={
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/import">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Importuj Excel</span>
          </Link>
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-10">
        {/* Alerts */}
        <section className="grid gap-3 sm:grid-cols-2">
          <AlertCard
            tone="critical"
            count={expiring30.length}
            label="Wygasają w ciągu 30 dni"
          />
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
              onChange={(e) => setQ(e.target.value)}
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
            <h2 className="text-sm font-medium text-muted-foreground">
              {contracts.length} umów
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Kliknij nagłówek, aby sortować
            </span>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {contracts.map((b) => {
              const d = daysRemaining(b)!;
              return (
                <Card key={b.id} className="border-0 shadow-none ring-1 ring-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold leading-tight">{b.client}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.city} · {b.address}
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="tabular-nums">
                        {format(new Date(b.contractEnd!), "dd.MM.yyyy")}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {d < 0 ? "wygasła" : `${d} dni`}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatPLN(b.monthlyPrice)}
                      </span>
                    </div>
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
                    <SortBtn label="Lokalizacja" active={sortKey === "city"} dir={sortDir} onClick={() => setSort("city")} />
                  </th>
                  <th className="px-4 py-3">
                    <SortBtn label="Klient" active={sortKey === "client"} dir={sortDir} onClick={() => setSort("client")} />
                  </th>
                  <th className="px-4 py-3">
                    <SortBtn label="Wygaśnięcie" active={sortKey === "expiry"} dir={sortDir} onClick={() => setSort("expiry")} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortBtn label="Cena/mc" active={sortKey === "price"} dir={sortDir} onClick={() => setSort("price")} alignRight />
                  </th>
                  <th className="px-4 py-3 w-32">Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((b) => {
                  const d = daysRemaining(b)!;
                  return (
                    <tr
                      key={b.id}
                      className="border-b last:border-0 transition-colors hover:bg-accent/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.city}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.address}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{b.client}</td>
                      <td className="px-4 py-3">
                        <div className="tabular-nums">
                          {format(new Date(b.contractEnd!), "dd.MM.yyyy")}
                        </div>
                        <div
                          className={cn(
                            "text-xs tabular-nums",
                            d <= 30 ? "text-destructive font-semibold" : "text-muted-foreground",
                          )}
                        >
                          {d < 0 ? "wygasła" : `${d} dni pozostało`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatPLN(b.monthlyPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
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
  );
}

function OnboardingScreen() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Witaj w BillboardHub
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
        Twój portfel jest pusty. Zacznij od zaimportowania danych z Excela —
        AI rozpozna kolumny i zmapuje je w 90 sekund.
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
          <div className="text-3xl font-semibold tabular-nums leading-none">
            {count}
          </div>
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
