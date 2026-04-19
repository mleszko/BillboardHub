import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Props {
  className?: string;
  showIcon?: boolean;
  label?: string;
}

/**
 * Subtle "BETA" guardrail badge. Used on AI / experimental features so
 * the user knows the output may be imperfect.
 */
export function BetaBadge({ className, showIcon = false, label = "BETA" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-info leading-none",
        className,
      )}
    >
      {showIcon && <Sparkles className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}
