export type TypstSnippetMode = "inline" | "display" | "doc";

export interface ExtractedTypst {
  template: string;
  snippets: TypstSnippet[];
}

export interface TypstSnippet {
  token: string;
  mode: TypstSnippetMode;
  src: string;
}

const FENCED_RE = /```typst\r?\n([\s\S]*?)```/g;
const DISPLAY_RE = /\$\$([\s\S]+?)\$\$/g;
const INLINE_RE = /\$([^$\n]+?)\$/g;

export function extractTypstSnippets(doc: string): ExtractedTypst {
  const snippets: TypstSnippet[] = [];
  let nextId = 0;

  const take = (mode: TypstSnippetMode, src: string): string => {
    const token = `@tt${nextId}@`;
    nextId += 1;
    snippets.push({ token, mode, src });
    return token;
  };

  const withoutFences = doc.replace(FENCED_RE, (_match, src: string) => {
    return `\n${take("doc", src.replace(/\n$/, ""))}\n`;
  });
  const withoutDisplay = withoutFences.replace(DISPLAY_RE, (_match, src: string) => {
    return `\n${take("display", src.trim())}\n`;
  });
  const template = withoutDisplay.replace(INLINE_RE, (_match, src: string) => {
    return take("inline", src);
  });

  return { template, snippets };
}

export interface TypstSwap {
  token: string;
  html: string;
}

export function substituteTypst(html: string, swaps: readonly TypstSwap[]): string {
  let result = html;
  for (const swap of swaps) {
    result = result.replace(`<p>${swap.token}</p>`, swap.html);
    result = result.replaceAll(swap.token, swap.html);
  }
  return result;
}

export interface TypstMarker {
  mode: TypstSnippetMode;
  src: string;
  markTo: number;
  key: string;
}

function maskKeepNewlines(text: string): string {
  return text.replace(/[^\n]/g, " ");
}

export function findTypstMarkers(doc: string): TypstMarker[] {
  const markers: TypstMarker[] = [];
  let masked = doc;

  const consume = (
    re: RegExp,
    mode: TypstSnippetMode,
    cleanup: (src: string) => string,
  ): void => {
    re.lastIndex = 0;
    masked = masked.replace(re, (full: string, src: string, offset: number) => {
      const cleaned = cleanup(src);
      markers.push({
        mode,
        src: cleaned,
        markTo: offset + full.length,
        key: `${mode}:${cleaned}`,
      });
      return maskKeepNewlines(full);
    });
  };

  consume(FENCED_RE, "doc", (src) => src.replace(/\n$/, ""));
  consume(DISPLAY_RE, "display", (src) => src.trim());
  consume(INLINE_RE, "inline", (src) => src);

  markers.sort((a, b) => a.markTo - b.markTo);
  return markers;
}
