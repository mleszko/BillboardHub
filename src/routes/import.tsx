import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/BetaBadge";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
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

type Stage = "upload" | "analyzing" | "mapping" | "preview" | "done";

const TARGET_FIELDS = [
  "contract_number",
  "advertiser_name",
  "property_owner_name",
  "billboard_code",
  "billboard_type",
  "location_address",
  "city",
  "latitude",
  "longitude",
  "start_date",
  "expiry_date",
  "monthly_rent_net",
  "monthly_rent_gross",
  "currency",
  "vat_rate",
  "notes",
  "ignore",
] as const;

type MappingRow = {
  source_column_name: string;
  target_field_name: string | null;
  guessed_confidence: number;
  transform_hint: string | null;
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
  const [stage, setStage] = useState<Stage>("upload");
  const [proposal, setProposal] = useState<MappingProposalResponse | null>(null);
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [result, setResult] = useState<ImportExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const requiredTargetsMissing = useMemo(() => {
    const selected = new Set(mapping.map((item) => item.target_field_name).filter(Boolean));
    return !selected.has("advertiser_name") || !selected.has("expiry_date");
  }, [mapping]);

  const uploadFile = async (file: File) => {
    setError(null);
    setResult(null);
    setIsBusy(true);
    setStage("analyzing");
    try {
      const formData = new FormData();
      formData.append("file", file);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload nie powiódł się.");
      setStage("upload");
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
    setStage("upload");
    setProposal(null);
    setMapping([]);
    setResult(null);
    setError(null);
    setIsBusy(false);
  };

  return (
    <AppShell
      title="Smart Excel Importer"
      subtitle="AI zmapuje Twoje kolumny do pól systemowych"
      actions={<BetaBadge showIcon />}
    >
      <div className="mx-auto max-w-4xl space-y-5 p-3 md:p-6">
        {/* Steps */}
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            {[
              { k: "upload", label: "Upload" },
              { k: "mapping", label: "AI Mapping" },
              { k: "preview", label: "Podgląd" },
              { k: "done", label: "Import" },
            ].map((step, i) => {
              const stages: Stage[] = ["upload", "mapping", "preview", "done"];
              const currentIdx = stage === "analyzing" ? 1 : stages.indexOf(stage as Stage);
              const active = i <= currentIdx;
              return (
                <div key={step.k} className="flex flex-1 items-center gap-2">
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
                    <div className={cn("mx-2 h-px flex-1", active ? "bg-primary" : "bg-border")} />
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
                  AI rozpozna Twoje kolumny — np. <strong>"Koniec"</strong> →{" "}
                  <strong>Expiry</strong>, <strong>"Najemca"</strong> → <strong>Klient</strong>.
                  Akceptujemy XLSX, XLS, CSV.
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
                        if (file) void uploadFile(file);
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
                <h3 className="text-lg font-semibold">AI analizuje arkusz…</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Czytam nagłówki, próbki danych i zgaduję mapowanie kolumn.
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2 text-left text-xs">
                <Step text="Parsowanie pliku XLSX" done />
                <Step text="Detekcja nagłówków" done />
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
                    <span className="font-mono text-xs">{proposal?.file_name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Sprawdź mapowanie. Możesz zmienić każde pole ręcznie.
                  </div>
                </div>
                <BetaBadge />
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-12 gap-2 bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-4">Kolumna Excel</div>
                  <div className="col-span-3">Próbka</div>
                  <div className="col-span-4">Pole systemu</div>
                  <div className="col-span-1 text-right">Conf.</div>
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
                      <div className="col-span-3 min-w-0">
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {c.transform_hint || "—"}
                        </div>
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

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={reset}>
                  Anuluj
                </Button>
                <Button
                  className="gap-2"
                  disabled={requiredTargetsMissing || isBusy}
                  onClick={() => setStage("preview")}
                >
                  Podgląd importu <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {requiredTargetsMissing && (
                <p className="text-xs text-destructive">
                  Wymagane mapowanie pól: <code>advertiser_name</code> i <code>expiry_date</code>.
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
                      <th className="px-3 py-2">Kod</th>
                      <th className="px-3 py-2">Miasto</th>
                      <th className="px-3 py-2">Klient</th>
                      <th className="px-3 py-2">Cena/mc</th>
                      <th className="px-3 py-2">Expiry</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mapping.slice(0, 8).map((row) => (
                      <tr key={row.source_column_name}>
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold">
                          {row.source_column_name}
                        </td>
                        <td className="px-3 py-2">{row.target_field_name || "—"}</td>
                        <td className="px-3 py-2">{proposal?.guessed_by_model || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {Math.round(row.guessed_confidence * 100)}%
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.transform_hint || "—"}</td>
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
                  disabled={isBusy || requiredTargetsMissing}
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
