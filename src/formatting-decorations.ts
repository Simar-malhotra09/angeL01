import { RangeSetBuilder, type SelectionRange } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

const markDeco = Decoration.mark({ class: "cm-md-mark" });
const hiddenDeco = Decoration.replace({});
const boldTextDeco = Decoration.mark({ class: "cm-md-bold" });
const italicTextDeco = Decoration.mark({ class: "cm-md-italic" });
const headingLineDeco = [1, 2, 3].map((level) =>
  Decoration.line({ class: `cm-md-heading-${level}` }),
);

const BOLD_RE = /\*\*([^\n*]+)\*\*/g;
const ITALIC_RE = /(?<!\*)\*([^\n*]+)\*(?!\*)/g;
const HEADING_RE = /^(#{1,3}) /;

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
  const headingMatch = HEADING_RE.exec(lineText);
  if (headingMatch) {
    const level = headingMatch[1]!.length;
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
