import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/BetaBadge";
import { useState } from "react";
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
import { appendImported } from "@/lib/data-store";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Billboard } from "@/lib/mock-data";

export const Route = createFileRoute("/import")({
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

const SYSTEM_FIELDS = [
  { value: "code", label: "Kod billboardu" },
  { value: "city", label: "Miasto" },
  { value: "address", label: "Adres" },
  { value: "client", label: "Klient" },
  { value: "monthlyPrice", label: "Cena / mies." },
  { value: "contractStart", label: "Data początku" },
  { value: "contractEnd", label: "Data wygaśnięcia (Expiry)" },
  { value: "type", label: "Typ nośnika" },
  { value: "size", label: "Rozmiar" },
  { value: "ignore", label: "— Ignoruj kolumnę —" },
];

interface Column {
  excel: string;
  sample: string;
  guess: string;
  confidence: number;
}

const MOCK_COLUMNS: Column[] = [
  { excel: "Nr", sample: "BIA-014", guess: "code", confidence: 99 },
  { excel: "Miejsce", sample: "Białystok", guess: "city", confidence: 97 },
  { excel: "Adres / lokalizacja", sample: "ul. Lipowa 32", guess: "address", confidence: 95 },
  { excel: "Najemca", sample: "Orange Polska", guess: "client", confidence: 94 },
  { excel: "Stawka mies. PLN", sample: "4 200", guess: "monthlyPrice", confidence: 96 },
  { excel: "Start", sample: "01.03.2024", guess: "contractStart", confidence: 92 },
  { excel: "Koniec", sample: "28.02.2026", guess: "contractEnd", confidence: 98 },
  { excel: "Typ konstrukcji", sample: "Backlight", guess: "type", confidence: 90 },
  { excel: "Wymiary", sample: "6x3 m", guess: "size", confidence: 88 },
  { excel: "Notatki", sample: "—", guess: "ignore", confidence: 70 },
];

function ImportPage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);

  const startImport = () => {
    setFileName("portfolio_billboardow_2025.xlsx");
    setStage("analyzing");
    setTimeout(() => {
      setColumns(MOCK_COLUMNS);
      setStage("mapping");
    }, 1900);
  };

  const updateMapping = (i: number, value: string) => {
    setColumns((cs) => cs.map((c, idx) => (idx === i ? { ...c, guess: value } : c)));
  };

  const reset = () => {
    setStage("upload");
    setFileName("");
    setColumns([]);
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
              const currentIdx =
                stage === "analyzing" ? 1 : stages.indexOf(stage as Stage);
              const active = i <= currentIdx;
              return (
                <div key={step.k} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
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
          <Card
            className="cursor-pointer border-2 border-dashed transition-colors hover:border-primary hover:bg-primary/5"
            onClick={startImport}
          >
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
                  AI rozpozna Twoje kolumny — np. <strong>"Koniec"</strong> → <strong>Expiry</strong>,{" "}
                  <strong>"Najemca"</strong> → <strong>Klient</strong>. Akceptujemy XLSX, XLS, CSV.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <Button size="lg" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Wybierz plik (demo)
                </Button>
                <Button size="lg" variant="outline" className="gap-2" asChild onClick={(e) => e.stopPropagation()}>
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
                    Wykryto {columns.length} kolumn w pliku{" "}
                    <span className="font-mono text-xs">{fileName}</span>
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
                  {columns.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 items-center gap-2 px-3 py-2.5">
                      <div className="col-span-4 min-w-0">
                        <div className="truncate text-sm font-medium">{c.excel}</div>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {c.sample}
                        </div>
                      </div>
                      <div className="col-span-4 flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <Select
                          value={c.guess}
                          onValueChange={(v) => updateMapping(i, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value} className="text-xs">
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 text-right">
                        <span
                          className={cn(
                            "text-[11px] font-semibold tabular-nums",
                            c.confidence >= 95
                              ? "text-success"
                              : c.confidence >= 80
                              ? "text-warning-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.confidence}%
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
                <Button className="gap-2" onClick={() => setStage("preview")}>
                  Podgląd 47 wierszy <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
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
                    47 wierszy poprawnych · 2 wiersze wymagają uwagi
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
                    {[
                      ["BIA-014", "Białystok", "Rossmann", "5 200", "12.04.2026", "ok"],
                      ["BIA-015", "Białystok", "DM Drogerie", "4 800", "30.06.2026", "ok"],
                      ["SUW-004", "Suwałki", "Tesco", "—", "31.12.2025", "warn"],
                      ["LOM-003", "Łomża", "Lewiatan", "3 100", "15.09.2026", "ok"],
                    ].map(([code, city, client, price, end, status], i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold">{code}</td>
                        <td className="px-3 py-2">{city}</td>
                        <td className="px-3 py-2">{client}</td>
                        <td className="px-3 py-2 tabular-nums">{price}</td>
                        <td className="px-3 py-2 tabular-nums">{end}</td>
                        <td className="px-3 py-2">
                          {status === "warn" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning-foreground">
                              <AlertTriangle className="h-3 w-3" /> Brak ceny
                            </span>
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
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
                  onClick={() => {
                    appendImported(buildImportedRows());
                    toast.success("Zaimportowano 47 nośników do portfela");
                    setStage("done");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Importuj 47 wierszy
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
                  47 nowych nośników jest już w Twoim rejestrze.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="gap-2">
                  <Link to="/app">
                    Otwórz dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button onClick={reset} variant="outline">
                  Zaimportuj kolejny plik
                </Button>
              </div>
            </CardContent>
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

