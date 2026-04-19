import { Billboard, daysRemaining, formatPLN } from "@/lib/mock-data";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Ruler, Eye, Calendar, ExternalLink, FileText, Send } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

interface Props {
  billboard: Billboard | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
              <p className="text-sm text-white/85">
                {billboard.client ?? "Brak klienta"}
              </p>
            </div>
          </div>

          <SheetHeader className="sr-only">
            <SheetTitle>{billboard.code}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={MapPin} label="Lokalizacja" value={`${billboard.city}`} sub={billboard.address} />
              <Stat icon={Ruler} label="Format" value={billboard.size} sub={billboard.type} />
              <Stat icon={Eye} label="Wyświetlenia / dzień" value={billboard.dailyImpressions.toLocaleString("pl-PL")} />
              <Stat icon={Calendar} label="Cena / mies." value={formatPLN(billboard.monthlyPrice)} />
            </div>

            {billboard.contractEnd && (
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
                    {billboard.contractStart && format(new Date(billboard.contractStart), "dd.MM.yyyy")}
                  </span>
                  <span>{format(new Date(billboard.contractEnd), "dd.MM.yyyy")}</span>
                </div>
              </div>
            )}

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
