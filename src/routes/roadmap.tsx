import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Sparkles,
  Bot,
  FileSpreadsheet,
  Map,
  Bell,
  Users,
  CreditCard,
} from "lucide-react";
import { BetaBadge } from "@/components/BetaBadge";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap · BillboardHub" },
      {
        name: "description",
        content:
          "Co już zbudowaliśmy, nad czym pracujemy i dokąd zmierza BillboardHub. Plus plan monetyzacji.",
      },
    ],
  }),
  component: RoadmapPage,
});

const SHIPPED = [
  { icon: Map, text: "Mapa nośników z kolorami statusu (Leaflet)" },
  { icon: Bell, text: "Dashboard z alertami wygaśnięć" },
  { icon: FileSpreadsheet, text: "Inwentarz, kontrakty, ekstrakcja AI z PDF" },
  { icon: Bot, text: "Hubert — AI doradca w czacie", beta: true },
  { icon: Sparkles, text: "Smart Excel Importer (mapowanie kolumn AI)", beta: true },
];

const NEXT = [
  { text: "Real-time Lovable Cloud sync (multi-user)" },
  { text: "Google Street View 360° w panelu nośnika", beta: true },
  { text: "AI Visibility Audit — gauge 0-100", beta: true },
  { text: "Price-to-Value Judge — automatyczna ocena ceny", beta: true },
  { text: "Generator faktur PDF + integracja Stripe" },
];

const LATER = [
  { text: "Mobile app PWA (offline-first)" },
  { text: "Integracja z systemami POS klientów" },
  { text: "Marketplace nośników między operatorami" },
  { text: "AI prognoza sezonowości popytu" },
];

const MONETIZATION = [
  {
    icon: Sparkles,
    title: "Faza obecna · Beta",
    price: "Darmowe dla wszystkich",
    desc: "Do wersji 1.0 wszystko jest bezpłatne. Zbieramy feedback, polerujemy UX.",
    active: true,
  },
  {
    icon: Users,
    title: "1.0 · Free Plan",
    price: "0 PLN / mc",
    desc: "Do 25 nośników, 1 user, podstawowe funkcje. Bez sztuczek, bez paywall na podstawowe rzeczy.",
  },
  {
    icon: Bot,
    title: "1.0 · Pro Plan",
    price: "~99 PLN / mc",
    desc: "Bez limitów, multi-user, Hubert bez ograniczeń, eksport do PDF/Excel, API.",
  },
  {
    icon: CreditCard,
    title: "1.0 · Enterprise",
    price: "Indywidualnie",
    desc: "Onboarding, SLA, integracje ERP (Comarch, SAP), dedykowany support.",
  },
];

function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Strona główna
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/app">
              <Sparkles className="h-3.5 w-3.5" /> Otwórz aplikację
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Wersja 2 · Beta
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Roadmap & monetyzacja
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Transparentnie pokazujemy, co już działa, nad czym pracujemy i jak będziemy zarabiać —
            tak, żebyś wiedział, czy warto inwestować swój czas w BillboardHub.
          </p>
        </div>

        {/* Shipped */}
        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-success">
            ✓ Już wydane
          </h2>
          <Card className="mt-2">
            <CardContent className="divide-y p-0">
              {SHIPPED.map((item) => (
                <div key={item.text} className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm">{item.text}</span>
                  {item.beta && <BetaBadge />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Next */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            ◐ W trakcie / następne
          </h2>
          <Card className="mt-2">
            <CardContent className="divide-y p-0">
              {NEXT.map((item) => (
                <div key={item.text} className="flex items-center gap-3 px-4 py-3">
                  <Circle className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 text-sm">{item.text}</span>
                  {item.beta && <BetaBadge />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Later */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ○ Wizja długoterminowa
          </h2>
          <Card className="mt-2">
            <CardContent className="divide-y p-0">
              {LATER.map((item) => (
                <div key={item.text} className="flex items-center gap-3 px-4 py-3">
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <span className="flex-1 text-sm text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Monetization */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            Plan monetyzacji
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Beta = darmowo. W 1.0 wprowadzimy uczciwy podział Free / Pro / Enterprise.
            Żadnych ukrytych kosztów, żadnych "trial paywalli".
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {MONETIZATION.map((m) => (
              <Card
                key={m.title}
                className={`p-5 ${m.active ? "border-primary bg-primary/5" : ""}`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        m.active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <m.icon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-semibold">{m.title}</div>
                  </div>
                  <div className="mt-3 text-lg font-semibold tracking-tight">{m.price}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Button asChild className="gap-2">
              <Link to="/support">
                <Sparkles className="h-4 w-4" /> Zobacz tier'y wsparcia
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app">Wróć do aplikacji</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
