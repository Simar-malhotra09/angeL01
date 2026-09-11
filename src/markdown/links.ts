export const LINK_RE = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[^)]+)\)/g;

export function isInternalLink(url: string): boolean {
  return url.startsWith("#");
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "section";
}

export class HeadingSlugger {
  private readonly counts = new Map<string, number>();

  slugFor(plainText: string): string {
    const base = slugify(plainText);
    const seen = this.counts.get(base) ?? 0;
    this.counts.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  }
}
