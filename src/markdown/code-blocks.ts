import { escapeHtml } from "./markdown-to-html";

export interface CodeBlockSnippet {
  token: string;
  lang: string;
  src: string;
}

export interface ExtractedCodeBlocks {
  template: string;
  blocks: CodeBlockSnippet[];
}

// Mirrors the typst FENCED_RE shape, but matches any language. Extraction must
// run before typst extraction so `$`/`$$` inside code stays literal, and must
// leave ```typst fences in place for the typst pipeline. Line-anchored like the
// markdown parser: the fence line may be indented up to 3 spaces, the info
// string is one whitespace-free token, and trailing spaces after it are fine.
const CODE_FENCE_RE = /^ {0,3}```([^\s`]*)[^\S\n]*\r?\n([\s\S]*?)^ {0,3}```[^\S\n]*$/gm;

export function extractCodeBlocks(doc: string): ExtractedCodeBlocks {
  const blocks: CodeBlockSnippet[] = [];
  let nextId = 0;
  CODE_FENCE_RE.lastIndex = 0;
  const template = doc.replace(CODE_FENCE_RE, (full, lang: string, src: string) => {
    if (lang === "typst") {
      return full;
    }
    const token = `@cc${nextId}@`;
    nextId += 1;
    blocks.push({ token, lang, src: src.replace(/\n$/, "") });
    return `\n${token}\n`;
  });
  return { template, blocks };
}

// Blanks out fenced regions (keeping newlines) so a later pass — the editor's
// typst preview markers — sees nothing inside code. typst fences are expected
// to already be consumed by the caller.
export function maskCodeFences(doc: string): string {
  CODE_FENCE_RE.lastIndex = 0;
  return doc.replace(CODE_FENCE_RE, (full) => full.replace(/[^\n]/g, " "));
}

function codeBlockHtml(block: CodeBlockSnippet): string {
  const langClass = block.lang !== "" ? ` class="language-${block.lang}"` : "";
  return `<pre class="code-block"><code${langClass}>${escapeHtml(block.src)}</code></pre>`;
}

export function substituteCodeBlocks(
  html: string,
  blocks: readonly CodeBlockSnippet[],
): string {
  let result = html;
  for (const block of blocks) {
    const pre = codeBlockHtml(block);
    result = result.replace(`<p>${block.token}</p>`, pre);
    result = result.replaceAll(block.token, pre);
  }
  return result;
}
