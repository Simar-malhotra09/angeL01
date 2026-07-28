import { parseHeading } from "./headings";
import { LINK_RE } from "./links";

export type ImageResolver = (imageId: string) => string | null;

const BOLD_RE = /\*\*([^\n*]+)\*\*/g;
const ITALIC_RE = /(?<!\*)\*([^\n*]+)\*(?!\*)/g;
const IMAGE_RE = /!\[([^\]]*)\]\(image:([a-zA-Z0-9-]+)\)/g;
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

function collectInlineSpans(lineText: string, resolveImage: ImageResolver): InlineSpan[] {
  const candidates: InlineSpan[] = [];
  let match: RegExpExecArray | null;

  IMAGE_RE.lastIndex = 0;
  while ((match = IMAGE_RE.exec(lineText)) !== null) {
    const src = resolveImage(match[2]!);
    if (src !== null) {
      candidates.push({
        from: match.index,
        to: match.index + match[0].length,
        html: `<img src="${escapeHtml(src)}" alt="${escapeHtml(match[1]!)}">`,
      });
    }
  }

  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: `<a href="${escapeHtml(match[2]!)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[1]!)}</a>`,
    });
  }

  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: `<strong>${escapeHtml(match[1]!)}</strong>`,
    });
  }

  ITALIC_RE.lastIndex = 0;
  while ((match = ITALIC_RE.exec(lineText)) !== null) {
    candidates.push({
      from: match.index,
      to: match.index + match[0].length,
      html: `<em>${escapeHtml(match[1]!)}</em>`,
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
    result += `<a href="${escapeHtml(match[0])}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[0])}</a>`;
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

export function renderMarkdownToHtml(doc: string, resolveImage: ImageResolver): string {
  const blocks: string[] = [];

  for (const lineText of doc.split("\n")) {
    const heading = parseHeading(lineText);
    if (heading !== null) {
      blocks.push(`<h${heading.level}>${escapeHtml(heading.text)}</h${heading.level}>`);
      continue;
    }

    if (lineText.trim().length === 0) {
      blocks.push("<p><br></p>");
      continue;
    }

    blocks.push(`<p>${renderLineInline(lineText, resolveImage)}</p>`);
  }

  return blocks.join("\n");
}
