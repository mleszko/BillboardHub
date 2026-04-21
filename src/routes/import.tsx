import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/BetaBadge";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Wand2,
  AlertTriangle,
  Download,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { requireSessionForAppRoute } from "@/lib/require-session";
import { getBackendAuthHeaders } from "@/lib/backend-auth";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/import")({
  beforeLoad: () => requireSessionForAppRoute(),
  head: () => ({
    meta: [
      { title: "Smart Excel Importer — BillboardHub" },
      {
        name: "description",
        content:
          "Wgraj plik Excel z umowami billboardowymi — AI sam zmapuje kolumny do pól w systemie.",
      },
    ],
  }),
  component: ImportPage,
});

type Stage = "upload" | "configure" | "analyzing" | "mapping" | "preview" | "done";

const TARGET_FIELDS = [
  "contract_number",
  "advertiser_name",
  "property_owner_name",
  "billboard_code",
  "billboard_type",
  "surface_size",
  "location_address",
  "city",
  "latitude",
  "longitude",
  "start_date",
  "expiry_date",
  "monthly_rent_net",
  "monthly_rent_gross",
  "total_contract_value_net",
  "currency",
  "vat_rate",
  "contact_person",
  "contact_phone",
  "contact_email",
  "notes",
  "ignore",
] as const;

type MappingRow = {
  source_column_name: string;
  target_field_name: string | null;
  guessed_confidence: number;
  transform_hint: string | null;
};

function isLpLikeHeader(header: string): boolean {
  const normalized = header.trim().toLowerCase().replace(/[._-]/g, " ");
  const compact = normalized.replace(/\s+/g, "");
  return normalized === "l p" || compact === "lp";
}

type InspectSheet = {
  name: string;
  row_count: number;
  column_count: number;
};

type ImportTemplate = {
  id: string;
  label: string;
  description: string;
  options: {
    header_row_1based?: number;
    skip_rows_before_header?: number;
    unpivot_month_columns?: boolean;
    monthly_aggregate?: string;
  };
};

type MappingProposalResponse = {
  session_id: string;
  file_name: string;
  owner_user_id: string;
  total_rows: number;
  columns: string[];
  mapping_suggestions: MappingRow[];
  guessed_by_model: string;
  warning: string | null;
  parse_options?: Record<string, unknown> | null;
};

