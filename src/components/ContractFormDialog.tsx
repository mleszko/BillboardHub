/* eslint-disable react-refresh/only-export-components */
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
const MAX_PHOTO_BYTES = 2_000_000;
const MAX_PHOTO_DIMENSION_PX = 1600;

export type ContractFormValues = {
  id?: string;
  advertiser_name: string;
  contract_number: string;
  billboard_code: string;
  investment_name: string;
  city: string;
  location_address: string;
  gps_coordinates_raw: string;
  latitude: string;
  longitude: string;
  surface_size: string;
  billboard_type: string;
  start_date: string;
  expiry_date: string;
  monthly_rent_net: string;
  notes: string;
  expiry_unknown: boolean;
  photo_url?: string | null;
};

export function emptyContractForm(): ContractFormValues {
  return {
    advertiser_name: "",
    contract_number: "",
    billboard_code: "",
    investment_name: "",
    city: "",
    location_address: "",
    gps_coordinates_raw: "",
    latitude: "",
    longitude: "",
    surface_size: "",
    billboard_type: "led",
    start_date: "",
    expiry_date: "",
    monthly_rent_net: "",
    notes: "",
    expiry_unknown: false,
    photo_url: null,
  };
}

type ApiContract = {
  id: string;
  contract_number: string | null;
  billboard_code: string | null;
  billboard_type: string | null;
  advertiser_name: string;
  investment_name?: string | null;
  city: string | null;
  location_address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_coordinates_raw?: string | null;
  surface_size?: string | null;
  start_date: string | null;
  expiry_date: string;
  expiry_unknown?: boolean;
  monthly_rent_net: number | null;
  notes?: string | null;
  photo_url?: string | null;
};

export function apiContractToFormValues(c: ApiContract): ContractFormValues {
  return {
    id: c.id,
    advertiser_name: c.advertiser_name,
    contract_number: c.contract_number ?? "",
    billboard_code: c.billboard_code ?? "",
    investment_name: c.investment_name ?? "",
    city: c.city ?? "",
    location_address: c.location_address ?? "",
    gps_coordinates_raw: c.gps_coordinates_raw ?? "",
    latitude: c.latitude != null ? String(c.latitude) : "",
    longitude: c.longitude != null ? String(c.longitude) : "",
    surface_size: c.surface_size ?? "",
    billboard_type: (c.billboard_type ?? "other").toLowerCase(),
    start_date: c.start_date ? c.start_date.slice(0, 10) : "",
    expiry_date: c.expiry_unknown ? "" : c.expiry_date.slice(0, 10),
    monthly_rent_net: c.monthly_rent_net != null ? String(c.monthly_rent_net) : "",
    notes: c.notes ?? "",
    expiry_unknown: Boolean(c.expiry_unknown),
    photo_url: c.photo_url ?? null,
  };
}

