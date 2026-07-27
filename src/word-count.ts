export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length ? trimmed.split(/\s+/).length : 0;
}

export function formatWordCount(count: number): string {
  return `${count} word${count === 1 ? "" : "s"}`;
}
