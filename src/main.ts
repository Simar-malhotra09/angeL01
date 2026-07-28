import "./style.css";
import { createEditor } from "./editor";
import { loadDraft, loadTitle, saveTitle } from "./storage";
import { countWords, formatWordCount } from "./word-count";
import { createToc, type Toc } from "./toc";
import { exportDocumentAsHtml } from "./export";

function main(): void {
  const shell = document.getElementById("editor-shell");
  const wordCountEl = document.getElementById("word-count");
  const tocEl = document.getElementById("toc");
  const exportButton = document.getElementById("export-button");
  const docTitleEl = document.querySelector<HTMLInputElement>("#doc-title");

  if (!shell || !wordCountEl || !tocEl || !exportButton || !docTitleEl) {
    throw new Error(
      "Missing required DOM mount points: #editor-shell, #word-count, #toc, #export-button, and/or #doc-title",
    );
  }

  const initialDoc = loadDraft();
  wordCountEl.textContent = formatWordCount(countWords(initialDoc));

  const initialTitle = loadTitle();
  docTitleEl.value = initialTitle.length > 0 ? initialTitle : "untitled";

  docTitleEl.addEventListener("input", () => {
    saveTitle(docTitleEl.value);
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
    },
    onUpdate: () => {
      toc?.update();
    },
  });

  toc = createToc(tocEl, view);

  exportButton.addEventListener("click", () => {
    const title = docTitleEl.value.trim();
    void exportDocumentAsHtml(view, title.length > 0 ? title : "untitled");
  });

  view.focus();
}

main();
