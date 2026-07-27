import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { parseHeading } from "./headings";

interface TocEntry {
  level: 1 | 2 | 3;
  text: string;
  from: number;
}

function extractHeadings(view: EditorView): TocEntry[] {
  const entries: TocEntry[] = [];
  for (let lineNum = 1; lineNum <= view.state.doc.lines; lineNum++) {
    const line = view.state.doc.line(lineNum);
    const heading = parseHeading(line.text);
    if (heading && heading.text.length > 0) {
      entries.push({ level: heading.level, text: heading.text, from: line.from });
    }
  }
  return entries;
}

function activeHeadingFrom(entries: TocEntry[], cursorPos: number): number | null {
  let active: number | null = null;
  for (const entry of entries) {
    if (entry.from > cursorPos) {
      break;
    }
    active = entry.from;
  }
  return active;
}

export interface Toc {
  update: () => void;
}

export function createToc(container: HTMLElement, view: EditorView): Toc {
  function jumpTo(pos: number): void {
    view.dispatch({
      selection: EditorSelection.cursor(pos),
      scrollIntoView: true,
    });
    view.focus();
  }

  function render(): void {
    const entries = extractHeadings(view);
    container.replaceChildren();

    if (entries.length === 0) {
      return;
    }

    const activeFrom = activeHeadingFrom(entries, view.state.selection.main.head);

    for (const entry of entries) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `toc-node toc-level-${entry.level}`;
      node.textContent = entry.text;
      if (entry.from === activeFrom) {
        node.classList.add("toc-active");
      }
      node.addEventListener("click", () => jumpTo(entry.from));
      container.appendChild(node);
    }
  }

  render();

  return { update: render };
}
