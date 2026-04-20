import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { Billboard } from "@/lib/mock-data";
import type { LatLngTuple, Map as LeafletMap, Marker } from "leaflet";

interface BillboardMapProps {
  billboards: Billboard[];
  selectedId?: string;
  onSelect: (b: Billboard) => void;
}

const colorClass: Record<Billboard["status"], string> = {
  active: "bb-marker-active",
  expiring_soon: "bb-marker-soon",
  critical: "bb-marker-critical bb-marker-pulse",
  vacant: "bb-marker-vacant",
};

export function BillboardMap({ billboards, selectedId, onSelect }: BillboardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === "undefined") return;
    let cancelled = false;

    const init = async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([53.4, 23.0], 8);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map);

      L.control.attribution({ prefix: false }).addAttribution("© OSM, CARTO").addTo(map);
      mapRef.current = map;
    };

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Clear existing
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const bounds: LatLngTuple[] = [];

    billboards.forEach((b) => {
      const lat = Number(b.lat);
      const lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const icon = L.divIcon({
        className: "",
        html: `<div class="bb-marker ${colorClass[b.status]}"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .on("click", () => onSelect(b));

      marker.bindTooltip(
        `<div style="font-family:Inter;font-size:12px"><b>${b.code}</b> · ${b.address}</div>`,
        { direction: "top", offset: [0, -22] },
      );

      markersRef.current.set(b.id, marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0 && !selectedId) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [billboards, onSelect, selectedId]);

  // Pan to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const b = billboards.find((x) => x.id === selectedId);
    if (!b) return;
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], 14, { duration: 0.8 });
    }
  }, [selectedId, billboards]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
