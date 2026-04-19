import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { billboards, cities, clients, daysRemaining, formatPLN } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, FileSignature, Send, FileText, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [
      { title: "Contracts — BillboardHub" },
      { name: "description", content: "Smart contract management with renewals, payments, and invoicing." },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState<string>("all");
  const [client, setClient] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const rows = useMemo(() => {
    return billboards
      .filter((b) => b.client) // contracts only
      .filter((b) => {
        if (city !== "all" && b.city !== city) return false;
        if (client !== "all" && b.client !== client) return false;
        if (status !== "all" && b.status !== status) return false;
        const ql = q.toLowerCase();
        return (
          !ql ||
          b.code.toLowerCase().includes(ql) ||
          b.client?.toLowerCase().includes(ql) ||
          b.address.toLowerCase().includes(ql)
        );
      });
  }, [q, city, client, status]);

  return (
    <AppShell title="Contracts" subtitle={`${rows.length} aktywnych umów`}>
      <div className="space-y-4 p-3 md:p-6">
        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj umowy lub klienta…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-1 lg:justify-end">
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Miasto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie miasta</SelectItem>
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={client} onValueChange={setClient}>
                <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Klient" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy klienci</SelectItem>
                  {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  <SelectItem value="active">Aktywne</SelectItem>
                  <SelectItem value="expiring_soon">Wygasające &lt; 60d</SelectItem>
                  <SelectItem value="critical">Krytyczne</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Mobile cards / Desktop table */}
        <div className="space-y-2 md:hidden">
          {rows.map((b) => {
            const d = daysRemaining(b)!;
            const total = 365;
            const progress = Math.max(0, Math.min(100, (d / total) * 100));
            return (
              <Card key={b.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground">{b.code}</div>
                      <div className="font-semibold leading-tight">{b.client}</div>
                      <div className="truncate text-xs text-muted-foreground">{b.city} · {b.address}</div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Pozostało</span>
                      <span className="font-semibold">{d < 0 ? "wygasła" : `${d} dni`}</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="text-sm font-semibold tabular-nums">{formatPLN(b.monthlyPrice)}/mc</div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8"><FileSignature className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><Send className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><FileText className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Klient</th>
                  <th className="px-4 py-3">Lokalizacja</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-56">Czas pozostały</th>
                  <th className="px-4 py-3 text-right">Wartość/mc</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((b) => {
                  const d = daysRemaining(b)!;
                  const total = 365;
                  const progress = Math.max(0, Math.min(100, (d / total) * 100));
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{b.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.client}</div>
                        <div className="text-xs text-muted-foreground">
                          do {format(new Date(b.contractEnd!), "dd.MM.yyyy")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.city}</div>
                        <div className="text-xs text-muted-foreground">{b.address}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="text-muted-foreground">{b.size}</span>
                          <span className="font-semibold">{d < 0 ? "wygasła" : `${d} dni`}</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPLN(b.monthlyPrice)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5"
                            onClick={() => toast.success(`Wygenerowano propozycję przedłużenia dla ${b.client}`)}>
                            <FileSignature className="h-3.5 w-3.5" /> Renew
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 gap-1.5"
                            onClick={() => toast.success(`Link płatności wysłany do ${b.client}`)}>
                            <Send className="h-3.5 w-3.5" /> Pay
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => toast.message(`Faktura FV/${b.code} otwarta`)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
