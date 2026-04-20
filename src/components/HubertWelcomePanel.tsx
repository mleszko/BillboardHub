import { useEffect, useState } from "react";
import { Bot, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "./BetaBadge";
import { demoName, isDemoMode } from "@/lib/demo";
import { stats, formatPLN } from "@/lib/mock-data";
import { useAuth } from "@/contexts/AuthContext";
import { useBackendProfile } from "@/hooks/use-backend-profile";
import { resolveUserFirstName } from "@/lib/user-name";

/**
 * Demo-only welcome banner from Hubert. Sits at the top of the dashboard
 * when the user is in demo mode, occupies ~20% of viewport visually.
 */
export function HubertWelcomePanel() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { user } = useAuth();
  const { profile } = useBackendProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (dismissed) return null;

  const demo = isDemoMode();
  const name = resolveUserFirstName({
    demo,
    demoSessionName: demoName(),
    profileFullName: profile?.full_name,
    userEmail: user?.email,
    userMetadata: user?.user_metadata,
  });
  const s = stats();

  const dismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-primary to-[oklch(0.32_0.1_290)] p-5 text-primary-foreground shadow-md md:p-6">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-success/20 blur-3xl" />
      <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-info/15 blur-2xl" />

      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        aria-label="Zamknij powitanie"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 ring-1 ring-primary-foreground/20 backdrop-blur md:h-16 md:w-16">
          <Bot className="h-7 w-7 md:h-8 md:w-8" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/70">
              Hubert · Twój doradca AI
            </span>
            <BetaBadge className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground" />
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug md:text-xl">
            {name
              ? `${name}, przeanalizowałem Twój portfel w Białymstoku.`
              : "Przeanalizowałem Twój portfel w Białymstoku."}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-primary-foreground/85">
            Twoje{" "}
            <strong className="text-success">ROI jest 15% powyżej średniej regionalnej</strong> —
            jesteś profesjonalistą! Obłożenie {s.occupancy}%, przychód {formatPLN(s.monthlyRevenue)}
            /mc. Mam {s.expiring30} pilne sprawy do omówienia.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("hubert:open"));
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Porozmawiaj z Hubertem
          </Button>
        </div>
      </div>
    </div>
  );
}
