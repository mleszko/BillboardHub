import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recentActivity, formatPLN } from "@/lib/mock-data";
import { CheckCircle2, FileSignature, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  payment: { icon: CheckCircle2, cls: "bg-success/15 text-success" },
  renewal: { icon: FileSignature, cls: "bg-info/15 text-info" },
  alert: { icon: AlertTriangle, cls: "bg-destructive/15 text-destructive" },
  ai: { icon: Sparkles, cls: "bg-primary/10 text-primary" },
} as const;

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Aktywność</CardTitle>
        <p className="text-xs text-muted-foreground">Ostatnie zdarzenia w systemie</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentActivity.map((a) => {
          const v = iconMap[a.type as keyof typeof iconMap];
          return (
            <div key={a.id} className="flex items-start gap-3">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", v.cls)}>
                <v.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight">{a.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{a.when}</p>
              </div>
              {a.amount && (
                <div className="shrink-0 text-sm font-semibold tabular-nums text-success">
                  +{formatPLN(a.amount)}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
