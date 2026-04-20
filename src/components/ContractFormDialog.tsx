import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBackendAuthHeaders } from "@/lib/backend-auth";
import { appendImported, updateImported } from "@/lib/data-store";
import type { Billboard, ContractStatus } from "@/lib/mock-data";

const DEFAULT_PHOTO =
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=70";

export type ContractFormValues = {
  id?: string;
  advertiser_name: string;
  contract_number: string;
  billboard_code: string;
  city: string;
  location_address: string;
  surface_size: string;
  billboard_type: string;
  start_date: string;
  expiry_date: string;
  monthly_rent_net: string;
  expiry_unknown: boolean;
};

export function emptyContractForm(): ContractFormValues {
  return {
    advertiser_name: "",
    contract_number: "",
    billboard_code: "",
    city: "",
    location_address: "",
    surface_size: "",
    billboard_type: "led",
    start_date: "",
    expiry_date: "",
    monthly_rent_net: "",
    expiry_unknown: false,
  };
}

type ApiContract = {
  id: string;
  contract_number: string | null;
  billboard_code: string | null;
  billboard_type: string | null;
  advertiser_name: string;
  city: string | null;
  location_address: string | null;
  surface_size?: string | null;
  start_date: string | null;
  expiry_date: string;
  expiry_unknown?: boolean;
  monthly_rent_net: number | null;
};

export function apiContractToFormValues(c: ApiContract): ContractFormValues {
  return {
    id: c.id,
    advertiser_name: c.advertiser_name,
    contract_number: c.contract_number ?? "",
    billboard_code: c.billboard_code ?? "",
    city: c.city ?? "",
    location_address: c.location_address ?? "",
    surface_size: c.surface_size ?? "",
    billboard_type: (c.billboard_type ?? "other").toLowerCase(),
    start_date: c.start_date ? c.start_date.slice(0, 10) : "",
    expiry_date: c.expiry_unknown ? "" : c.expiry_date.slice(0, 10),
    monthly_rent_net: c.monthly_rent_net != null ? String(c.monthly_rent_net) : "",
    expiry_unknown: Boolean(c.expiry_unknown),
  };
}

export function billboardToFormValues(b: Billboard): ContractFormValues {
  return {
    id: b.id,
    advertiser_name: b.client ?? "",
    contract_number: "",
    billboard_code: b.code,
    city: b.city,
    location_address: b.address,
    surface_size: b.size,
    billboard_type: b.type.toLowerCase().replace(/\s+/g, ""),
    start_date: b.contractStart ? b.contractStart.slice(0, 10) : "",
    expiry_date: b.expiryUnknown ? "" : (b.contractEnd ? b.contractEnd.slice(0, 10) : ""),
    monthly_rent_net: String(b.monthlyPrice ?? ""),
    expiry_unknown: Boolean(b.expiryUnknown),
  };
}

function mapFormToBillboardType(raw: string): Billboard["type"] {
  const u = raw.toLowerCase();
  if (u.includes("led")) return "LED";
  if (u.includes("city")) return "Citylight";
  if (u.includes("front")) return "Frontlight";
  return "Backlight";
}

