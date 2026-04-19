// Demo-mode helpers. The app is currently free and uses pure mock data,
// but a "demo session" flag drives Hubert's personalized welcome and a few
// other contextual moments.

const KEY = "bbhub-demo-mode";
const NAME_KEY = "bbhub-demo-name";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function startDemo(name = "Mateusz") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, "1");
  window.localStorage.setItem(NAME_KEY, name);
}

export function endDemo() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(NAME_KEY);
}

export function demoName(): string {
  if (typeof window === "undefined") return "Mateusz";
  return window.localStorage.getItem(NAME_KEY) || "Mateusz";
}
