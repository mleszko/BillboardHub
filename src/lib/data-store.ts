// Strict separation between demo data and real user data.
//
// - In Demo Mode: billboards() returns the full mock portfolio.
// - Otherwise: billboards() returns ONLY what the logged-in user has imported
//   (persisted to localStorage). Defaults to []. The dashboard treats an empty
//   state as the onboarding moment, not a "broken" empty table.

import { useEffect, useState } from "react";
import { billboards as MOCK_BILLBOARDS, type Billboard } from "./mock-data";
import { isDemoMode } from "./demo";

const IMPORTED_KEY = "bbhub-imported-billboards";
const CHANGE_EVENT = "bbhub:data-changed";

function readImported(): Billboard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IMPORTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Billboard[]) : [];
  } catch {
    return [];
  }
}

function writeImported(rows: Billboard[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IMPORTED_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Snapshot for non-React callers. SSR-safe (returns []). */
export function getBillboards(): Billboard[] {
  if (typeof window === "undefined") return [];
  if (isDemoMode()) return [...MOCK_BILLBOARDS, ...readImported()];
  return readImported();
}

export function appendImported(rows: Billboard[]) {
  const current = readImported();
  writeImported([...current, ...rows]);
}

export function updateImported(id: string, row: Billboard) {
  const current = readImported();
  const idx = current.findIndex((b) => b.id === id);
  if (idx === -1) return;
  const next = [...current];
  next[idx] = row;
  writeImported(next);
}

export function clearImported() {
  writeImported([]);
}

/**
 * React hook — returns billboards reactive to demo toggle + imports.
 * Always starts with [] on the first client render to match the SSR HTML
 * (which has no access to localStorage). After mount, swaps to the real
 * dataset. This avoids hydration mismatches.
 */
export function useBillboards(): { data: Billboard[]; ready: boolean } {
  const [data, setData] = useState<Billboard[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setData(getBillboards());
    sync();
    setReady(true);
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { data, ready };
}
