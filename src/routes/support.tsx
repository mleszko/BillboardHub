import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coffee, Heart, Check, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Wsparcie · BillboardHub" },
      {
        name: "description",
        content:
          "BillboardHub jest darmowy. Jeśli pomaga Ci w pracy, możesz wesprzeć rozwój — w przyszłości.",
      },
    ],
  }),
  component: SupportPage,
});

const TIERS = [
  {
    amount: 5,
    label: "Espresso",
    desc: "Symboliczne podziękowanie. Każdy złoty się liczy.",
    perks: ["Imię w sekcji 'Supporters'"],
  },
  {
    amount: 10,
    label: "Latte",
    desc: "Pomagasz utrzymać serwery i mapy.",
    perks: ["Imię w 'Supporters'", "Dostęp do beta funkcji"],
  },
  {
    amount: 100,
    label: "Pro Boost",
    desc: "Realnie napędzasz rozwój nowych funkcji.",
    perks: ["Wszystko z Latte", "Priorytetowy support", "Influence na roadmap"],
    featured: true,
  },
  {
    amount: 1000,
    label: "Patron",
    desc: "Jesteś współarchitektem produktu.",
    perks: ["Wszystko z Pro Boost", "Spotkanie z foundermem 1:1", "Logo w stopce"],
  },
];

function SupportPage() {
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
        <div className="mx-auto max-w-2xl text-center">
          <Coffee className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Wesprzyj BillboardHub
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            <strong>Aplikacja jest teraz w pełni darmowa.</strong> Wsparcie jest opcjonalne i służy
            tylko utrzymaniu serwerów oraz tempu rozwoju. Poniższe poziomy są <em>poglądowe</em> —
            uruchomimy je dopiero w wersji 1.0.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/5 px-3 py-1 text-xs font-medium text-info">
            <Heart className="h-3 w-3" /> Roadmap monetyzacji — podgląd
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <Card
              key={tier.amount}
              className={`relative flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                tier.featured ? "border-primary ring-2 ring-primary/30" : ""
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Najpopularniejsze
                </div>
              )}
              <CardContent className="flex flex-1 flex-col p-0">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {tier.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{tier.amount}</span>
                    <span className="text-sm text-muted-foreground">PLN/mc</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{tier.desc}</p>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.featured ? "default" : "outline"}
                  size="sm"
                  className="mt-5 w-full"
                  onClick={() =>
                    toast.message("Płatności jeszcze nieaktywne", {
                      description: "Aplikacja jest darmowa — uruchomimy wsparcie w 1.0.",
                    })
                  }
                >
                  Wkrótce
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-muted-foreground">
          Bez sztuczek: nie wprowadzamy "freemium z blokadami". W 1.0 darmowy plan zostanie
          funkcjonalnie kompletny dla małych portfeli (do ~25 nośników).
        </p>
      </section>
    </div>
  );
}
