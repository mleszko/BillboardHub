import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BetaBadge } from "./BetaBadge";
import { MessageCircle, X, Send, Bot, User as UserIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { demoName, isDemoMode } from "@/lib/demo";
import { stats, formatPLN } from "@/lib/mock-data";
import { getBackendAuthHeaders } from "@/lib/backend-auth";
import { useBackendProfile } from "@/hooks/use-backend-profile";
import { useAuth } from "@/contexts/AuthContext";
import { resolveUserFirstName } from "@/lib/user-name";

interface Msg {
  id: number;
  role: "user" | "hubert";
  text: string;
}

interface ContractsResponse {
  items: Array<{
    id: string;
    contract_number: string | null;
    advertiser_name: string;
    city: string | null;
    expiry_date: string;
    expiry_unknown?: boolean;
    contract_status: string;
    monthly_rent_net: number | null;
  }>;
}

interface LiveSummary {
  total: number;
  expiring30: number;
  monthlyRevenue: number;
  occupancy: number;
  topExpiring: { advertiser: string; ref: string | null; days: number } | null;
}

const API_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

const SCRIPTED: {
  match: RegExp;
  reply: (ctx: ReturnType<typeof stats>, name: string) => string;
}[] = [
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
  if (
    !/(billboard|nośnik|umow|klient|miasto|reklam|outdoor|portfel|bia-|suw-|lom-|aug-)/i.test(input)
  ) {
    return OFFTOPIC_REPLY;
  }
  return `Analizuję dane portfela… Twoja sytuacja wygląda stabilnie: ${ctx.occupancy}% obłożenia, ${formatPLN(ctx.monthlyRevenue)} przychodu/mc. Doprecyzuj pytanie — interesuje Cię ROI, wygasające umowy, ceny czy strategia?`;
}

function hubertReplyFromLive(input: string, summary: LiveSummary): string {
  if (/(wygas|expir|kończ|koniec)/i.test(input)) {
    if (summary.topExpiring) {
      return `Masz ${summary.expiring30} umów wygasających w ciągu 30 dni. Najpilniejsza: ${
        summary.topExpiring.advertiser
      } (${summary.topExpiring.ref || "brak numeru"}) — ${summary.topExpiring.days} dni.`;
    }
    return "W tym momencie nie masz umów wygasających w ciągu 30 dni.";
  }
  if (/(przych|revenue|obrót|cash|cena|price)/i.test(input)) {
    return `Z Twoich aktualnych kontraktów wynika przychód około ${formatPLN(summary.monthlyRevenue)}/mc.`;
  }
  if (/(occupanc|obłoż|zaję)/i.test(input)) {
    return `Aktualne obłożenie portfela to około ${summary.occupancy}%.`;
  }
  if (/(roi|zwrot|zysk)/i.test(input)) {
    return "Na tym etapie mogę oszacować trendy z Twoich kontraktów i wygaśnięć. Jeśli chcesz, policzę prostą estymację ROI dla wybranych lokalizacji.";
  }
  if (
    !/(billboard|nośnik|umow|klient|miasto|reklam|outdoor|portfel|roi|wygas|cena|obłoż)/i.test(
      input,
    )
  ) {
    return OFFTOPIC_REPLY;
  }
  return `Widzę obecnie ${summary.total} kontraktów, ${summary.expiring30} pilnych wygaśnięć i przychód ${formatPLN(summary.monthlyRevenue)}/mc. Doprecyzuj: renewal, ceny czy priorytety na ten tydzień?`;
}

export function HubertWidget() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const demo = isDemoMode();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useBackendProfile();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || demo) return;
    let alive = true;
    const loadContracts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/contracts`, {
          headers: await getBackendAuthHeaders(),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as ContractsResponse;
        if (!alive) return;
        const now = Date.now();
        const items = payload.items ?? [];
        const withDays = items.map((item) => ({
          ...item,
          days: item.expiry_unknown
            ? Number.POSITIVE_INFINITY
            : Math.ceil((new Date(item.expiry_date).getTime() - now) / (1000 * 60 * 60 * 24)),
        }));
        const expiring30 = withDays.filter((i) => !i.expiry_unknown && i.days <= 30).length;
        const topExpiring = withDays
          .filter((i) => !i.expiry_unknown && i.days >= 0)
          .sort((a, b) => a.days - b.days)[0];
        const monthlyRevenue = items.reduce((sum, i) => sum + (i.monthly_rent_net || 0), 0);
        const occupancy = items.length > 0 ? 100 : 0;
        setLiveSummary({
          total: items.length,
          expiring30,
          monthlyRevenue,
          occupancy,
          topExpiring: topExpiring
            ? {
                advertiser: topExpiring.advertiser_name,
                ref: topExpiring.contract_number,
                days: topExpiring.days,
              }
            : null,
        });
      } catch {
        // Keep widget usable even if contracts endpoint is unavailable.
      }
    };
    void loadContracts();
    return () => {
      alive = false;
    };
  }, [demo, mounted]);

  const firstName = resolveUserFirstName({
    demo,
    demoSessionName: demoName(),
    profileFullName: profile?.full_name,
    userEmail: user?.email,
    userMetadata: user?.user_metadata,
  });

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("hubert:open", onOpen);
    return () => window.removeEventListener("hubert:open", onOpen);
  }, []);

  useEffect(() => {
    if (!mounted || (!demo && (authLoading || profileLoading))) return;
    if (messages.length === 0) {
      setMessages([
        {
          id: 1,
          role: "hubert",
          text: demo
            ? firstName
              ? `Cześć ${firstName}! Przeanalizowałem Twój portfel w Białymstoku. Twoje **ROI jest 15% powyżej średniej** — jesteś profesjonalistą! Zapytaj mnie o cokolwiek związanego ze strategią billboardową.`
              : `Cześć! Przeanalizowałem Twój portfel w Białymstoku. Twoje **ROI jest 15% powyżej średniej** — jesteś profesjonalistą! Zapytaj mnie o cokolwiek związanego ze strategią billboardową.`
            : firstName
              ? `Cześć ${firstName}! Jestem Hubert, Twój doradca ds. billboardów. Odpowiadam na podstawie Twoich realnych kontraktów z konta.`
              : `Cześć! Jestem Hubert, Twój doradca ds. billboardów. Odpowiadam na podstawie Twoich realnych kontraktów z konta.`,
        },
      ]);
    }
  }, [authLoading, demo, firstName, mounted, messages.length, profileLoading]);

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
      const answer = demo
        ? hubertReply(text)
        : liveSummary
          ? hubertReplyFromLive(text, liveSummary)
          : "Ładuję Twoje dane kontraktowe. Spróbuj ponownie za kilka sekund.";
      setMessages((m) => [...m, { id: Date.now() + 1, role: "hubert", text: answer }]);
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
                className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    m.role === "user"
                      ? "bg-foreground/10 text-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {m.role === "user" ? (
                    <UserIcon className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
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
