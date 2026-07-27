import "./style.css";
import { createEditor } from "./editor";
import { loadDraft } from "./storage";
import { countWords, formatWordCount } from "./word-count";
import { createToc, type Toc } from "./toc";

function main(): void {
  const shell = document.getElementById("editor-shell");
  const wordCountEl = document.getElementById("word-count");
  const tocEl = document.getElementById("toc");

  if (!shell || !wordCountEl || !tocEl) {
    throw new Error(
      "Missing required DOM mount points: #editor-shell, #word-count, and/or #toc",
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

  view.focus();
}

main();
