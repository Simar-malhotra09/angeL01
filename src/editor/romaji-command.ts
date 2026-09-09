import { EditorSelection } from "@codemirror/state";
import type { Command } from "@codemirror/view";
import { Vim, getCM, type CodeMirrorV } from "@replit/codemirror-vim";
import { fetchRomaji } from "../romaji/client";

const JA_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

export const annotateRomaji: Command = (view) => {
  const range = view.state.selection.main;
  if (range.empty) {
    return false;
  }
  const raw = view.state.sliceDoc(range.from, range.to);
  const source = raw.trim();
  // Single-line, Japanese-only selections with no token chars can be
  // converted; anything else is left alone.
  if (source.length === 0 || !JA_RE.test(source) || /[{}|\n]/.test(source)) {
    return false;
  }
  const from = range.from + (raw.length - raw.trimStart().length);
  const to = from + source.length;
  const cm = getCM(view);
  if (cm?.state.vim) {
    Vim.exitVisualMode(cm as CodeMirrorV);
  }
  void fetchRomaji(source).then((result) => {
    if (!result.ok) {
      console.error(`romaji: ${result.body}`);
      return;
    }
    const romaji = result.body.trim();
    if (romaji.length === 0 || /[{}|]/.test(romaji)) {
      return;
    }
    // Edits made while the server converted shift/change the range; swap
    // only when the text we sent is still there.
    if (view.state.sliceDoc(from, to) !== source) {
      return;
    }
    const insert = `{${source}|${romaji}}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length),
    });
  });
  return true;
};
