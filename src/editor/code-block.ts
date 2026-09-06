import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { closeBrackets, deleteBracketPair } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, syntaxTree } from "@codemirror/language";
import type { Command } from "@codemirror/view";
import { codeHighlightStyle } from "../markdown/code-highlight";
import { resolveTypographyInsert } from "../markdown/smart-typography";

export function isInCodeBlock(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, -1);
  while (node) {
    if (node.name === "FencedCode") {
      return true;
    }
    if (node.name === "Document") {
      return false;
    }
    node = node.parent!;
  }
  return false;
}

// Chars that closeBrackets would pair (or skip over) with its default
// config. Outside code blocks we type them plain, so quotes/dashes can
// still be converted by the smart-typography pass below.
const PLAIN_PROSE_CHARS = "()[]{}'\"";

const codeAwareInputHandler = EditorView.inputHandler.of(
  (view, from, to, insert) => {
    if (from !== to || insert.length !== 1) {
      return false;
    }
    if (isInCodeBlock(view.state, from)) {
      return false;
    }
    const docBefore = view.state.doc.sliceString(0, from);
    const replacement = resolveTypographyInsert(docBefore, from, insert);
    if (replacement !== null) {
      view.dispatch({
        changes: {
          from: replacement.from,
          to: replacement.to,
          insert: replacement.text,
        },
        selection: { anchor: replacement.from + replacement.text.length },
        userEvent: "input.type",
      });
      return true;
    }
    if (PLAIN_PROSE_CHARS.includes(insert)) {
      view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.cursor(from + insert.length),
        userEvent: "input.type",
      });
      return true;
    }
    return false;
  },
);

export const codeBlockBackspace: Command = (view) => {
  if (!isInCodeBlock(view.state, view.state.selection.main.head)) {
    return false;
  }
  return deleteBracketPair(view);
};

export const codeBlockExtensions: Extension[] = [
  markdown({ codeLanguages: languages, pasteURLAsLink: false, addKeymap: false }),
  syntaxHighlighting(codeHighlightStyle),
  codeAwareInputHandler,
  closeBrackets(),
];
