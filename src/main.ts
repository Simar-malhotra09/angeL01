import "./style.css";
import { createEditor } from "./editor";
import { loadDraft } from "./storage";
import { countWords, formatWordCount } from "./word-count";
import { createToc, type Toc } from "./toc";
import { exportDocumentAsHtml } from "./export";

function main(): void {
  const shell = document.getElementById("editor-shell");
  const wordCountEl = document.getElementById("word-count");
  const tocEl = document.getElementById("toc");
  const exportButton = document.getElementById("export-button");

  if (!shell || !wordCountEl || !tocEl || !exportButton) {
    throw new Error(
      "Missing required DOM mount points: #editor-shell, #word-count, #toc, and/or #export-button",
    );
  }

  const initialDoc = loadDraft();
  wordCountEl.textContent = formatWordCount(countWords(initialDoc));

  let toc: Toc | null = null;

  const view = createEditor(shell, initialDoc, {
    onChange: (text) => {
      wordCountEl.textContent = formatWordCount(countWords(text));
    },
    onUpdate: () => {
      toc?.update();
    },
  });

  toc = createToc(tocEl, view);

  exportButton.addEventListener("click", () => {
    void exportDocumentAsHtml(view);
  });

  view.focus();
}

main();
