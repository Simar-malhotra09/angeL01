import { parseHeading } from "./headings";
import { LINK_RE, HeadingSlugger, isInternalLink, slugify } from "./links";

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
const RUBY_RE = /\{([^{}|\n]+)\|([^{}|\n]*)\}/g;

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

function renderLinkSpan(label: string, url: string): string {
  if (isInternalLink(url)) {
    return (
      `<span class="x-link">` +
      `<a href="#${escapeHtml(slugify(url.slice(1)))}">${escapeHtml(label)}</a>` +
      `<span class="x-link-tooltip">Go to ${escapeHtml(url)}</span>` +
      `</span>`
    );
  }
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

function renderRubySpan(base: string, romaji: string): string {
  if (romaji.trim().length === 0) {
    return escapeHtml(base);
  }
  return `<ruby>${escapeHtml(base)}<rt>${escapeHtml(romaji)}</rt></ruby>`;
}

export function stripInlineMarkdown(text: string): string {
  return text
    .replace(IMAGE_RE, (_match, label: string) => label)
    .replace(LINK_RE, (_match, label: string) => label)
    .replace(BOLD_RE, (_match, inner: string) => inner)
    .replace(ITALIC_RE, (_match, inner: string) => inner)
    .replace(UNDERSCORE_ITALIC_RE, (_match, inner: string) => inner)
    .replace(RUBY_RE, (_match, base: string) => base);
}

function collectInlineSpans(lineText: string, resolveImage: ImageResolver): InlineSpan[] {
  const candidates: InlineSpan[] = [];

  // Matches are materialised before any rendering: rendering recurses into
  // this function, which resets the shared regex state, so calling render*
  // inside an exec() while-loop makes the outer loop re-match the same span
  // forever.
  const collect = (re: RegExp, render: (match: RegExpMatchArray) => string): void => {
    re.lastIndex = 0;
    for (const match of lineText.matchAll(re)) {
      candidates.push({
        from: match.index,
        to: match.index + match[0].length,
        html: render(match),
      });
    }
  };

  collect(IMAGE_RE, (match) => renderImageSpan(match[1]!, resolveImage(match[2]!)));
  collect(LINK_RE, (match) => renderLinkSpan(match[1]!, match[2]!));
  collect(BOLD_RE, (match) => `<strong>${renderLineInline(match[1]!, resolveImage)}</strong>`);
  collect(ITALIC_RE, (match) => `<em>${renderLineInline(match[1]!, resolveImage)}</em>`);
  collect(UNDERSCORE_ITALIC_RE, (match) => `<em>${renderLineInline(match[1]!, resolveImage)}</em>`);
  collect(RUBY_RE, (match) => renderRubySpan(match[1]!, match[2]!));

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
  const slugger = new HeadingSlugger();

  for (const lineText of doc.split("\n")) {
    const heading = parseHeading(lineText);
    if (heading !== null) {
      const plainText = stripInlineMarkdown(heading.text);
      const slug = slugger.slugFor(plainText);

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
