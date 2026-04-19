import { Badge } from "@/components/ui/badge";
import { ContractStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const map: Record<ContractStatus, { label: string; cls: string }> = {
  active: {
    label: "Active",
    cls: "bg-success/15 text-success-foreground border-success/30 [&]:text-[oklch(0.42_0.13_155)]",
  },
  expiring_soon: {
    label: "Expiring < 60d",
    cls: "bg-warning/20 border-warning/40 [&]:text-[oklch(0.42_0.12_70)]",
  },
  critical: {
    label: "Expiring < 30d",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
  vacant: {
    label: "Vacant",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

export function StatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  const s = map[status];
  return (
    <Badge variant="outline" className={cn("font-medium", s.cls, className)}>
      <span
        className={cn(
          "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
          status === "active" && "bg-success",
          status === "expiring_soon" && "bg-warning",
          status === "critical" && "bg-destructive animate-pulse",
          status === "vacant" && "bg-muted-foreground/60",
        )}
      />
      {s.label}
    </Badge>
  );
}
