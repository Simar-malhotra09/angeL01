import type { Command } from "@codemirror/view";

const BOLD_MARK = "**";

export function isLineFullyBold(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length > BOLD_MARK.length * 2 &&
    trimmed.startsWith(BOLD_MARK) &&
    trimmed.endsWith(BOLD_MARK)
  );
}

export const toggleBoldLine: Command = (view) => {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const start = line.text.length - line.text.trimStart().length;
  const end = line.text.trimEnd().length;
  if (start >= end) {
    return false;
  }
  const from = line.from + start;
  const to = line.from + end;
  const changes = isLineFullyBold(line.text)
    ? [
        { from: to - BOLD_MARK.length, to },
        { from, to: from + BOLD_MARK.length },
      ]
    : [
        { from: to, insert: BOLD_MARK },
        { from, insert: BOLD_MARK },
      ];
  view.dispatch(state.update({ changes }));
  return true;
};
