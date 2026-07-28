const STORAGE_KEY = "angel01";
const TITLE_KEY = "angel01-title";

export function loadDraft(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveDraft(text: string): void {
  localStorage.setItem(STORAGE_KEY, text);
}

export function loadTitle(): string {
  return localStorage.getItem(TITLE_KEY) ?? "";
}

export function saveTitle(title: string): void {
  localStorage.setItem(TITLE_KEY, title);
}
