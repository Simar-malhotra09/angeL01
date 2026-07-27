import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

const URL_PATTERN = /https?:\/\/[^\s]+/g;

function findUrlAt(lineText: string, lineFrom: number, pos: number): Tooltip | null {
  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const end = start + match[0].length;
    if (pos < start || pos > end) {
      continue;
    }
    const url = match[0];
    return {
      pos: start,
      end,
      above: true,
      create: () => {
        const dom = document.createElement("a");
        dom.className = "cm-url-tooltip";
        dom.href = url;
        dom.target = "_blank";
        dom.rel = "noopener noreferrer";
        dom.textContent = `Open ${url}`;
        return { dom };
      },
    };
  }
  return null;
}

export const urlHoverTooltip = hoverTooltip((view: EditorView, pos: number) => {
  const line = view.state.doc.lineAt(pos);
  return findUrlAt(line.text, line.from, pos);
});
