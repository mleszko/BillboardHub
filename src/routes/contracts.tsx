import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { billboards, cities, clients, formatPLN, type Billboard } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, FileSignature, Send, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { isDemoMode } from "@/lib/demo";
import { requireSessionForAppRoute } from "@/lib/require-session";
import { getBackendAuthHeaders } from "@/lib/backend-auth";
import {
  billingMonthsCount,
  buildPaymentSchedule,
  estimatedPeriodValue,
  formatDurationPl,
} from "@/lib/contract-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/contracts")({
  beforeLoad: () => requireSessionForAppRoute(),
  head: () => ({
    meta: [
      { title: "Contracts — BillboardHub" },
      {
        name: "description",
        content: "Smart contract management with renewals, payments, and invoicing.",
      },
    ],
  }),
  component: ContractsPage,
});

type BackendContract = {
  id: string;
  contract_number: string | null;
  billboard_code: string | null;
  advertiser_name: string;
  property_owner_name?: string | null;
  city: string | null;
  location_address: string | null;
  surface_size?: string | null;
  start_date: string | null;
  expiry_date: string;
  contract_status: string;
  monthly_rent_net: number | null;
  total_contract_value_net?: number | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
};

type ContractsResponse = {
  items: BackendContract[];
};

type ContractRow = {
  id: string;
  code: string;
  client: string;
  city: string;
  address: string;
  size: string;
  monthlyPrice: number;
  status: "active" | "expiring_soon" | "critical" | "vacant";
  contractStart: string | null;
  contractEnd: string;
  lessor: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  totalContractValue: number | null;
  periodEstimate: number;
};

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";
const GLOBAL_SEARCH_KEY = "bbhub:global-search-value";

function statusFromBackend(contractStatus: string, expiryDate: string): ContractRow["status"] {
  if (contractStatus === "terminated") return "vacant";
  if (contractStatus === "expired") return "critical";
  const d = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (d <= 30) return "critical";
  if (d <= 60) return "expiring_soon";
  return "active";
}

