import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Banner shown on every "wodotryski" page (Map, Hubert, AI Intake) while
 * the user is in Demo mode. Communicates that these features are upcoming
 * and not part of the stable post-login core.
 */
export function DemoPreviewBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground",
        className,
      )}
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <span className="font-semibold uppercase tracking-wider text-primary">
          Upcoming Features Preview
        </span>
        <span className="ml-1.5 text-muted-foreground">
          Te funkcje są w fazie demo. Po zalogowaniu zobaczysz tylko stabilny rdzeń: tabela umów, importer, alerty.
        </span>
      </div>
    </div>
  );
}
