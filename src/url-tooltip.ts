import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { getCoordsAtEnd } from "./tooltip-anchor";
import { LINK_RE } from "./links";

const BARE_URL_RE = /https?:\/\/[^\s]+/g;

interface LinkMatch {
  from: number;
  to: number;
  url: string;
}

function findLinkAt(lineText: string, lineFrom: number, pos: number): LinkMatch | null {
  LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const end = start + match[0].length;
    if (pos >= start && pos <= end) {
      return { from: start, to: end, url: match[2]! };
    }
  }

  BARE_URL_RE.lastIndex = 0;
  while ((match = BARE_URL_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const end = start + match[0].length;
    if (pos >= start && pos <= end) {
      return { from: start, to: end, url: match[0] };
    }
  }

  return null;
}

export const urlHoverTooltip = hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
  const line = view.state.doc.lineAt(pos);
  const link = findLinkAt(line.text, line.from, pos);
  if (link === null) {
    return null;
  }

  return {
    pos: link.from,
    end: link.to,
    above: true,
    create: (tooltipView) => {
      const dom = document.createElement("a");
      dom.className = "cm-url-tooltip";
      dom.href = link.url;
      dom.target = "_blank";
      dom.rel = "noopener noreferrer";
      dom.textContent = `Open ${link.url}`;
      return { dom, getCoords: (p) => getCoordsAtEnd(tooltipView, link.to, p) };
    },
  };
});
