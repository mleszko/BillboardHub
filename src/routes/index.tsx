import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Radio,
  Sparkles,
  ShieldCheck,
  MapPin,
  FileText,
  Bot,
  Heart,
  ArrowRight,
  Check,
  Coffee,
} from "lucide-react";
import { startDemo } from "@/lib/demo";
import { BetaBadge } from "@/components/BetaBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BillboardHub — Excel Killer dla zarządzania billboardami" },
      {
        name: "description",
        content:
          "Profesjonalne narzędzie do śledzenia umów, wygaśnięć i przychodów z billboardów. Zen-podobny interfejs, AI-doradca Hubert, mapa nośników. Wersja demo dostępna od ręki.",
      },
      { property: "og:title", content: "BillboardHub — koniec ze spreadsheetami" },
      {
        property: "og:description",
        content: "Centralny rejestr umów, alerty wygaśnięcia, mapa OOH i AI-doradca. Demo bez logowania.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  const tryDemo = () => {
    startDemo("Mateusz");
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Radio className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">BillboardHub</div>
              <div className="text-[10px] text-muted-foreground">Podlaskie OOH</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/roadmap">Roadmap</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/support">Wsparcie</Link>
            </Button>
            <Button onClick={tryDemo} size="sm" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Try Demo
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-24 top-32 -z-10 h-72 w-72 rounded-full bg-success/10 blur-3xl" />

        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                Wersja 2 · darmowa w okresie beta
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                Excel Killer dla branży{" "}
                <span className="bg-gradient-to-r from-primary to-[oklch(0.5_0.16_280)] bg-clip-text text-transparent">
                  outdoor advertising
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Centralny rejestr umów, alerty wygaśnięcia, mapa nośników i AI-doradca <strong>Hubert</strong>.
                Zen-podobny interfejs, który przejrzysz w 3 minuty — koniec z 47 zakładkami w arkuszu.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button onClick={tryDemo} size="lg" className="gap-2 px-6">
                  <Sparkles className="h-4 w-4" /> Wypróbuj demo Białystok
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="/auth">Login</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/roadmap">Zobacz roadmap</Link>
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> Bez logowania
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> Bez karty
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> 15 nośników w demo
                </span>
              </div>
              <div className="mt-5 rounded-xl border bg-card/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Hubert · AI doradca
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      Mateusz, szybki audyt: Twoje{" "}
                      <span className="font-semibold text-success">ROI jest 15% powyżej średniej regionalnej</span>.
                      Dobra robota — masz potencjał na +8% przychodu po optymalizacji renewal.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock screen preview */}
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-success/10 blur-2xl" />
              <Card className="overflow-hidden p-0 shadow-2xl ring-1 ring-border/60">
                <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                  <span className="ml-3 font-mono text-[10px] text-muted-foreground">
                    billboardhub.app/contracts
                  </span>
                </div>
                <div className="space-y-2.5 p-4">
                  {[
                    { code: "BIA-007", client: "Lidl Polska", days: "5 dni", tone: "critical" },
                    { code: "BIA-002", client: "Orange Polska", days: "12 dni", tone: "critical" },
                    { code: "BIA-003", client: "PKO BP", days: "48 dni", tone: "warning" },
                    { code: "SUW-002", client: "InPost", days: "55 dni", tone: "warning" },
                    { code: "BIA-001", client: "Biedronka", days: "165 dni", tone: "ok" },
                  ].map((row) => (
                    <div
                      key={row.code}
                      className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          row.tone === "critical"
                            ? "bg-destructive animate-pulse"
                            : row.tone === "warning"
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                      />
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {row.code}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">{row.client}</span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          row.tone === "critical"
                            ? "text-destructive"
                            : row.tone === "warning"
                            ? "text-warning-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {row.days}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Wszystko, czego potrzebuje CEO przed billboardem
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Zaprojektowane z obsesją na punkcie czytelności. Mobile-first, bez bałaganu.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={ShieldCheck}
              title="Rejestr umów na pierwszym planie"
              desc="Zen-podobna lista wygaśnięć — najpilniejsze na górze, kolory mówią wszystko."
            />
            <Feature
              icon={MapPin}
              title="Interaktywna mapa nośników"
              desc="Pinezki w kolorze statusu. Kliknij i zobacz zdjęcie kreacji + szczegóły umowy."
            />
            <Feature
              icon={Bot}
              title="Hubert — AI doradca"
              desc="Zapytaj o ROI, ceny rynkowe, strategię renewal. Działa w czacie."
              beta
            />
            <Feature
              icon={Sparkles}
              title="Smart Excel Importer"
              desc="AI mapuje Twoje kolumny: 'Koniec' → 'Expiry', 'Najemca' → 'Klient'. Migracja w 90 sekund."
              beta
            />
            <Feature
              icon={FileText}
              title="Generator przedłużeń"
              desc="Jeden klik = propozycja umowy + link płatności wysłany do klienta."
            />
            <Feature
              icon={Heart}
              title="Mobile-first"
              desc="CEO sprawdza wszystko z telefonu, stojąc przed billboardem."
            />
          </div>
        </div>
      </section>

      {/* Free now */}
      <section className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <Coffee className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
            BillboardHub jest teraz <span className="text-success">w pełni darmowy</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            Jesteśmy w fazie beta. Buduj swój portfel, testuj funkcje, daj nam feedback.
            Modele cenowe pojawią się dopiero po stabilnej wersji 1.0 — i będą uczciwe.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={tryDemo} size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" /> Wypróbuj teraz
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link to="/roadmap">
                Roadmap monetyzacji <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row md:px-6">
          <div>© {new Date().getFullYear()} BillboardHub · Podlaskie OOH</div>
          <div className="flex gap-4">
            <Link to="/roadmap" className="hover:text-foreground">Roadmap</Link>
            <Link to="/support" className="hover:text-foreground">Wsparcie</Link>
            <Link to="/app" className="hover:text-foreground">App</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
  beta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  beta?: boolean;
}) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {beta && <BetaBadge />}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </Card>
  );
}