function rowMatchesQuery(row: ContractRow, ql: string): boolean {
  if (!ql) return true;
  const hay = [
    row.code,
    row.client,
    row.city,
    row.address,
    row.size,
    row.lessor,
    row.contactPerson,
    row.contactPhone,
    row.contactEmail,
    row.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(ql);
}

function ContractDetailDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ContractRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!row) return null;
  const months = billingMonthsCount(row.contractStart, row.contractEnd);
  const schedule = buildPaymentSchedule(row.contractStart, row.contractEnd, row.monthlyPrice);
  const scheduleTotal = schedule.reduce((s, m) => s + m.amount, 0);
  const usesStoredTotal = row.totalContractValue != null && row.totalContractValue > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{row.code}</DialogTitle>
          <p className="text-sm text-muted-foreground">{row.client}</p>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-2 gap-y-2">
            <dt className="text-muted-foreground">Lokalizacja</dt>
            <dd>
              {row.city} · {row.address}
            </dd>
            <dt className="text-muted-foreground">Powierzchnia</dt>
            <dd>{row.size}</dd>
            <dt className="text-muted-foreground">Wynajmujący</dt>
            <dd>{row.lessor || "—"}</dd>
            <dt className="text-muted-foreground">Kontakt</dt>
            <dd className="space-y-0.5">
              {row.contactPerson && <div>{row.contactPerson}</div>}
              {row.contactPhone && <div>{row.contactPhone}</div>}
              {row.contactEmail && <div>{row.contactEmail}</div>}
              {!row.contactPerson && !row.contactPhone && !row.contactEmail ? "—" : null}
            </dd>
            <dt className="text-muted-foreground">Okres umowy</dt>
            <dd>
              {row.contractStart
                ? `${format(new Date(row.contractStart), "dd.MM.yyyy")} – ${format(new Date(row.contractEnd), "dd.MM.yyyy")}`
                : `do ${format(new Date(row.contractEnd), "dd.MM.yyyy")}`}
              <span className="text-muted-foreground"> · {formatDurationPl(months)}</span>
            </dd>
            <dt className="text-muted-foreground">Czynsz / mc</dt>
            <dd className="font-semibold tabular-nums">{formatPLN(row.monthlyPrice)}</dd>
            <dt className="text-muted-foreground">Wartość okresu</dt>
            <dd className="font-semibold tabular-nums">
              {formatPLN(row.periodEstimate)}
              {usesStoredTotal ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(z umowy)</span>
              ) : row.contractStart ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (szac. z miesięcy × czynsz)
                </span>
              ) : (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (brak daty startu — uzupełnij w imporcie)
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground">Uwagi</dt>
            <dd className="whitespace-pre-wrap text-muted-foreground">{row.notes || "—"}</dd>
          </dl>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Harmonogram płatności (równy czynsz miesięczny)
            </div>
            {schedule.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Uzupełnij datę rozpoczęcia i czynsz, aby zobaczyć podział na miesiące.
              </p>
            ) : (
              <>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-3 text-xs sm:grid-cols-3">
                    {schedule.map((m) => (
                      <div key={m.key} className="flex flex-col rounded bg-muted/40 px-2 py-1.5">
                        <span className="capitalize text-muted-foreground">{m.label}</span>
                        <span className="font-semibold tabular-nums">{formatPLN(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Suma z siatki: {formatPLN(scheduleTotal)}
                  {usesStoredTotal &&
                  Math.abs(scheduleTotal - (row.totalContractValue ?? 0)) > 1 ? (
                    <span>
                      {" "}
                      — różni się od wartości z umowy ({formatPLN(row.totalContractValue ?? 0)}).
                    </span>
                  ) : null}
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContractsPage() {
  const [demo, setDemo] = useState(false);
  const [backendRows, setBackendRows] = useState<ContractRow[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [city, setCity] = useState<string>("all");
  const [client, setClient] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [detailRow, setDetailRow] = useState<ContractRow | null>(null);

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
        const monthly = (item: BackendContract) => item.monthly_rent_net || 0;
        const mapped: ContractRow[] = (payload.items ?? []).map((item) => ({
          id: item.id,
          code:
            item.contract_number ||
            item.billboard_code ||
            `CTR-${item.id.slice(0, 8).toUpperCase()}`,
          client: item.advertiser_name,
          city: item.city || "—",
          address: item.location_address || "—",
          size: item.surface_size?.trim() || "—",
          monthlyPrice: monthly(item),
          status: statusFromBackend(item.contract_status, item.expiry_date),
          contractStart: item.start_date,
          contractEnd: item.expiry_date,
          lessor: item.property_owner_name?.trim() || null,
          contactPerson: item.contact_person?.trim() || null,
          contactPhone: item.contact_phone?.trim() || null,
          contactEmail: item.contact_email?.trim() || null,
          notes: item.notes?.trim() || null,
          totalContractValue: item.total_contract_value_net ?? null,
          periodEstimate: estimatedPeriodValue(
            monthly(item),
            item.start_date,
            item.expiry_date,
            item.total_contract_value_net,
          ),
        }));
        setBackendRows(mapped);
      } catch (err) {
        if (!alive) return;
        setBackendRows([]);
        setLoadError(err instanceof Error ? err.message : "Błąd ładowania kontraktów.");
      } finally {
        if (alive) setReady(true);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [demo]);

  const sourceRows = useMemo<ContractRow[]>(
    () =>
      demo
        ? billboards
            .filter((b: Billboard) => Boolean(b.client && b.contractEnd))
            .map((b) => {
              const end = b.contractEnd || new Date().toISOString();
              const start = b.contractStart ?? null;
              return {
                id: b.id,
                code: b.code,
                client: b.client || "—",
                city: b.city,
                address: b.address,
                size: b.size,
                monthlyPrice: b.monthlyPrice,
                status: b.status,
                contractStart: start,
                contractEnd: end,
                lessor: null,
                contactPerson: null,
                contactPhone: null,
                contactEmail: null,
                notes: null,
                totalContractValue: null,
                periodEstimate: estimatedPeriodValue(b.monthlyPrice, start, end, null),
              };
            })
        : backendRows,
    [demo, backendRows],
  );

  const cityOptions = useMemo(
    () => (demo ? cities : Array.from(new Set(sourceRows.map((r) => r.city))).sort()),
    [demo, sourceRows],
  );
  const clientOptions = useMemo(
    () => (demo ? clients : Array.from(new Set(sourceRows.map((r) => r.client))).sort()),
    [demo, sourceRows],
  );

  const rows = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return sourceRows.filter((b) => {
      if (city !== "all" && b.city !== city) return false;
      if (client !== "all" && b.client !== client) return false;
      if (status !== "all" && b.status !== status) return false;
      return rowMatchesQuery(b, ql);
    });
  }, [sourceRows, q, city, client, status]);

  const viewTotals = useMemo(() => {
    const sumMonthly = rows.reduce((s, r) => s + r.monthlyPrice, 0);
    const sumPeriod = rows.reduce((s, r) => s + r.periodEstimate, 0);
    return { sumMonthly, sumPeriod, count: rows.length };
  }, [rows]);

  return (
    <AppShell
      title="Contracts"
      subtitle={`${viewTotals.count} w widoku · ${sourceRows.length} łącznie w portfelu`}
    >
      <div className="space-y-4 p-3 md:p-6">
        <ContractDetailDialog
          row={detailRow}
          open={detailRow != null}
          onOpenChange={(o) => {
            if (!o) setDetailRow(null);
          }}
        />

        {!demo && loadError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
          </Card>
        )}
        {!ready && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Ładowanie kontraktów...
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj: kod, klient, miasto, wynajmujący, kontakt, uwagi…"
                className="pl-9"
                value={q}
                onChange={(e) => {
                  const value = e.target.value;
                  setQ(value);
                  window.sessionStorage.setItem(GLOBAL_SEARCH_KEY, value);
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-1 lg:justify-end">
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="Miasto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie miasta</SelectItem>
                  {cityOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={client} onValueChange={setClient}>
                <SelectTrigger className="w-full lg:w-44">
                  <SelectValue placeholder="Klient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy klienci</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full lg:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  <SelectItem value="active">Aktywne</SelectItem>
                  <SelectItem value="expiring_soon">Wygasające &lt; 60d</SelectItem>
                  <SelectItem value="critical">Krytyczne</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <div>
              <span className="text-muted-foreground">Umowy w widoku:</span>{" "}
              <strong>{viewTotals.count}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Suma czynszu mies.:</span>{" "}
              <strong className="tabular-nums">{formatPLN(viewTotals.sumMonthly)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Suma wartości okresu:</span>{" "}
              <strong className="tabular-nums">{formatPLN(viewTotals.sumPeriod)}</strong>
              <span className="ml-1 text-xs text-muted-foreground">
                (z umowy lub miesiące × czynsz)
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2 md:hidden">
          {rows.map((b) => {
            const d = Math.ceil(
              (new Date(b.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            const total = 365;
            const progress = Math.max(0, Math.min(100, (d / total) * 100));
            return (
              <Card key={b.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground">{b.code}</div>
                      <div className="font-semibold leading-tight">{b.client}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.city} · {b.address}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Format: {b.size}</div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Pozostało</span>
                      <span className="font-semibold">{d < 0 ? "wygasła" : `${d} dni`}</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="text-sm font-semibold tabular-nums">
                      {formatPLN(b.monthlyPrice)}/mc
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      okres: {formatPLN(b.periodEstimate)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setDetailRow(b)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Szczegóły
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Klient</th>
                  <th className="px-4 py-3">Lokalizacja</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-48">Termin</th>
                  <th className="px-4 py-3 text-right">/mc</th>
                  <th className="px-4 py-3 text-right">Okres</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((b) => {
                  const d = Math.ceil(
                    (new Date(b.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  const total = 365;
                  const progress = Math.max(0, Math.min(100, (d / total) * 100));
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{b.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.client}</div>
                        <div className="text-xs text-muted-foreground">
                          do {format(new Date(b.contractEnd), "dd.MM.yyyy")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.city}</div>
                        <div className="text-xs text-muted-foreground">{b.address}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{b.size}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            {d < 0 ? "wygasła" : `${d} dni`}
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatPLN(b.monthlyPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                        {formatPLN(b.periodEstimate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => setDetailRow(b)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Szczegóły
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5"
                            disabled
                            title="Wkrótce"
                          >
                            <FileSignature className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5"
                            disabled
                            title="Wkrótce"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
