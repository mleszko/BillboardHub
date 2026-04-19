import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BillboardHub" },
      { name: "description", content: "Manage organization profile, notifications, and integrations." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Konfiguracja organizacji i integracji">
      <div className="mx-auto max-w-3xl space-y-5 p-3 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organizacja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nazwa firmy" defaultValue="Podlaskie Estate Sp. z o.o." />
              <Field label="NIP" defaultValue="542-26-78-901" />
              <Field label="Miasto" defaultValue="Białystok" />
              <Field label="Region" defaultValue="Podlaskie" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Powiadomienia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle label="Alert: umowa wygasa < 30 dni" desc="Powiadomienie e-mail i push" defaultChecked />
            <Separator />
            <Toggle label="Płatność otrzymana" desc="Powiadomienie po zaksięgowaniu wpłaty" defaultChecked />
            <Separator />
            <Toggle label="Tygodniowy raport CEO" desc="Każdy poniedziałek o 8:00" defaultChecked />
            <Separator />
            <Toggle label="Nowa umowa z AI Intake" desc="Powiadom mnie po każdej ekstrakcji" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integracje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Integration name="Stripe" desc="Płatności online za faktury" status="connected" />
            <Integration name="Comarch ERP XL" desc="Synchronizacja faktur i klientów" status="connected" />
            <Integration name="Google Maps" desc="Geokodowanie nowych lokalizacji" status="connected" />
            <Integration name="Slack" desc="Powiadomienia zespołu sprzedaży" status="not_connected" />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button>Zapisz zmiany</Button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input defaultValue={defaultValue} />
    </div>
  );
}

function Toggle({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function Integration({ name, desc, status }: { name: string; desc: string; status: "connected" | "not_connected" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {status === "connected" ? (
        <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.42_0.13_155)]">
          Połączone
        </span>
      ) : (
        <Button size="sm" variant="outline">Połącz</Button>
      )}
    </div>
  );
}
