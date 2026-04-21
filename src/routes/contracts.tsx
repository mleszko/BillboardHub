import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ContractFormDialog,
  apiContractToFormValues,
  billboardToFormValues,
  type ContractFormValues,
} from "@/components/ContractFormDialog";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { formatPLN, type Billboard } from "@/lib/mock-data";
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, FileSignature, Send, Eye, Trash2, Plus, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { isDemoMode } from "@/lib/demo";
import { getBillboards, useBillboards } from "@/lib/data-store";
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
  billboard_type?: string | null;
  advertiser_name: string;
  property_owner_name?: string | null;
  city: string | null;
  location_address: string | null;
  surface_size?: string | null;
  start_date: string | null;
  expiry_date: string;
  expiry_unknown?: boolean;
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
  expiryUnknown: boolean;
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

function statusFromBackend(
  contractStatus: string,
  expiryDate: string,
  expiryUnknown?: boolean,
): ContractRow["status"] {
  if (contractStatus === "terminated") return "vacant";
  if (contractStatus === "expired") return "critical";
  if (expiryUnknown) return "active";
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
  canEdit,
  onEditRequest,
}: {
  row: ContractRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit?: boolean;
  onEditRequest?: () => void;
}) {
  if (!row) return null;
  const months = row.expiryUnknown ? 0 : billingMonthsCount(row.contractStart, row.contractEnd);
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
              {row.expiryUnknown ? (
                <span className="text-muted-foreground">
                  Brak daty wygaśnięcia w pliku źródłowym — dodaj kolumnę z datą w imporcie lub
                  uzupełnij ręcznie.
                </span>
              ) : row.contractStart ? (
                <>
                  {format(new Date(row.contractStart), "dd.MM.yyyy")} –{" "}
                  {format(new Date(row.contractEnd), "dd.MM.yyyy")}
                  <span className="text-muted-foreground"> · {formatDurationPl(months)}</span>
                </>
              ) : (
                <>
                  do {format(new Date(row.contractEnd), "dd.MM.yyyy")}
                  <span className="text-muted-foreground"> · {formatDurationPl(months)}</span>
                </>
              )}
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

          {canEdit && onEditRequest ? (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onEditRequest();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edytuj umowę
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContractsPage() {
  const [demo, setDemo] = useState(false);
  const [backendRows, setBackendRows] = useState<ContractRow[]>([]);
  const [backendRawItems, setBackendRawItems] = useState<BackendContract[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [city, setCity] = useState<string>("all");
  const [client, setClient] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [detailRow, setDetailRow] = useState<ContractRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ContractRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractDialogMode, setContractDialogMode] = useState<"create" | "edit">("create");
  const [contractDialogInitial, setContractDialogInitial] = useState<ContractFormValues | null>(
    null,
  );
  const { data: demoBillboardRows } = useBillboards();

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

  const reloadBackendRows = useCallback(async () => {
    if (demo) return;
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
      const items = payload.items ?? [];
      setBackendRawItems(items);
      const monthly = (item: BackendContract) => item.monthly_rent_net || 0;
      const mapped: ContractRow[] = items.map((item) => ({
        id: item.id,
        code:
          item.contract_number || item.billboard_code || `CTR-${item.id.slice(0, 8).toUpperCase()}`,
        client: item.advertiser_name,
        city: item.city || "—",
        address: item.location_address || "—",
        size: item.surface_size?.trim() || "—",
        monthlyPrice: monthly(item),
        status: statusFromBackend(item.contract_status, item.expiry_date, item.expiry_unknown),
        contractStart: item.start_date,
        contractEnd: item.expiry_date,
        expiryUnknown: Boolean(item.expiry_unknown),
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
          item.expiry_unknown,
        ),
      }));
      setBackendRows(mapped);
    } catch (err) {
      setBackendRows([]);
      setBackendRawItems([]);
      setLoadError(err instanceof Error ? err.message : "Błąd ładowania kontraktów.");
    } finally {
      setReady(true);
    }
  }, [demo]);

  useEffect(() => {
    if (demo) {
      setReady(true);
      return;
    }
    void reloadBackendRows();
  }, [demo, reloadBackendRows]);

  const confirmDeleteContract = useCallback(async () => {
    if (!deleteRow || demo) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contracts/${deleteRow.id}`, {
        method: "DELETE",
        headers: await getBackendAuthHeaders(),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Nie udało się usunąć umowy.");
      }
      toast.success("Umowa została usunięta.");
      const removedId = deleteRow.id;
      setDeleteRow(null);
      setDetailRow((r) => (r?.id === removedId ? null : r));
      await reloadBackendRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd usuwania.");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteRow, demo, reloadBackendRows]);

  const confirmDeleteAllContracts = useCallback(async () => {
    if (demo) return;
    setDeleteAllBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contracts`, {
        method: "DELETE",
        headers: await getBackendAuthHeaders(),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Nie udało się usunąć wszystkich billboardów.");
      }
      toast.success("Usunięto wszystkie billboardy.");
      setDeleteAllOpen(false);
      setDetailRow(null);
      setDeleteRow(null);
      await reloadBackendRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd usuwania.");
    } finally {
      setDeleteAllBusy(false);
    }
  }, [demo, reloadBackendRows]);

  const openNewContract = () => {
    setContractDialogMode("create");
    setContractDialogInitial(null);
    setContractDialogOpen(true);
  };

  const rowIsEditable = (row: ContractRow) => !demo || row.id.startsWith("local-");

  const openEditContract = (row: ContractRow) => {
    if (!rowIsEditable(row)) {
      toast.info("W trybie demo edycja dotyczy tylko wpisów dodanych ręcznie (Nowy billboard).");
      return;
    }
    if (demo) {
      const b = getBillboards().find((x) => x.id === row.id);
      if (!b) return;
      setContractDialogMode("edit");
      setContractDialogInitial(billboardToFormValues(b));
      setContractDialogOpen(true);
      setDetailRow(null);
      return;
    }
    const raw = backendRawItems.find((x) => x.id === row.id);
    if (!raw) return;
    setContractDialogMode("edit");
    setContractDialogInitial(apiContractToFormValues(raw));
    setContractDialogOpen(true);
    setDetailRow(null);
  };

  const sourceRows = useMemo<ContractRow[]>(
    () =>
      demo
        ? demoBillboardRows
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
                expiryUnknown: Boolean(b.expiryUnknown),
                lessor: null,
                contactPerson: null,
                contactPhone: null,
                contactEmail: null,
                notes: null,
                totalContractValue: null,
                periodEstimate: estimatedPeriodValue(
                  b.monthlyPrice,
                  start,
                  end,
                  null,
                  Boolean(b.expiryUnknown),
                ),
              };
            })
        : backendRows,
    [demo, backendRows, demoBillboardRows],
  );

  const cityOptions = useMemo(
    () => Array.from(new Set(sourceRows.map((r) => r.city))).sort(),
    [sourceRows],
  );
  const clientOptions = useMemo(
    () => Array.from(new Set(sourceRows.map((r) => r.client))).sort(),
    [sourceRows],
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
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={openNewContract}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nowy billboard</span>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/import">
              <span className="hidden sm:inline">Importuj Excel</span>
              <span className="sm:hidden">Import</span>
            </Link>
          </Button>
          {!demo && (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Usuń wszystkie billboardy</span>
              <span className="sm:hidden">Usuń wszystkie</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 p-3 md:p-6">
        <ContractDetailDialog
          row={detailRow}
          open={detailRow != null}
          onOpenChange={(o) => {
            if (!o) setDetailRow(null);
          }}
          canEdit={detailRow != null && rowIsEditable(detailRow)}
          onEditRequest={detailRow ? () => openEditContract(detailRow) : undefined}
        />

        <ContractFormDialog
          open={contractDialogOpen}
          onOpenChange={setContractDialogOpen}
          mode={contractDialogMode}
          demo={demo}
          apiBaseUrl={API_BASE_URL}
          initial={contractDialogInitial}
          onSaved={() => void reloadBackendRows()}
        />

        <AlertDialog
          open={deleteRow != null}
          onOpenChange={(open) => {
            if (!open && !deleteBusy) setDeleteRow(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usunąć umowę z portfela?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteRow ? (
                  <>
                    <span className="font-medium text-foreground">{deleteRow.code}</span> —{" "}
                    {deleteRow.client}. Tej operacji nie można cofnąć.
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>Anuluj</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={deleteBusy}
                onClick={() => void confirmDeleteContract()}
              >
                {deleteBusy ? "Usuwanie…" : "Usuń"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={deleteAllOpen}
          onOpenChange={(open) => {
            if (!open && !deleteAllBusy) setDeleteAllOpen(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usunąć wszystkie billboardy?</AlertDialogTitle>
              <AlertDialogDescription>
                Ta operacja usunie wszystkie kontrakty z Twojego portfela i nie można jej cofnąć.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAllBusy}>Anuluj</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={deleteAllBusy}
                onClick={() => void confirmDeleteAllContracts()}
              >
                {deleteAllBusy ? "Usuwanie…" : "Usuń wszystko"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
            const d = b.expiryUnknown
              ? null
              : Math.ceil((new Date(b.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const total = 365;
            const progress = d == null ? 0 : Math.max(0, Math.min(100, (d / total) * 100));
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
                      <span className="font-semibold">
                        {b.expiryUnknown
                          ? "brak daty końca"
                          : d != null && d < 0
                            ? "wygasła"
                            : `${d} dni`}
                      </span>
                    </div>
                    {!b.expiryUnknown ? <Progress value={progress} className="h-1.5" /> : null}
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
                    {rowIsEditable(b) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openEditContract(b)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edytuj
                      </Button>
                    )}
                    {!demo && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteRow(b)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Usuń
                      </Button>
                    )}
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
                  const d = b.expiryUnknown
                    ? null
                    : Math.ceil(
                        (new Date(b.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                      );
                  const total = 365;
                  const progress = d == null ? 0 : Math.max(0, Math.min(100, (d / total) * 100));
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{b.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.client}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.expiryUnknown
                            ? "brak daty końca w pliku"
                            : `do ${format(new Date(b.contractEnd), "dd.MM.yyyy")}`}
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
                            {b.expiryUnknown ? "—" : d != null && d < 0 ? "wygasła" : `${d} dni`}
                          </span>
                        </div>
                        {!b.expiryUnknown ? <Progress value={progress} className="h-1.5" /> : null}
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
                          {rowIsEditable(b) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => openEditContract(b)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edytuj
                            </Button>
                          )}
                          {!demo && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteRow(b)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
