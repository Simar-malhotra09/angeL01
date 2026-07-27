const STORAGE_KEY = "angel01";

export function loadDraft(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveDraft(text: string): void {
  localStorage.setItem(STORAGE_KEY, text);
}