export function billboardToFormValues(b: Billboard): ContractFormValues {
  return {
    id: b.id,
    advertiser_name: b.client ?? "",
    contract_number: "",
    billboard_code: b.code,
    investment_name: "",
    city: b.city,
    location_address: b.address,
    gps_coordinates_raw: "",
    latitude: Number.isFinite(Number(b.lat)) ? String(b.lat) : "",
    longitude: Number.isFinite(Number(b.lng)) ? String(b.lng) : "",
    surface_size: b.size,
    billboard_type: b.type.toLowerCase().replace(/\s+/g, ""),
    start_date: b.contractStart ? b.contractStart.slice(0, 10) : "",
    expiry_date: b.expiryUnknown ? "" : b.contractEnd ? b.contractEnd.slice(0, 10) : "",
    monthly_rent_net: String(b.monthlyPrice ?? ""),
    notes: "",
    expiry_unknown: Boolean(b.expiryUnknown),
    photo_url: b.creativePhoto ?? null,
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
  const days = Math.ceil((new Date(contractEndIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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
  const parsedLat = Number(form.latitude.replace(",", "."));
  const parsedLng = Number(form.longitude.replace(",", "."));
  return {
    id,
    code: form.billboard_code.trim() || id.replace(/^local-/, "").slice(0, 12),
    city: form.city.trim() || "—",
    address: form.location_address.trim() || "—",
    lat: Number.isFinite(parsedLat) ? parsedLat : 53.1325,
    lng: Number.isFinite(parsedLng) ? parsedLng : 23.1633,
    type,
    size: form.surface_size.trim() || "—",
    monthlyPrice,
    status,
    client: form.advertiser_name.trim(),
    contractStart,
    contractEnd,
    expiryUnknown,
    creativePhoto: form.photo_url || DEFAULT_PHOTO,
    dailyImpressions: 25000,
  };
}

function parseOptionalDecimal(raw: string): number | undefined {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Nie udało się odczytać wymiarów zdjęcia."));
      img.src = objectUrl;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function buildApiCreatePayload(form: ContractFormValues) {
  const monthlyRaw = form.monthly_rent_net.trim().replace(",", ".");
  return {
    advertiser_name: form.advertiser_name.trim(),
    contract_number: form.contract_number.trim() || undefined,
    billboard_code: form.billboard_code.trim() || undefined,
    investment_name: form.investment_name.trim() || undefined,
    city: form.city.trim() || undefined,
    location_address: form.location_address.trim() || undefined,
    gps_coordinates_raw: form.gps_coordinates_raw.trim() || undefined,
    latitude: parseOptionalDecimal(form.latitude),
    longitude: parseOptionalDecimal(form.longitude),
    surface_size: form.surface_size.trim() || undefined,
    billboard_type: form.billboard_type.trim() || undefined,
    start_date: form.start_date.trim() || undefined,
    expiry_unknown: form.expiry_unknown,
    expiry_date: form.expiry_unknown ? undefined : form.expiry_date.trim() || undefined,
    monthly_rent_net: monthlyRaw ? Number(monthlyRaw) : undefined,
    notes: form.notes.trim() || undefined,
  };
}

function buildApiPatchPayload(form: ContractFormValues) {
  const monthlyRaw = form.monthly_rent_net.trim().replace(",", ".");
  return {
    advertiser_name: form.advertiser_name.trim(),
    contract_number: form.contract_number.trim() || null,
    billboard_code: form.billboard_code.trim() || null,
    investment_name: form.investment_name.trim() || null,
    city: form.city.trim() || null,
    location_address: form.location_address.trim() || null,
    gps_coordinates_raw: form.gps_coordinates_raw.trim() || null,
    latitude: parseOptionalDecimal(form.latitude) ?? null,
    longitude: parseOptionalDecimal(form.longitude) ?? null,
    surface_size: form.surface_size.trim() || null,
    billboard_type: form.billboard_type.trim() || null,
    start_date: form.start_date.trim() || null,
    expiry_unknown: form.expiry_unknown,
    expiry_date: form.expiry_unknown ? null : form.expiry_date.trim() || null,
    monthly_rent_net: monthlyRaw ? Number(monthlyRaw) : null,
    notes: form.notes.trim() || null,
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
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedPhotoFile(null);
    setSelectedPhotoPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setRemovePhoto(false);
    if (mode === "edit" && initial) {
      setForm({ ...initial });
    } else {
      setForm(emptyContractForm());
    }
  }, [open, mode, initial]);

  useEffect(() => {
    return () => {
      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
      }
    };
  }, [selectedPhotoPreviewUrl]);

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
      let contractId = form.id ?? "";
      if (removePhoto && !contractId) {
        throw new Error("Nie można usunąć zdjęcia przed utworzeniem umowy.");
      }
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
        const body = (await res.json()) as { id?: string };
        contractId = body.id || "";
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
        const body = (await res.json()) as { id?: string };
        contractId = body.id || form.id;
      }

      if (removePhoto && contractId) {
        const res = await fetch(`${apiBaseUrl}/contracts/${contractId}/photo`, {
          method: "DELETE",
          headers: await getBackendAuthHeaders(),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Nie udało się usunąć zdjęcia.");
        }
      }

      if (selectedPhotoFile && contractId) {
        if (selectedPhotoFile.size > MAX_PHOTO_BYTES) {
          throw new Error(`Zdjęcie przekracza limit ${Math.round(MAX_PHOTO_BYTES / 1_000_000)}MB.`);
        }
        const { width, height } = await readImageDimensions(selectedPhotoFile);
        if (width > MAX_PHOTO_DIMENSION_PX || height > MAX_PHOTO_DIMENSION_PX) {
          throw new Error(`Maksymalny wymiar zdjęcia to ${MAX_PHOTO_DIMENSION_PX}px.`);
        }
        const data = new FormData();
        data.append("photo", selectedPhotoFile);
        data.append("width", String(width));
        data.append("height", String(height));
        const res = await fetch(`${apiBaseUrl}/contracts/${contractId}/photo`, {
          method: "POST",
          headers: await getBackendAuthHeaders(),
          body: data,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Nie udało się wgrać zdjęcia.");
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
          <DialogTitle>{mode === "create" ? "Nowy billboard / umowa" : "Edytuj umowę"}</DialogTitle>
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
            <Label htmlFor="cf-investment">Inwestycja</Label>
            <Input
              id="cf-investment"
              value={form.investment_name}
              onChange={(e) => setForm((f) => ({ ...f, investment_name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-address">Adres / lokalizacja</Label>
            <Input
              id="cf-address"
              value={form.location_address}
              onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-gps-link">Koordynaty GPS (maps.app.goo.gl)</Label>
            <Input
              id="cf-gps-link"
              value={form.gps_coordinates_raw}
              onChange={(e) => setForm((f) => ({ ...f, gps_coordinates_raw: e.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-lat">Szerokość geogr. (lat)</Label>
              <Input
                id="cf-lat"
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="np. 53.1325"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-lng">Długość geogr. (lng)</Label>
              <Input
                id="cf-lng"
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="np. 23.1688"
              />
            </div>
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
            <Label
              htmlFor="cf-unknown"
              className="cursor-pointer font-normal text-muted-foreground"
            >
              Nie znam daty końca umowy
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-notes">Uwagi</Label>
            <textarea
              id="cf-notes"
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Dodatkowe informacje o umowie, lokalizacji lub montażu."
            />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="cf-photo">Zdjęcie nośnika</Label>
            <Input
              id="cf-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedPhotoFile(file);
                setSelectedPhotoPreviewUrl((prev) => {
                  if (prev) {
                    URL.revokeObjectURL(prev);
                  }
                  return file ? URL.createObjectURL(file) : null;
                });
                if (file) setRemovePhoto(false);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Max {Math.round(MAX_PHOTO_BYTES / 1_000_000)}MB, maks. {MAX_PHOTO_DIMENSION_PX}px.
            </p>
            {selectedPhotoPreviewUrl ? (
              <img
                src={selectedPhotoPreviewUrl}
                alt="Podgląd nowego zdjęcia"
                className="max-h-44 rounded-md border object-cover"
              />
            ) : form.photo_url && !removePhoto ? (
              <img
                src={form.photo_url}
                alt="Aktualne zdjęcie nośnika"
                className="max-h-44 rounded-md border object-cover"
              />
            ) : null}
            {form.photo_url ? (
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={removePhoto}
                  onCheckedChange={(c) => {
                    const checked = c === true;
                    setRemovePhoto(checked);
                    if (checked) {
                      setSelectedPhotoFile(null);
                      setSelectedPhotoPreviewUrl(null);
                    }
                  }}
                />
                Usuń obecne zdjęcie po zapisaniu
              </label>
            ) : null}
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
