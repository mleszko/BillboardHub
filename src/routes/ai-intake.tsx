import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Sparkles, FileUp, CheckCircle2, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BetaBadge } from "@/components/BetaBadge";
import { requireSessionForAppRoute } from "@/lib/require-session";

export const Route = createFileRoute("/ai-intake")({
  beforeLoad: () => requireSessionForAppRoute(),
  head: () => ({
    meta: [
      { title: "AI Intake — BillboardHub" },
      {
        name: "description",
        content: "Upload PDF contracts and let AI extract structured data automatically.",
      },
    ],
  }),
  component: AIIntakePage,
});

type Stage = "idle" | "uploading" | "processing" | "review" | "done";

function AIIntakePage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  const fakeUpload = () => {
    const f = "Umowa-Allegro-SUW-001-2025.pdf";
    setFileName(f);
    setStage("uploading");
    setProgress(0);

    let p = 0;
    const up = setInterval(() => {
      p += 12;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(up);
        setStage("processing");
        setTimeout(() => setStage("review"), 1800);
      }
    }, 120);
  };

  const reset = () => {
    setStage("idle");
    setProgress(0);
    setFileName("");
  };

  return (
    <AppShell
      title="AI Intake"
      subtitle="Automatyczna ekstrakcja danych z umów PDF"
      actions={<BetaBadge showIcon />}
    >
      <div className="mx-auto max-w-4xl space-y-5 p-3 md:p-6">
        {/* Steps indicator */}
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            {[
              { key: "upload", label: "Upload PDF" },
              { key: "ai", label: "AI extracts data" },
              { key: "review", label: "Review & save" },
            ].map((step, i) => {
              const idx =
                stage === "idle" ? 0 : ["uploading", "processing"].includes(stage) ? 1 : 2;
              const active = i <= idx;
              return (
                <div key={step.key} className="flex flex-1 items-center gap-2">
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
                  {i < 2 && (
                    <div className={cn("mx-2 h-px flex-1", active ? "bg-primary" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {stage === "idle" && (
          <Card
            className="cursor-pointer border-2 border-dashed transition-colors hover:border-primary hover:bg-primary/5"
            onClick={fakeUpload}
          >
            <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Sparkles className="h-7 w-7" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Przeciągnij PDF lub kliknij</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  AI wyciągnie cenę, datę wygaśnięcia, dane klienta i zapisze umowę w systemie.
                  Akceptujemy PDF, DOCX, JPG (skany).
                </p>
              </div>
              <Button size="lg" className="gap-2">
                <FileUp className="h-4 w-4" /> Wybierz plik (demo)
              </Button>
            </CardContent>
          </Card>
        )}

        {stage === "uploading" && (
          <Card>
            <CardContent className="space-y-4 p-8">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{fileName}</div>
                  <div className="text-xs text-muted-foreground">Wysyłanie pliku…</div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "processing" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Przetwarzanie z AI…</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Model językowy analizuje dokument i wyciąga kluczowe pola.
                </p>
              </div>
              <div className="flex flex-col items-start gap-1.5 text-left text-xs">
                <FlowItem text="OCR + parsing tekstu" done />
                <FlowItem text="Identyfikacja stron umowy" done />
                <FlowItem text="Ekstrakcja danych finansowych" loading />
                <FlowItem text="Walidacja względem rejestru" />
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "review" && (
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Wyciągnięto 7 pól · pewność 96%</div>
                  <div className="text-xs text-muted-foreground">Sprawdź i zatwierdź dane.</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Klient" value="Allegro sp. z o.o." />
                <Field label="NIP" value="525-26-74-798" />
                <Field label="Billboard (kod)" value="SUW-001" />
                <Field label="Lokalizacja" value="Suwałki, ul. Kościuszki 71" />
                <Field label="Cena netto / mies." value="3 200,00 PLN" />
                <Field label="Czas trwania" value="12 miesięcy" />
                <Field label="Data rozpoczęcia" value="2025-08-01" />
                <Field label="Data wygaśnięcia" value="2026-07-31" />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={reset}>
                  Anuluj
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => {
                    toast.success("Umowa zapisana w systemie", {
                      description: "SUW-001 — Allegro",
                    });
                    setStage("done");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Zatwierdź i zapisz
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
                <h3 className="text-lg font-semibold">Gotowe!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Umowa została dodana do rejestru.
                </p>
              </div>
              <Button onClick={reset} variant="outline">
                Przetwórz kolejny dokument
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function FlowItem({ text, done, loading }: { text: string; done?: boolean; loading?: boolean }) {
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input defaultValue={value} className="font-medium" />
    </div>
  );
}