type ImportExecuteResponse = {
  session_id: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_rows: number;
};

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<File | null>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [proposal, setProposal] = useState<MappingProposalResponse | null>(null);
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [result, setResult] = useState<ImportExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [inspectSheets, setInspectSheets] = useState<InspectSheet[]>([]);
  const [inspectFileName, setInspectFileName] = useState("");
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  /** 0 = wykrywanie automatyczne (zalecane). */
  const [headerRow1Based, setHeaderRow1Based] = useState("0");
  const [skipRowsBefore, setSkipRowsBefore] = useState("0");
  const [showAdvancedParse, setShowAdvancedParse] = useState(false);
  const [unpivotMonths, setUnpivotMonths] = useState(false);
  const [monthlyAggregate, setMonthlyAggregate] = useState("mean");
  const [sheetOverrides, setSheetOverrides] = useState<
    Record<string, Record<string, string | null>>
  >({});

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/imports/templates`, {
          headers: await getBackendAuthHeaders(),
        });
        if (r.ok) {
          const data = (await r.json()) as ImportTemplate[];
          setTemplates(data);
        }
      } catch {
        /* optional */
      }
    })();
  }, []);

  const requiredTargetsMissing = useMemo(() => {
    const selected = new Set(mapping.map((item) => item.target_field_name).filter(Boolean));
    const hasParty = selected.has("advertiser_name") || selected.has("property_owner_name");
    return !hasParty;
  }, [mapping]);

  const hasBlockedLpContractMapping = useMemo(
    () =>
      mapping.some(
        (item) =>
          item.target_field_name === "contract_number" && isLpLikeHeader(item.source_column_name),
      ),
    [mapping],
  );

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t?.options) return;
    if (t.options.header_row_1based != null)
      setHeaderRow1Based(String(t.options.header_row_1based));
    if (t.options.skip_rows_before_header != null)
      setSkipRowsBefore(String(t.options.skip_rows_before_header));
    if (t.options.unpivot_month_columns != null) setUnpivotMonths(t.options.unpivot_month_columns);
    if (t.options.monthly_aggregate) setMonthlyAggregate(t.options.monthly_aggregate);
  };

  const inspectFile = async (file: File) => {
    setError(null);
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/imports/inspect`, {
        method: "POST",
        headers: await getBackendAuthHeaders(),
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Nie udało się odczytać struktury pliku.");
      }
      const data = (await response.json()) as { file_name: string; sheets: InspectSheet[] };
      setInspectFileName(data.file_name);
      setInspectSheets(data.sheets);
      const first = data.sheets[0]?.name ?? "";
      setSelectedSheets(first ? [first] : []);
      setStage("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podglądu pliku.");
      fileRef.current = null;
    } finally {
      setIsBusy(false);
    }
  };

  const runGuessMapping = async () => {
    const file = fileRef.current;
    if (!file) return;
    setError(null);
    setResult(null);
    setIsBusy(true);
    setStage("analyzing");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const firstSheet = selectedSheets[0] ?? "";
      formData.append("sheet_name", firstSheet);
      selectedSheets.forEach((sheet) => formData.append("sheet_names", sheet));
      const hdr = parseInt(headerRow1Based, 10);
      formData.append("header_row_1based", String(Number.isFinite(hdr) ? hdr : 0));
      formData.append(
        "skip_rows_before_header",
        String(Math.max(0, parseInt(skipRowsBefore, 10) || 0)),
      );
      formData.append("unpivot_month_columns", unpivotMonths ? "true" : "false");
      formData.append("monthly_aggregate", monthlyAggregate);

      const response = await fetch(`${API_BASE_URL}/imports/guess-mapping`, {
        method: "POST",
        headers: await getBackendAuthHeaders(),
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Nie udało się odczytać i zmapować pliku.");
      }
      const data = (await response.json()) as MappingProposalResponse;
      setProposal(data);
      setMapping(data.mapping_suggestions);
      setStage("mapping");
      if (data.warning) {
        toast.warning(data.warning);
      }
      if (data.parse_options?.unpivot_applied) {
        toast.message("Złączono kolumny miesięczne w jeden wiersz na umowę.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload nie powiódł się.");
      setStage("configure");
    } finally {
      setIsBusy(false);
    }
  };

  const updateMapping = (i: number, value: string) => {
    setMapping((rows) =>
      rows.map((row, idx) =>
        idx === i ? { ...row, target_field_name: value === "ignore" ? null : value } : row,
      ),
    );
  };

  const updateSheetOverride = (sheet: string, sourceColumn: string, value: string) => {
    setSheetOverrides((prev) => ({
      ...prev,
      [sheet]: {
        ...(prev[sheet] ?? {}),
        [sourceColumn]: value === "ignore" ? null : value,
      },
    }));
  };

  const confirmImport = async () => {
    if (!proposal) return;
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/imports/confirm-mapping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getBackendAuthHeaders()),
        },
        body: JSON.stringify({
          session_id: proposal.session_id,
          owner_user_id: user?.id ?? proposal.owner_user_id,
          mapping: mapping.map((item) => ({
            source_column_name: item.source_column_name,
            target_field_name: item.target_field_name,
            confirmed_by_user: true,
            user_override: true,
            transform_hint: item.transform_hint ?? null,
          })),
          sheet_overrides: Object.entries(sheetOverrides).map(([sheet_name, overrides]) => ({
            sheet_name,
            mapping: mapping.map((item) => ({
              source_column_name: item.source_column_name,
              target_field_name: Object.prototype.hasOwnProperty.call(
                overrides,
                item.source_column_name,
              )
                ? overrides[item.source_column_name]
                : item.target_field_name,
              confirmed_by_user: true,
              user_override: Object.prototype.hasOwnProperty.call(
                overrides,
                item.source_column_name,
              ),
              transform_hint: item.transform_hint ?? null,
            })),
          })),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Potwierdzenie mapowania nie powiodło się.");
      }
      const data = (await response.json()) as ImportExecuteResponse;
      setResult(data);
      toast.success(`Zaimportowano ${data.imported_rows} rekordów.`);
      await navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import nie powiódł się.");
    } finally {
      setIsBusy(false);
    }
  };

  const reset = () => {
    fileRef.current = null;
    setStage("upload");
    setProposal(null);
    setMapping([]);
    setResult(null);
    setError(null);
    setIsBusy(false);
    setInspectSheets([]);
    setInspectFileName("");
    setSelectedSheets([]);
    setHeaderRow1Based("1");
    setSkipRowsBefore("0");
    setUnpivotMonths(false);
    setMonthlyAggregate("mean");
    setSheetOverrides({});
  };

  const isCsv = inspectFileName.toLowerCase().endsWith(".csv");

  return (
    <AppShell
      title="Smart Excel Importer"
      subtitle="Wybór arkusza, nagłówka i opcjonalnie złączenie kolumn miesięcznych"
      actions={<BetaBadge showIcon />}
    >
      <div className="mx-auto max-w-4xl space-y-5 p-3 md:p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            {[
              { k: "upload", label: "Plik" },
              { k: "configure", label: "Arkusz" },
              { k: "mapping", label: "Mapowanie" },
              { k: "preview", label: "Podgląd" },
            ].map((step, i) => {
              const order: Stage[] = ["upload", "configure", "mapping", "preview"];
              let idx = order.indexOf(stage as Stage);
              if (stage === "analyzing") idx = 2;
              if (stage === "done") idx = 3;
              const active = i <= idx;
              return (
                <div key={step.k} className="flex min-w-[4.5rem] flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium md:text-sm",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {i < 3 && (
                    <div className={cn("mx-1 h-px flex-1", active ? "bg-primary" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {stage === "upload" && (
          <Card className="border-2 border-dashed transition-colors hover:border-primary hover:bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-success/15 blur-xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-success text-success-foreground">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Wgraj plik Excel z portfelem</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Najpierw wykryjemy arkusze i rozmiar tabeli. <strong>Wiersz nagłówka</strong>{" "}
                  wybierany jest automatycznie; możesz doprecyzować ustawienia zaawansowane lub{" "}
                  <strong>złączyć kolumny miesięczne</strong>.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <Button asChild size="lg" className="gap-2" disabled={isBusy}>
                  <label>
                    <FileSpreadsheet className="h-4 w-4" />{" "}
                    {isBusy ? "Przetwarzanie..." : "Wybierz plik"}
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          fileRef.current = file;
                          void inspectFile(file);
                        }
                      }}
                    />
                  </label>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href="data:text/csv;charset=utf-8,Kod,Miasto,Adres,Klient,Cena_mies_PLN,Data_poczatku,Data_wygasniecia,Typ,Rozmiar%0ABIA-001,Bia%C5%82ystok,al.%20Jana%20Paw%C5%82a%20II%2057,Biedronka,8400,2024-09-01,2026-09-01,LED,12x4%20m"
                    download="billboardhub_szablon.csv"
                  >
                    <Download className="h-4 w-4" /> Pobierz szablon
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "configure" && (
          <Card>
            <CardContent className="space-y-5 p-5 md:p-6">
              <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-3">
                <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Konfiguracja odczytu: {inspectFileName}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Domyślnie system sam wykrywa wiersz z nazwami kolumn. Jeśli arkusz ma nietypową
                    strukturę, rozwiń <strong>Ustawienia zaawansowane</strong>.
                  </p>
                </div>
              </div>

              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Szablon startowy</Label>
                  <Select
                    onValueChange={(id) => {
                      applyTemplate(id);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wczytaj ustawienia z szablonu…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isCsv && inspectSheets.length > 0 && (
                <div className="space-y-2">
                  <Label>Zakładki do importu</Label>
                  <div className="space-y-2 rounded-md border p-3">
                    {inspectSheets.map((s) => {
                      const checked = selectedSheets.includes(s.name);
                      return (
                        <label key={s.name} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedSheets((prev) => {
                                if (event.target.checked) {
                                  return [...prev, s.name];
                                }
                                return prev.filter((name) => name !== s.name);
                              });
                            }}
                          />
                          <span>
                            {s.name} (~{s.row_count}x{s.column_count})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                <Label htmlFor="adv-parse" className="text-sm font-normal">
                  Ustawienia zaawansowane (ręczny wiersz nagłówka / pomijanie wierszy)
                </Label>
                <Switch
                  id="adv-parse"
                  checked={showAdvancedParse}
                  onCheckedChange={setShowAdvancedParse}
                />
              </div>
              {showAdvancedParse && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hdr">Wiersz nagłówka (0 = automatycznie)</Label>
                    <Input
                      id="hdr"
                      type="number"
                      min={0}
                      value={headerRow1Based}
                      onChange={(e) => setHeaderRow1Based(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skip">Pomiń wiersze przed nagłówkiem</Label>
                    <Input
                      id="skip"
                      type="number"
                      min={0}
                      value={skipRowsBefore}
                      onChange={(e) => setSkipRowsBefore(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Złącz szerokie kolumny miesięczne</div>
                  <p className="text-xs text-muted-foreground">
                    Jeśli styczeń–grudzień (itp.) są osobnymi kolumnami kwot, utworzymy jeden wiersz
                    na umowę z czynszem i sumą okresu.
                  </p>
                </div>
                <Switch checked={unpivotMonths} onCheckedChange={setUnpivotMonths} />
              </div>

              {unpivotMonths && (
                <div className="space-y-2">
                  <Label>Sposób wyliczenia czynszu miesięcznego</Label>
                  <Select value={monthlyAggregate} onValueChange={setMonthlyAggregate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mean">Średnia z miesięcy z kwotą</SelectItem>
                      <SelectItem value="last">Ostatni miesiąc z kwotą</SelectItem>
                      <SelectItem value="sum_as_monthly">
                        Suma miesięcy ÷ liczba miesięcy
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={reset}>
                  Anuluj
                </Button>
                <Button className="gap-2" disabled={isBusy} onClick={() => void runGuessMapping()}>
                  Dalej: mapowanie kolumn <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "analyzing" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Wand2 className="h-7 w-7" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Analiza i mapowanie kolumn…</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Odczyt tabeli wg wybranych ustawień, potem heurystyka lub model (jeśli włączony).
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2 text-left text-xs">
                <Step text="Parsowanie pliku" done />
                <Step text="Normalizacja (opcjonalnie miesiące)" done />
                <Step text="Mapowanie kolumn → pola systemu" loading />
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "mapping" && (
          <Card>
            <CardContent className="space-y-5 p-5 md:p-6">
              <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">
                    Wykryto {mapping.length} kolumn w pliku{" "}
                    <span className="font-mono text-xs">{proposal?.file_name}</span> ·{" "}
                    {proposal?.total_rows ?? 0} wierszy
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Sprawdź mapowanie. Przy <code>IMPORT_USE_LLM=false</code> używane są tylko
                    lokalne heurystyki — wtedy zwykle więcej poprawek ręcznych.
                  </div>
                </div>
                <BetaBadge />
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-12 gap-2 bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-4">Kolumna Excel</div>
                  <div className="col-span-3">Conf.</div>
                  <div className="col-span-4">Pole systemu</div>
                  <div className="col-span-1 text-right">%</div>
                </div>
                <div className="divide-y">
                  {mapping.map((c, i) => (
                    <div
                      key={c.source_column_name}
                      className="grid grid-cols-12 items-center gap-2 px-3 py-2.5"
                    >
                      <div className="col-span-4 min-w-0">
                        <div className="truncate text-sm font-medium">{c.source_column_name}</div>
                      </div>
                      <div className="col-span-3 min-w-0 truncate font-mono text-xs text-muted-foreground">
                        {c.transform_hint || "—"}
                      </div>
                      <div className="col-span-4 flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <Select
                          value={c.target_field_name ?? "ignore"}
                          onValueChange={(v) => updateMapping(i, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_FIELDS.map((f) => (
                              <SelectItem key={f} value={f} className="text-xs">
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 text-right">
                        <span
                          className={cn(
                            "text-[11px] font-semibold tabular-nums",
                            c.guessed_confidence >= 0.95
                              ? "text-success"
                              : c.guessed_confidence >= 0.8
                                ? "text-warning-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {Math.round(c.guessed_confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!isCsv && selectedSheets.length > 1 && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-medium">
                    Override mapowania per zakładka (opcjonalne)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Używamy wspólnego mapowania domyślnie. Tu możesz nadpisać pola tylko dla
                    wybranych zakładek.
                  </p>
                  <div className="space-y-3">
                    {selectedSheets.map((sheet) => (
                      <div key={sheet} className="rounded-md border p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {sheet}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {mapping.map((column) => (
                            <div
                              key={`${sheet}:${column.source_column_name}`}
                              className="space-y-1"
                            >
                              <Label className="text-[11px]">{column.source_column_name}</Label>
                              <Select
                                value={
                                  Object.prototype.hasOwnProperty.call(
                                    sheetOverrides[sheet] ?? {},
                                    column.source_column_name,
                                  )
                                    ? (sheetOverrides[sheet]?.[column.source_column_name] ??
                                      "ignore")
                                    : (column.target_field_name ?? "ignore")
                                }
                                onValueChange={(value) =>
                                  updateSheetOverride(sheet, column.source_column_name, value)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TARGET_FIELDS.map((f) => (
                                    <SelectItem key={f} value={f} className="text-xs">
                                      {f}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setStage("configure")}>
                  Wróć do ustawień arkusza
                </Button>
                <Button
                  className="gap-2"
                  disabled={requiredTargetsMissing || hasBlockedLpContractMapping || isBusy}
                  onClick={() => setStage("preview")}
                >
                  Podgląd importu <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {requiredTargetsMissing && (
                <p className="text-xs text-destructive">
                  Wymagane mapowanie: <code>advertiser_name</code> lub{" "}
                  <code>property_owner_name</code> (np. kolumna „wynajmujący”). Data wygaśnięcia —
                  domyślnie koniec roku z nazwy pliku, jeśli brak kolumny z datą.
                </p>
              )}
              {hasBlockedLpContractMapping && (
                <p className="text-xs text-destructive">
                  Kolumna <code>l.p.</code>/<code>lp</code> nie może być mapowana na{" "}
                  <code>contract_number</code>, bo powoduje błędną deduplikację między zakładkami.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {stage === "preview" && (
          <Card>
            <CardContent className="space-y-5 p-5 md:p-6">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Gotowy do importu</div>
                  <div className="text-xs text-muted-foreground">
                    Sesja: <span className="font-mono">{proposal?.session_id}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Kolumna</th>
                      <th className="px-3 py-2">Pole</th>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">Conf.</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mapping.slice(0, 12).map((row) => (
                      <tr key={row.source_column_name}>
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold">
                          {row.source_column_name}
                        </td>
                        <td className="px-3 py-2">{row.target_field_name || "—"}</td>
                        <td className="px-3 py-2">{proposal?.guessed_by_model || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {Math.round(row.guessed_confidence * 100)}%
                        </td>
                        <td className="px-3 py-2">
                          {row.target_field_name ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning-foreground">
                              <AlertTriangle className="h-3 w-3" /> Niezmapowane
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setStage("mapping")}>
                  Wróć do mapowania
                </Button>
                <Button
                  className="gap-2"
                  disabled={isBusy || requiredTargetsMissing || hasBlockedLpContractMapping}
                  onClick={() => void confirmImport()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isBusy ? "Importowanie..." : "Potwierdź mapowanie i import"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "done" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success text-success-foreground">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Import zakończony sukcesem!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Zaimportowano {result?.imported_rows ?? 0} rekordów (z {result?.total_rows ?? 0}).
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="gap-2" onClick={() => navigate({ to: "/app" })}>
                  Otwórz dashboard <ArrowRight className="h-4 w-4" />
                </Button>
                <Button onClick={reset} variant="outline">
                  Zaimportuj kolejny plik
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Step({ text, done, loading }: { text: string; done?: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      ) : loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
      )}
      <span className={cn(done && "text-foreground", !done && !loading && "text-muted-foreground")}>
        {text}
      </span>
    </div>
  );
}
