import { EditorSelection } from "@codemirror/state";
import type { Command, EditorView } from "@codemirror/view";
import { Vim, getCM, type CodeMirrorV } from "@replit/codemirror-vim";

let cancelPendingCapture: (() => void) | null = null;

function captureEnclosureChars(view: EditorView, from: number, to: number): void {
  cancelPendingCapture?.();
  const chars: string[] = [];

  const cancel = (): void => {
    document.removeEventListener("keydown", onKeydown, true);
    window.removeEventListener("blur", cancel);
    cancelPendingCapture = null;
  };

  // Captured keys must be swallowed at the document level so the vim
  // handler inside the editor never sees them (e.g. "(" would move the cursor).
  function onKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") {
      cancel();
      return;
    }
    if (event.key.length !== 1) {
      return;
    }
    chars.push(event.key);
    if (chars.length === 2) {
      cancel();
      const left = chars[0]!;
      const right = chars[1]!;
      view.dispatch({
        changes: [
          { from, insert: left },
          { from: to, insert: right },
        ],
        selection: EditorSelection.range(from + 1, to + 1),
      });
    }
  }

  document.addEventListener("keydown", onKeydown, true);
  window.addEventListener("blur", cancel);
  cancelPendingCapture = cancel;
}

export const encloseSelection: Command = (view) => {
  const range = view.state.selection.main;
  if (range.empty) {
    return false;
  }
  const cm = getCM(view);
  if (cm?.state.vim) {
    Vim.exitVisualMode(cm as CodeMirrorV);
  }
  captureEnclosureChars(view, range.from, range.to);
  return true;
};
