import { EditorSelection } from "@codemirror/state";
import type { Command } from "@codemirror/view";
import { parseHeading } from "../markdown/headings";

const BOLD_MARK = "**";
const ITALIC_MARK = "*";

function isWrappedWith(doc: string, from: number, to: number, mark: string): boolean {
  const before = doc.slice(from - mark.length, from);
  const after = doc.slice(to, to + mark.length);
  if (before !== mark || after !== mark) {
    return false;
  }
  if (mark === ITALIC_MARK) {
    const beforeThat = doc.slice(from - mark.length - 1, from - mark.length);
    const afterThat = doc.slice(to + mark.length, to + mark.length + 1);
    if (beforeThat === ITALIC_MARK || afterThat === ITALIC_MARK) {
      return false;
    }
  }
  return true;
}

function toggleWrap(mark: string): Command {
  return (view) => {
    const { state } = view;
    const doc = state.doc.toString();
    const changes = state.changeByRange((range) => {
      if (range.empty) {
        return { range };
      }
      if (isWrappedWith(doc, range.from, range.to, mark)) {
        return {
          changes: [
            { from: range.from - mark.length, to: range.from },
            { from: range.to, to: range.to + mark.length },
          ],
          range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
        };
      }
      return {
        changes: [
          { from: range.from, insert: mark },
          { from: range.to, insert: mark },
        ],
        range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
      };
    });

    if (!changes.changes.empty) {
      view.dispatch(state.update(changes));
    }
    return true;
  };
}

export const toggleBold: Command = toggleWrap(BOLD_MARK);
export const toggleItalic: Command = toggleWrap(ITALIC_MARK);

export function makeToggleHeading(level: 1 | 2 | 3): Command {
  return (view) => {
    const { state } = view;
    const line = state.doc.lineAt(state.selection.main.head);
    const currentLevel = parseHeading(line.text)?.level ?? 0;
    const prefixEnd = currentLevel > 0 ? line.from + currentLevel + 1 : line.from;
    const insert = currentLevel === level ? "" : "#".repeat(level) + " ";

    view.dispatch({ changes: { from: line.from, to: prefixEnd, insert } });
    return true;
  };
}

export const insertLink: Command = (view) => {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    if (range.empty) {
      const insert = "[]()";
      return {
        changes: { from: range.from, insert },
        range: EditorSelection.cursor(range.from + 1),
      };
    }

    const label = state.sliceDoc(range.from, range.to);
    const insert = `[${label}]()`;
    const cursor = range.from + label.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(cursor),
    };
  });

  view.dispatch(state.update(changes));
  return true;
};
