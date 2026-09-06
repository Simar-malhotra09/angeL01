import {
  EditorState,
  Transaction,
  type StateCommand,
} from "@codemirror/state";
import { getIndentUnit } from "@codemirror/language";
import { isInCodeBlock } from "./code-block";

// Hand-maintained numbered headings like "10." or "  10.1." — Enter bumps
// the last number and carries the indentation to the next line.
const NUMBER_MARKER = /^(\s*)(\d+(?:\.\d+)*\.)(?=\s|$)/;

function bumpMarker(marker: string): string {
  const parts = marker.slice(0, -1).split(".");
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  return parts.join(".") + ".";
}

function insert(
  state: EditorState,
  from: number,
  to: number,
  text: string,
  cursor: number,
): Transaction {
  return state.update({
    changes: { from, to, insert: text },
    selection: { anchor: cursor },
    scrollIntoView: true,
    userEvent: "input",
  });
}

// Enter on an indented line keeps the same indentation on the next one, so
// hand-laid-out outlines don't need spaces retyped. A numbered marker gets
// the next number ("10.1. x" -> "10.2. "). A blank indented line (or a
// lone marker) ends the indented run: the indent/marker is dropped and the
// cursor lands at column zero. Returns false outside these cases so the
// default Enter behaviour applies (plain lines, code blocks, selections).
export const continueIndentEnter: StateCommand = ({ state, dispatch }) => {
  const { main } = state.selection;
  if (state.selection.ranges.length > 1 || !main.empty) {
    return false;
  }
  const pos = main.head;
  if (isInCodeBlock(state, pos)) {
    return false;
  }
  const line = state.doc.lineAt(pos);
  const breakIn = state.lineBreak;

  if (/^\s*$/.test(line.text)) {
    if (line.text.length === 0) {
      return false;
    }
    dispatch(
      insert(state, line.from, pos, breakIn, line.from + breakIn.length),
    );
    return true;
  }

  const numbered = NUMBER_MARKER.exec(line.text);
  if (numbered) {
    const indent = numbered[1] ?? "";
    const marker = numbered[2] ?? "";
    const markerEnd = line.from + indent.length + marker.length;
    if (!/\S/.test(line.text.slice(indent.length + marker.length))) {
      dispatch(
        insert(state, line.from, pos, breakIn, line.from + breakIn.length),
      );
      return true;
    }
    if (pos >= markerEnd) {
      const text = breakIn + indent + bumpMarker(marker) + " ";
      dispatch(insert(state, pos, pos, text, pos + text.length));
      return true;
    }
  }

  const indent = /^\s*/.exec(line.text)![0];
  if (indent.length > 0) {
    const text = breakIn + indent;
    dispatch(insert(state, pos, pos, text, pos + text.length));
    return true;
  }
  return false;
};

// Backspace when everything before the cursor on the line is indentation:
// delete one level (an indent unit) instead of a single space. Anything
// else falls through to the default Backspace.
export const deleteIndentLevelBackspace: StateCommand = ({
  state,
  dispatch,
}) => {
  const { main } = state.selection;
  if (state.selection.ranges.length > 1 || !main.empty) {
    return false;
  }
  const pos = main.head;
  const line = state.doc.lineAt(pos);
  if (pos === line.from) {
    return false;
  }
  const before = line.text.slice(0, pos - line.from);
  if (!/^\s+$/.test(before)) {
    return false;
  }
  const remove = before.endsWith("\t")
    ? 1
    : before.length % getIndentUnit(state) || getIndentUnit(state);
  dispatch(
    state.update({
      changes: { from: pos - remove, to: pos },
      scrollIntoView: true,
      userEvent: "delete.backward",
    }),
  );
  return true;
};
