import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { getCoordsAtEnd } from "./tooltip-anchor";
import { LINK_RE, HeadingSlugger, isInternalLink, slugify } from "../markdown/links";
import { parseHeading } from "../markdown/headings";
import { stripInlineMarkdown } from "../markdown/markdown-to-html";

const BARE_URL_RE = /https?:\/\/[^\s]+/g;

interface LinkMatch {
  from: number;
  to: number;
  url: string;
}

export function findLinkAt(lineText: string, lineFrom: number, pos: number): LinkMatch | null {
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

export interface AnchorTarget {
  from: number;
  text: string;
}

export function findAnchorTarget(docText: string, anchor: string): AnchorTarget | null {
  const target = slugify(anchor.slice(1));
  const slugger = new HeadingSlugger();
  let pos = 0;
  for (const lineText of docText.split("\n")) {
    const heading = parseHeading(lineText);
    if (heading !== null) {
      const text = stripInlineMarkdown(heading.text);
      if (slugger.slugFor(text) === target) {
        return { from: pos, text };
      }
    }
    pos += lineText.length + 1;
  }
  return null;
}

export const urlHoverTooltip = hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
  const line = view.state.doc.lineAt(pos);
  const link = findLinkAt(line.text, line.from, pos);
  if (link === null) {
    return null;
  }

  if (isInternalLink(link.url)) {
    return {
      pos: link.from,
      end: link.to,
      above: true,
      create: (tooltipView) => {
        const target = findAnchorTarget(tooltipView.state.doc.toString(), link.url);
        const dom = document.createElement("span");
        dom.className = "cm-url-tooltip";
        dom.textContent =
          target === null ? `No heading matches ${link.url}` : `Go to ${target.text}`;
        return { dom, getCoords: (p) => getCoordsAtEnd(tooltipView, link.to, p) };
      },
    };
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
