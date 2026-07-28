import type { EditorView } from "@codemirror/view";
import { getImage } from "./image-store";
import { renderMarkdownToHtml, escapeHtml } from "./markdown-to-html";
import { parseHeading } from "./headings";

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
a { color: #b5624a; }
img { max-width: 100%; display: block; margin: 0.5em 0; }
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

function deriveTitle(doc: string): string {
  for (const lineText of doc.split("\n")) {
    const heading = parseHeading(lineText);
    if (heading !== null && heading.text.length > 0) {
      return heading.text;
    }
  }
  return "Untitled";
}

function deriveFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug.length > 0 ? slug : "untitled"}.html`;
}

function buildHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${PAGE_STYLES}</style>
</head>
<body>
<main>
${bodyHtml}
</main>
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

export async function exportDocumentAsHtml(view: EditorView): Promise<void> {
  const doc = view.state.doc.toString();
  const imageDataUrls = await resolveImageDataUrls(doc);
  const bodyHtml = renderMarkdownToHtml(doc, (id) => imageDataUrls.get(id) ?? null);
  const title = deriveTitle(doc);
  downloadHtmlFile(deriveFilename(title), buildHtmlDocument(title, bodyHtml));
}
