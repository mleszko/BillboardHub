import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BetaBadge } from "./BetaBadge";
import { MessageCircle, X, Send, Bot, User as UserIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { demoName, isDemoMode } from "@/lib/demo";
import { stats, formatPLN } from "@/lib/mock-data";

interface Msg {
  id: number;
  role: "user" | "hubert";
  text: string;
}

const SCRIPTED: { match: RegExp; reply: (ctx: ReturnType<typeof stats>, name: string) => string }[] = [
  {
    match: /(roi|zwrot|zysk)/i,
    reply: (s) =>
      `Twoje ROI w portfelu Białystok wynosi około **15% powyżej średniej regionalnej**. Najlepiej radzą sobie nośniki LED 12×4m (BIA-001, BIA-004) — generują ${formatPLN(17600)} miesięcznie przy obłożeniu 100%.`,
  },
  {
    match: /(wygas|expir|kończ|koniec)/i,
    reply: (s) =>
      `Masz **${s.expiring30} umów wygasających w ciągu 30 dni**. Najpilniejsza: BIA-007 (Lidl Polska) — 5 dni. Zalecam wysłać propozycję przedłużenia z rabatem 5% jeszcze dziś.`,
  },
  {
    match: /(cena|price|stawka|wycena)/i,
    reply: () =>
      `Średnia stawka w Białymstoku dla LED 12×4m to **8 200 PLN/mc**. Twoja BIA-001 kosztuje 8 400 PLN — jesteś 2.4% powyżej rynku, czyli pozycjonowanie premium. Trzymaj cenę.`,
  },
  {
    match: /(occupanc|obłoż|zaję)/i,
    reply: (s) =>
      `Obłożenie portfela: **${s.occupancy}%**. Wolne nośniki to głównie SUW-003 i BIA-005. Sugeruję obniżyć cenę BIA-005 o 8% — wejdzie na rynek w 14 dni.`,
  },
  {
    match: /(strateg|plan|rozw|dorad)/i,
    reply: () =>
      `Strategia 90 dni: 1) **Obronić** wygasające w 30d (Lidl, Bank Pekao). 2) **Wynająć** 2 wolne nośniki w Suwałkach. 3) **Podnieść** ceny na LED-ach Białystok o 4-6% przy renewal.`,
  },
];

const OFFTOPIC_REPLY =
  "Skupiam się wyłącznie na strategii i danych Twojego portfela billboardów. Spróbuj zapytać o ROI, wygasające umowy, ceny rynkowe lub obłożenie.";

function hubertReply(input: string): string {
  const ctx = stats();
  const name = demoName();
  for (const rule of SCRIPTED) {
    if (rule.match.test(input)) return rule.reply(ctx, name);
  }
  // Heuristic: if message has no billboard-related keyword at all → off-topic
  if (!/(billboard|nośnik|umow|klient|miasto|reklam|outdoor|portfel|bia-|suw-|lom-|aug-)/i.test(input)) {
    return OFFTOPIC_REPLY;
  }
  return `Analizuję dane portfela… Twoja sytuacja wygląda stabilnie: ${ctx.occupancy}% obłożenia, ${formatPLN(ctx.monthlyRevenue)} przychodu/mc. Doprecyzuj pytanie — interesuje Cię ROI, wygasające umowy, ceny czy strategia?`;
}

export function HubertWidget() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("hubert:open", onOpen);
    return () => window.removeEventListener("hubert:open", onOpen);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (messages.length === 0) {
      const name = isDemoMode() ? demoName() : "Witaj";
      setMessages([
        {
          id: 1,
          role: "hubert",
          text: isDemoMode()
            ? `Cześć ${name}! Przeanalizowałem Twój portfel w Białymstoku. Twoje **ROI jest 15% powyżej średniej** — jesteś profesjonalistą! Zapytaj mnie o cokolwiek związanego ze strategią billboardową.`
            : `Cześć! Jestem Hubert, Twój doradca ds. billboardów. Zapytaj mnie o ROI, wygasające umowy lub strategię cenową.`,
        },
      ]);
    }
  }, [mounted, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Msg = { id: Date.now(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: "hubert", text: hubertReply(text) },
      ]);
    }, 600);
  };

  if (!mounted) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/15 transition-transform hover:scale-105"
          aria-label="Otwórz Hubert chat"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 rounded-full bg-info px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-info-foreground">
            BETA
          </span>
        </button>
      )}

      {open && (
        <Card className="fixed bottom-5 right-5 z-40 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden p-0 shadow-2xl sm:w-96 h-[min(560px,calc(100vh-2.5rem))]">
          <div className="flex items-center gap-2 border-b bg-primary px-3 py-2.5 text-primary-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                Hubert
                <BetaBadge className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground" />
              </div>
              <div className="text-[10px] text-primary-foreground/70">Doradca ds. billboardów</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              aria-label="Zamknij"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-start gap-1.5 border-b bg-info/5 px-3 py-1.5 text-[10.5px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-info" />
            <span>Hubert rozmawia tylko o strategii i danych Twoich billboardów.</span>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2",
                  m.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    m.role === "user"
                      ? "bg-foreground/10 text-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {m.role === "user" ? <UserIcon className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground border",
                  )}
                  dangerouslySetInnerHTML={{
                    __html: m.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t bg-card p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Zapytaj o ROI, wygasające umowy…"
              className="h-9 text-sm"
            />
            <Button size="icon" onClick={send} className="h-9 w-9 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
