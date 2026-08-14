import type { EditorView } from "@codemirror/view";
import { getImage } from "./image/image-store";
import { renderMarkdownToHtml, escapeHtml, slugify, type TocHeading } from "./markdown/markdown-to-html";

const IMAGE_REF_RE = /!\[[^\]]*\]\(image:([a-zA-Z0-9-]+)\)/g;

const PAGE_STYLES = `
body {
  margin: 0;
  padding: 14vh 8px 20vh 8px;
  display: flex;
  justify-content: center;
  background: #faf8f4;
  color: #2b2822;
}
main {
  width: 100%;
  max-width: 700px;
  font-family: "iA Writer Duospace", Georgia, "Iowan Old Style", serif;
  font-size: 19px;
  line-height: 1.75;
}
h1, h2, h3 {
  font-weight: 700;
  margin: 0.6em 0 0.3em 0;
}
h1 { font-size: 1.7em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.15em; }
p { margin: 0; }
a { color: #b5624a; text-decoration: none; }
a:hover { text-decoration: underline; }

.x-link, .x-image {
  position: relative;
}
.x-link-tooltip, .x-image-preview {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  z-index: 5;
}
.x-link:hover .x-link-tooltip,
.x-image:hover .x-image-preview {
  display: block;
}
.x-link-tooltip {
  padding: 4px 8px;
  white-space: nowrap;
  background: #faf8f4;
  border: 1px solid #a39f92;
  border-radius: 4px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: #b5624a;
}
.x-image-label {
  color: #b5624a;
  border-bottom: 1px dotted #b5624a;
}
.x-image-preview img {
  display: block;
  max-width: 320px;
  max-height: 320px;
  object-fit: contain;
  background: #faf8f4;
  border: 1px solid #a39f92;
  border-radius: 4px;
}
.x-image-block {
  margin: 1.5em 0;
  text-align: center;
}
.x-image-block:has(+ .x-image-caption) {
  margin-bottom: 0;
}
.x-image-block img {
  max-width: 100%;
  border-radius: 4px;
}
.x-image-block-missing {
  text-align: center;
  color: #a39f92;
  font-style: italic;
}
.x-image-caption {
  margin: 0.4em 0 1.5em 0;
  text-align: center;
  font-size: 0.75em;
  font-style: italic;
  color: #a39f92;
}

nav.x-toc {
  display: none;
  position: fixed;
  top: 14vh;
  left: 24px;
  width: 170px;
  max-height: 70vh;
  overflow-y: auto;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
}
nav.x-toc a {
  display: block;
  padding: 3px 0;
  color: #a39f92;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
nav.x-toc a:hover {
  color: #2b2822;
  text-decoration: none;
}
nav.x-toc a.x-toc-2 { padding-left: 12px; }
nav.x-toc a.x-toc-3 { padding-left: 24px; }

@media (min-width: 1150px) {
  nav.x-toc { display: block; }
}

.x-copy-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 8px 14px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: #2b2822;
  background: #faf8f4;
  border: 1px solid #a39f92;
  border-radius: 6px;
  cursor: pointer;
}
.x-copy-btn:hover {
  border-color: #b5624a;
  color: #b5624a;
}
`;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read image blob"));
    };
    reader.readAsDataURL(blob);
  });
}

async function resolveImageDataUrls(doc: string): Promise<Map<string, string>> {
  const ids = new Set<string>();
  IMAGE_REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMAGE_REF_RE.exec(doc)) !== null) {
    ids.add(match[1]!);
  }

  const entries = await Promise.all(
    Array.from(ids, async (id): Promise<readonly [string, string] | null> => {
      const blob = await getImage(id);
      return blob === null ? null : [id, await blobToDataUrl(blob)];
    }),
  );

  const dataUrls = new Map<string, string>();
  for (const entry of entries) {
    if (entry !== null) {
      dataUrls.set(entry[0], entry[1]);
    }
  }
  return dataUrls;
}

function renderToc(headings: readonly TocHeading[]): string {
  if (headings.length === 0) {
    return "";
  }
  const links = headings
    .map(
      (heading) =>
        `<a href="#${heading.slug}" class="x-toc-${heading.level}">${escapeHtml(heading.text)}</a>`,
    )
    .join("\n");
  return `<nav class="x-toc">\n${links}\n</nav>`;
}

function buildHtmlDocument(title: string, bodyHtml: string, tocHtml: string, rawText: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${PAGE_STYLES}</style>
</head>
<body>
${tocHtml}
<main>
${bodyHtml}
</main>
<button type="button" class="x-copy-btn" id="x-copy-btn" data-source="${escapeHtml(rawText)}">Copy all text</button>
<script>
document.getElementById("x-copy-btn").addEventListener("click", function (event) {
  var button = event.currentTarget;
  navigator.clipboard.writeText(button.dataset.source).then(function () {
    var original = button.textContent;
    button.textContent = "Copied!";
    setTimeout(function () {
      button.textContent = original;
    }, 1500);
  });
});
</script>
</body>
</html>
`;
}

function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportDocumentAsHtml(view: EditorView, title: string): Promise<void> {
  const doc = view.state.doc.toString();
  const imageDataUrls = await resolveImageDataUrls(doc);
  const { html: bodyHtml, headings } = renderMarkdownToHtml(doc, (id) => imageDataUrls.get(id) ?? null);
  const filename = `${slugify(title)}.html`;
  downloadHtmlFile(filename, buildHtmlDocument(title, bodyHtml, renderToc(headings), doc));
}
