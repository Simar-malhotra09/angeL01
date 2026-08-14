import "./style.css";
import { createEditor } from "./editor/editor";
import { getText, getDocID } from "./storage";
import { countWords, formatWordCount } from "./word-count";
import { createToc, type Toc } from "./toc";
import { exportDocumentAsHtml } from "./export";
import { parseHeading } from "./markdown/headings";
import { stripInlineMarkdown } from "./markdown/markdown-to-html";

function titleFromContent(content: string): string {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0);
  if (!firstLine) {
    return "";
  }
  return stripInlineMarkdown(parseHeading(firstLine)?.text ?? firstLine).trim();
}

async function main(): Promise<void> {
  const shell = document.getElementById("editor-shell");
  const wordCountEl = document.getElementById("word-count");
  const tocEl = document.getElementById("toc");
  const exportButton = document.getElementById("export-button");
  const copyButton = document.getElementById("copy-button");
  const docTitleEl = document.querySelector<HTMLInputElement>("#doc-title");

  if (!shell || !wordCountEl || !tocEl || !exportButton || !copyButton || !docTitleEl) {
    throw new Error(
      "Missing required DOM mount points: #editor-shell, #word-count, #toc, #export-button, #copy-button, and/or #doc-title",
    );
  }

  const id = getDocID();
  const doc = await getText(id);
  const initialDoc = doc?.content ?? "";

  wordCountEl.textContent = formatWordCount(countWords(initialDoc));

  const savedTitle = doc?.title?.trim() ?? "";
  const autoTitle = titleFromContent(initialDoc);
  let titleIsExplicit = savedTitle.length > 0 && savedTitle !== (autoTitle || "untitled");

  docTitleEl.value = savedTitle.length > 0 ? savedTitle : autoTitle || "untitled";

  docTitleEl.addEventListener("input", () => {
    titleIsExplicit = true;
  });

  docTitleEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      docTitleEl.blur();
    }
  });

  let toc: Toc | null = null;

  const view = createEditor(shell, initialDoc, {
    onChange: (text) => {
      wordCountEl.textContent = formatWordCount(countWords(text));
      if (!titleIsExplicit) {
        docTitleEl.value = titleFromContent(text) || "untitled";
      }
    },
    onUpdate: () => {
      toc?.update();
    },
    getTitle: () => {
      const title = docTitleEl.value.trim();
      return title.length > 0 ? title : "untitled";
    },
  });

  toc = createToc(tocEl, view);

  exportButton.addEventListener("click", () => {
    const title = docTitleEl.value.trim();
    void exportDocumentAsHtml(view, title.length > 0 ? title : "untitled");
  });

  copyButton.addEventListener("click", () => {
    void navigator.clipboard.writeText(view.state.doc.toString()).then(() => {
      const original = copyButton.textContent;
      copyButton.textContent = "Copied!";
      setTimeout(() => {
        copyButton.textContent = original;
      }, 1500);
    });
  });

  view.focus();
}

void main();
