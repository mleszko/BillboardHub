import { Billboard, daysRemaining, formatPLN } from "@/lib/mock-data";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  MapPin,
  Ruler,
  Eye,
  Calendar,
  ExternalLink,
  FileText,
  Send,
  Camera,
  Gauge,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { BetaBadge } from "./BetaBadge";

interface Props {
  billboard: Billboard | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Mocked AI signals — in V2 BETA only
function visibilityScore(b: Billboard): number {
  // Heuristic: impressions + LED bonus
  const base = Math.min(95, 35 + Math.round(b.dailyImpressions / 1000));
  const ledBonus = b.type === "LED" ? 5 : 0;
  return Math.min(98, base + ledBonus);
}

function valueJudgement(b: Billboard): { label: string; tone: "success" | "warning" | "info" } {
  // Compare price/impression to a baseline of 0.18 PLN/imp
  const ratio = b.monthlyPrice / 30 / Math.max(1, b.dailyImpressions);
  if (ratio < 0.13) return { label: "Great Deal", tone: "success" };
  if (ratio < 0.2) return { label: "Fair Price", tone: "info" };
  return { label: "Premium", tone: "warning" };
}

export function BillboardDetailPanel({ billboard, open, onOpenChange }: Props) {
  if (!billboard) return null;
  const days = daysRemaining(billboard);
  const totalDays =
    billboard.contractStart && billboard.contractEnd
      ? Math.max(
          1,
          Math.ceil(
            (new Date(billboard.contractEnd).getTime() -
              new Date(billboard.contractStart).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 365;
  const progress = days !== null ? Math.max(0, Math.min(100, (days / totalDays) * 100)) : 0;

  const visibility = visibilityScore(billboard);
  const judge = valueJudgement(billboard);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          <div className="relative h-44 w-full overflow-hidden bg-muted">
            <img
              src={billboard.creativePhoto}
              alt={billboard.client ?? "Vacant billboard"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <StatusBadge status={billboard.status} className="bg-white/90 backdrop-blur" />
              <h2 className="mt-2 text-lg font-semibold text-white">
                {billboard.code} · {billboard.type}
              </h2>
              <p className="text-sm text-white/85">{billboard.client ?? "Brak klienta"}</p>
            </div>
          </div>

          <SheetHeader className="sr-only">
            <SheetTitle>{billboard.code}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={MapPin}
                label="Lokalizacja"
                value={`${billboard.city}`}
                sub={billboard.address}
              />
              <Stat icon={Ruler} label="Format" value={billboard.size} sub={billboard.type} />
              <Stat
                icon={Eye}
                label="Wyświetlenia / dzień"
                value={billboard.dailyImpressions.toLocaleString("pl-PL")}
              />
              <Stat icon={Calendar} label="Cena / mies." value={formatPLN(billboard.monthlyPrice)} />
            </div>

            {billboard.expiryUnknown ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Brak daty wygaśnięcia w pliku źródłowym — uzupełnij w imporcie lub edycji rekordu.
              </div>
            ) : billboard.contractEnd ? (
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pozostały czas umowy
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {days !== null ? (days < 0 ? "Wygasła" : `${days} dni`) : "—"}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    {billboard.contractStart &&
                      format(new Date(billboard.contractStart), "dd.MM.yyyy")}
                  </span>
                  <span>{format(new Date(billboard.contractEnd), "dd.MM.yyyy")}</span>
                </div>
              </div>
            ) : null}

            {/* AI Visibility Audit — BETA */}
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  AI Visibility Audit
                </span>
                <BetaBadge className="ml-auto" />
              </div>
              <VisibilityGauge value={visibility} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Modelowa estymacja widoczności w oparciu o lokalizację, ruch i typ konstrukcji.
              </p>
            </div>

            {/* Price-to-Value Judge — BETA */}
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Price-to-Value Judge
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Cena vs. zasięg w regionie
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BetaBadge />
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    judge.tone === "success"
                      ? "border-success/40 bg-success/10 text-[oklch(0.42_0.13_155)]"
                      : judge.tone === "warning"
                      ? "border-warning/50 bg-warning/15 text-[oklch(0.42_0.12_70)]"
                      : "border-info/40 bg-info/10 text-info"
                  }`}
                >
                  {judge.label}
                </span>
              </div>
            </div>

            {/* Street View 360° placeholder — BETA */}
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <Camera className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Street View 360°
                </span>
                <BetaBadge className="ml-auto" />
              </div>
              <div
                className="relative flex h-32 items-center justify-center bg-gradient-to-br from-muted via-muted/60 to-muted text-center"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at center, oklch(0.92 0.01 260) 0%, oklch(0.85 0.02 260) 100%)",
                }}
              >
                <div>
                  <Camera className="mx-auto h-7 w-7 text-muted-foreground/70" />
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Podgląd 360° wkrótce
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    Integracja Google Street View
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button className="w-full justify-start gap-2" variant="default">
                <FileText className="h-4 w-4" />
                Otwórz umowę
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <Send className="h-4 w-4" />
                Wyślij propozycję przedłużenia
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function VisibilityGauge({ value }: { value: number }) {
  const color = value >= 80 ? "var(--success)" : value >= 60 ? "var(--info)" : "var(--warning)";
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-xs font-medium text-muted-foreground">/ 100</span>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {value >= 80 ? "Doskonała" : value >= 60 ? "Dobra" : "Średnia"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
