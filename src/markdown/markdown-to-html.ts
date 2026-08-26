import { parseHeading } from "./headings";
import { LINK_RE } from "./links";

export type ImageResolver = (imageId: string) => string | null;

export interface TocHeading {
  level: 1 | 2 | 3;
  text: string;
  slug: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: TocHeading[];
}

const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /(?<!\*)\*([^\n*]+)\*(?!\*)/g;
const UNDERSCORE_ITALIC_RE = /(?<!\w)_([^\n_]+)_(?!\w)/g;
const IMAGE_RE = /!\[([^\]]*)\]\(image:([a-zA-Z0-9-]+)\)/g;
const BLOCK_IMAGE_RE = /^!\[([^\]]*)\]\(image:([a-zA-Z0-9-]+)\)$/;
const BARE_URL_RE = /https?:\/\/[^\s]+/g;

interface InlineSpan {
  from: number;
  to: number;
  html: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "section";
}

function renderLinkSpan(label: string, url: string): string {
  return (
    `<span class="x-link">` +
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` +
    `<span class="x-link-tooltip">Open ${escapeHtml(url)}</span>` +
    `</span>`
  );
}

function renderImageSpan(label: string, src: string | null): string {
  if (src === null) {
    return `<span class="x-image-label">${escapeHtml(label)}</span>`;
  }
  return (
    `<span class="x-image">` +
    `<span class="x-image-label">${escapeHtml(label)}</span>` +
    `<span class="x-image-preview"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}"></span>` +
    `</span>`
  );
}

function renderBlockImage(label: string, src: string | null): string {
  if (src === null) {
    return `<p class="x-image-block-missing">${escapeHtml(label)}</p>`;
  }
  const caption = label.length > 0 ? `<p class="x-image-caption">${escapeHtml(label)}</p>` : "";
  return `<p class="x-image-block"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}"></p>${caption}`;
}

export function stripInlineMarkdown(text: string): string {
  return text
    .replace(IMAGE_RE, (_match, label: string) => label)
    .replace(LINK_RE, (_match, label: string) => label)
    .replace(BOLD_RE, (_match, inner: string) => inner)
    .replace(ITALIC_RE, (_match, inner: string) => inner)
    .replace(UNDERSCORE_ITALIC_RE, (_match, inner: string) => inner);
}

function collectInlineSpans(lineText: string, resolveImage: ImageResolver): InlineSpan[] {
  const candidates: InlineSpan[] = [];
  let match: RegExpExecArray | null;

  IMAGE_RE.lastIndex = 0;
  while ((match = IMAGE_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: renderImageSpan(match[1]!, resolveImage(match[2]!)),
    });
  }

  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: renderLinkSpan(match[1]!, match[2]!),
    });
  }

  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: `<strong>${renderLineInline(match[1]!, resolveImage)}</strong>`,
    });
  }

  ITALIC_RE.lastIndex = 0;
  while ((match = ITALIC_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: `<em>${renderLineInline(match[1]!, resolveImage)}</em>`,
    });
  }

  UNDERSCORE_ITALIC_RE.lastIndex = 0;
  while ((match = UNDERSCORE_ITALIC_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: `<em>${renderLineInline(match[1]!, resolveImage)}</em>`,
    });
  }

  candidates.sort((a, b) => a.from - b.from || a.to - b.to);

  const spans: InlineSpan[] = [];
  let cursor = 0;
  for (const candidate of candidates) {
    if (candidate.from < cursor) {
      continue;
    }
    spans.push(candidate);
    cursor = candidate.to;
  }
  return spans;
}

function renderPlainText(text: string): string {
  BARE_URL_RE.lastIndex = 0;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = BARE_URL_RE.exec(text)) !== null) {
    result += escapeHtml(text.slice(cursor, match.index));
    result += renderLinkSpan(match[0], match[0]);
    cursor = match.index + match[0].length;
  }
  result += escapeHtml(text.slice(cursor));
  return result;
}

function renderLineInline(lineText: string, resolveImage: ImageResolver): string {
  const spans = collectInlineSpans(lineText, resolveImage);

  let html = "";
  let cursor = 0;
  for (const span of spans) {
    html += renderPlainText(lineText.slice(cursor, span.from));
    html += span.html;
    cursor = span.to;
  }
  html += renderPlainText(lineText.slice(cursor));
  return html;
}

export function renderMarkdownToHtml(doc: string, resolveImage: ImageResolver): RenderedMarkdown {
  const blocks: string[] = [];
  const headings: TocHeading[] = [];
  const slugCounts = new Map<string, number>();

  for (const lineText of doc.split("\n")) {
    const heading = parseHeading(lineText);
    if (heading !== null) {
      const plainText = stripInlineMarkdown(heading.text);
      const baseSlug = slugify(plainText);
      const seen = slugCounts.get(baseSlug) ?? 0;
      slugCounts.set(baseSlug, seen + 1);
      const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen + 1}`;

      headings.push({ level: heading.level, text: plainText, slug });
      blocks.push(
        `<h${heading.level} id="${slug}">${renderLineInline(heading.text, resolveImage)}</h${heading.level}>`,
      );
      continue;
    }

    const blockImage = BLOCK_IMAGE_RE.exec(lineText.trim());
    if (blockImage !== null) {
      blocks.push(renderBlockImage(blockImage[1]!, resolveImage(blockImage[2]!)));
      continue;
    }

    if (lineText.trim().length === 0) {
      blocks.push("<p><br></p>");
      continue;
    }

    blocks.push(`<p>${renderLineInline(lineText, resolveImage)}</p>`);
  }

  return { html: blocks.join("\n"), headings };
}