function statusFromForm(expiryUnknown: boolean, contractEndIso: string): ContractStatus {
  if (expiryUnknown) return "active";
  const days = Math.ceil(
    (new Date(contractEndIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "critical";
  if (days <= 30) return "critical";
  if (days <= 60) return "expiring_soon";
  return "active";
}

function formToBillboard(form: ContractFormValues): Billboard {
  const id = form.id ?? `local-${crypto.randomUUID()}`;
  const expiryUnknown = form.expiry_unknown || !form.expiry_date.trim();
  const contractEnd = expiryUnknown
    ? new Date(Date.UTC(2099, 11, 31)).toISOString()
    : new Date(`${form.expiry_date}T12:00:00`).toISOString();
  const contractStart = form.start_date.trim()
    ? new Date(`${form.start_date}T12:00:00`).toISOString()
    : undefined;
  const monthlyPrice = Number(form.monthly_rent_net.replace(",", ".")) || 0;
  const type = mapFormToBillboardType(form.billboard_type);
  const status = statusFromForm(expiryUnknown, contractEnd);
  return {
    id,
    code: form.billboard_code.trim() || id.replace(/^local-/, "").slice(0, 12),
    city: form.city.trim() || "—",
    address: form.location_address.trim() || "—",
    lat: 53.1325,
    lng: 23.1633,
    type,
    size: form.surface_size.trim() || "—",
    monthlyPrice,
    status,
    client: form.advertiser_name.trim(),
    contractStart,
    contractEnd,
    expiryUnknown,
    creativePhoto: DEFAULT_PHOTO,
    dailyImpressions: 25000,
  };
}

function buildApiCreatePayload(form: ContractFormValues) {
  const monthlyRaw = form.monthly_rent_net.trim().replace(",", ".");
  return {
    advertiser_name: form.advertiser_name.trim(),
    contract_number: form.contract_number.trim() || undefined,
    billboard_code: form.billboard_code.trim() || undefined,
    city: form.city.trim() || undefined,
    location_address: form.location_address.trim() || undefined,
    surface_size: form.surface_size.trim() || undefined,
    billboard_type: form.billboard_type.trim() || undefined,
    start_date: form.start_date.trim() || undefined,
    expiry_unknown: form.expiry_unknown,
    expiry_date: form.expiry_unknown ? undefined : form.expiry_date.trim() || undefined,
    monthly_rent_net: monthlyRaw ? Number(monthlyRaw) : undefined,
  };
}

function buildApiPatchPayload(form: ContractFormValues) {
  const monthlyRaw = form.monthly_rent_net.trim().replace(",", ".");
  return {
    advertiser_name: form.advertiser_name.trim(),
    contract_number: form.contract_number.trim() || null,
    billboard_code: form.billboard_code.trim() || null,
    city: form.city.trim() || null,
    location_address: form.location_address.trim() || null,
    surface_size: form.surface_size.trim() || null,
    billboard_type: form.billboard_type.trim() || null,
    start_date: form.start_date.trim() || null,
    expiry_unknown: form.expiry_unknown,
    expiry_date: form.expiry_unknown ? null : form.expiry_date.trim() || null,
    monthly_rent_net: monthlyRaw ? Number(monthlyRaw) : null,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  demo: boolean;
  apiBaseUrl: string;
  initial: ContractFormValues | null;
  onSaved: () => void;
};

export function ContractFormDialog({
  open,
  onOpenChange,
  mode,
  demo,
  apiBaseUrl,
  initial,
  onSaved,
}: Props) {
  const [form, setForm] = useState<ContractFormValues>(emptyContractForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && initial) {
      setForm({ ...initial });
    } else {
      setForm(emptyContractForm());
    }
  }, [open, mode, initial]);

  const submit = async () => {
    if (!form.advertiser_name.trim()) {
      setError("Podaj nazwę klienta (reklamodawcy).");
      return;
    }
    if (!form.expiry_unknown && !form.expiry_date.trim()) {
      setError("Podaj datę wygaśnięcia lub zaznacz „Nie znam daty końca”.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        const row = formToBillboard(form);
        if (mode === "edit" && form.id) {
          updateImported(form.id, row);
        } else {
          appendImported([row]);
        }
        onSaved();
        onOpenChange(false);
        setBusy(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        ...(await getBackendAuthHeaders()),
      };
      if (mode === "create") {
        const res = await fetch(`${apiBaseUrl}/contracts`, {
          method: "POST",
          headers,
          body: JSON.stringify(buildApiCreatePayload(form)),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Nie udało się utworzyć kontraktu.");
        }
      } else if (mode === "edit" && form.id) {
        const patchBody = buildApiPatchPayload(form);
        const res = await fetch(`${apiBaseUrl}/contracts/${form.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(patchBody),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Nie udało się zapisać zmian.");
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nowy billboard / umowa" : "Edytuj umowę"}
          </DialogTitle>
          <DialogDescription>
            Pola podstawowe jak w imporcie Excel. Datę końca możesz pominąć — zapiszemy bezpieczny
            placeholder i oznaczymy umowę jako bez znanej daty wygaśnięcia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="cf-advertiser">Klient (reklamodawca) *</Label>
            <Input
              id="cf-advertiser"
              value={form.advertiser_name}
              onChange={(e) => setForm((f) => ({ ...f, advertiser_name: e.target.value }))}
              placeholder="np. Biedronka"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-code">Kod nośnika</Label>
              <Input
                id="cf-code"
                value={form.billboard_code}
                onChange={(e) => setForm((f) => ({ ...f, billboard_code: e.target.value }))}
                placeholder="np. SUW-014"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-contract-no">Nr umowy</Label>
              <Input
                id="cf-contract-no"
                value={form.contract_number}
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-city">Miasto</Label>
              <Input
                id="cf-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-rent">Cena netto / mies.</Label>
              <Input
                id="cf-rent"
                inputMode="decimal"
                value={form.monthly_rent_net}
                onChange={(e) => setForm((f) => ({ ...f, monthly_rent_net: e.target.value }))}
                placeholder="np. 8400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-address">Adres / lokalizacja</Label>
            <Input
              id="cf-address"
              value={form.location_address}
              onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Typ nośnika</Label>
              <Select
                value={form.billboard_type}
                onValueChange={(v) => setForm((f) => ({ ...f, billboard_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="led">LED</SelectItem>
                  <SelectItem value="backlight">Backlight</SelectItem>
                  <SelectItem value="citylight">Citylight</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                  <SelectItem value="other">Inny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-size">Rozmiar (np. 12×4 m)</Label>
              <Input
                id="cf-size"
                value={form.surface_size}
                onChange={(e) => setForm((f) => ({ ...f, surface_size: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-start">Data startu</Label>
              <Input
                id="cf-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-end">Data wygaśnięcia</Label>
              <Input
                id="cf-end"
                type="date"
                value={form.expiry_date}
                disabled={form.expiry_unknown}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="cf-unknown"
              checked={form.expiry_unknown}
              onCheckedChange={(c) =>
                setForm((f) => ({
                  ...f,
                  expiry_unknown: c === true,
                  expiry_date: c === true ? "" : f.expiry_date,
                }))
              }
            />
            <Label htmlFor="cf-unknown" className="cursor-pointer font-normal text-muted-foreground">
              Nie znam daty końca umowy
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? "Zapisywanie…" : mode === "create" ? "Dodaj" : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
