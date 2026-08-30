export type HighlightCardLayout = "floating" | "sticky";

const STORAGE_KEY = "angel01-highlight-card-layout";
const listeners = new Set<() => void>();

let current: HighlightCardLayout =
  localStorage.getItem(STORAGE_KEY) === "sticky" ? "sticky" : "floating";

export function getHighlightCardLayout(): HighlightCardLayout {
  return current;
}

export function toggleHighlightCardLayout(): void {
  current = current === "sticky" ? "floating" : "sticky";
  localStorage.setItem(STORAGE_KEY, current);
  for (const listener of listeners) {
    listener();
  }
}

export function onHighlightCardLayoutChange(listener: () => void): void {
  listeners.add(listener);
}
