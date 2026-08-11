import { RangeSetBuilder, type SelectionRange } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { parseHeading } from "../markdown/headings";
import { LINK_RE } from "../markdown/links";

const markDeco = Decoration.mark({ class: "cm-md-mark" });
const hiddenDeco = Decoration.replace({});
const boldTextDeco = Decoration.mark({ class: "cm-md-bold" });
const italicTextDeco = Decoration.mark({ class: "cm-md-italic" });
const imageLabelDeco = Decoration.mark({ class: "cm-md-image-label" });
const linkLabelDeco = Decoration.mark({ class: "cm-md-link-label" });
const headingLineDeco = [1, 2, 3].map((level) =>
  Decoration.line({ class: `cm-md-heading-${level}` }),
);

const BOLD_RE = /\*\*([^\n*]+)\*\*/g;
const ITALIC_RE = /(?<!\*)\*([^\n*]+)\*(?!\*)/g;
const IMAGE_RE = /!\[([^\]]*)\]\(image:[a-zA-Z0-9-]+\)/g;

interface DecoSpec {
  from: number;
  to: number;
  deco: Decoration;
}

function touchesSelection(ranges: readonly SelectionRange[], from: number, to: number): boolean {
  return ranges.some((range) => range.from <= to && range.to >= from);
}

function markerDeco(active: boolean): Decoration {
  return active ? markDeco : hiddenDeco;
}

function collectLineSpecs(
  lineFrom: number,
  lineTo: number,
  lineText: string,
  selectionRanges: readonly SelectionRange[],
): DecoSpec[] {
  const heading = parseHeading(lineText);
  if (heading) {
    const level = heading.level;
    const markerEnd = lineFrom + level + 1;
    const active = touchesSelection(selectionRanges, lineFrom, lineTo);
    return [
      { from: lineFrom, to: lineFrom, deco: headingLineDeco[level - 1]! },
      { from: lineFrom, to: markerEnd, deco: markerDeco(active) },
    ];
  }

  const specs: DecoSpec[] = [];

  BOLD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const innerStart = start + 2;
    const innerEnd = innerStart + match[1]!.length;
    const end = innerEnd + 2;
    const active = touchesSelection(selectionRanges, start, end);
    specs.push(
      { from: start, to: innerStart, deco: markerDeco(active) },
      { from: innerStart, to: innerEnd, deco: boldTextDeco },
      { from: innerEnd, to: end, deco: markerDeco(active) },
    );
  }

  ITALIC_RE.lastIndex = 0;
  while ((match = ITALIC_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const innerStart = start + 1;
    const innerEnd = innerStart + match[1]!.length;
    const end = innerEnd + 1;
    const active = touchesSelection(selectionRanges, start, end);
    specs.push(
      { from: start, to: innerStart, deco: markerDeco(active) },
      { from: innerStart, to: innerEnd, deco: italicTextDeco },
      { from: innerEnd, to: end, deco: markerDeco(active) },
    );
  }

  IMAGE_RE.lastIndex = 0;
  while ((match = IMAGE_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const labelStart = start + 2;
    const labelEnd = labelStart + match[1]!.length;
    const end = start + match[0].length;
    const active = touchesSelection(selectionRanges, start, end);
    specs.push(
      { from: start, to: labelStart, deco: markerDeco(active) },
      { from: labelStart, to: labelEnd, deco: imageLabelDeco },
      { from: labelEnd, to: end, deco: markerDeco(active) },
    );
  }

  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const labelStart = start + 1;
    const labelEnd = labelStart + match[1]!.length;
    const end = start + match[0].length;
    const active = touchesSelection(selectionRanges, start, end);
    specs.push(
      { from: start, to: labelStart, deco: markerDeco(active) },
      { from: labelStart, to: labelEnd, deco: linkLabelDeco },
      { from: labelEnd, to: end, deco: markerDeco(active) },
    );
  }

  return specs;
}

function buildDecorations(view: EditorView): DecorationSet {
  const specs: DecoSpec[] = [];
  const selectionRanges = view.state.selection.ranges;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      specs.push(...collectLineSpecs(line.from, line.to, line.text, selectionRanges));
      pos = line.to + 1;
    }
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const spec of specs) {
    builder.add(spec.from, spec.to, spec.deco);
  }
  return builder.finish();
}

export const markdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (instance) => instance.decorations,
  },
);
