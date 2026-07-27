import "./style.css";
import { createEditor } from "./editor";
import { loadDraft } from "./storage";
import { countWords, formatWordCount } from "./word-count";

function main(): void {
  const shell = document.getElementById("editor-shell");
  const wordCountEl = document.getElementById("word-count");

  if (!shell || !wordCountEl) {
    throw new Error(
      "Missing required DOM mount points: #editor-shell and/or #word-count",
    );
  }

  const initialDoc = loadDraft();
  wordCountEl.textContent = formatWordCount(countWords(initialDoc));

  const view = createEditor(shell, initialDoc, {
    onChange: (text) => {
      wordCountEl.textContent = formatWordCount(countWords(text));
    },
  });

  view.focus();
}

main();
