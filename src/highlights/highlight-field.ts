import { RangeSet, RangeSetBuilder, RangeValue, StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { BucketId } from "./buckets";

export interface Highlight {
  id: string;
  from: number;
  to: number;
  bucket: BucketId;
  createdAt: number;
}

class HighlightMark extends RangeValue {
  constructor(
    readonly id: string,
    readonly bucket: BucketId,
    readonly createdAt: number,
  ) {
    super();
  }

  override eq(other: RangeValue): boolean {
    return other instanceof HighlightMark && other.id === this.id;
  }
}

function toRange(highlight: Highlight) {
  return new HighlightMark(highlight.id, highlight.bucket, highlight.createdAt).range(
    highlight.from,
    highlight.to,
  );
}

export const addHighlightEffect = StateEffect.define<Highlight>();
export const removeHighlightEffect = StateEffect.define<string>();
export const loadHighlightsEffect = StateEffect.define<readonly Highlight[]>();

export const highlightField = StateField.define<RangeSet<HighlightMark>>({
  create() {
    return RangeSet.empty;
  },
  update(marks, tr) {
    let next = marks.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addHighlightEffect)) {
        next = next.update({ add: [toRange(effect.value)] });
      } else if (effect.is(removeHighlightEffect)) {
        const id = effect.value;
        next = next.update({ filter: (_from, _to, value) => value.id !== id });
      } else if (effect.is(loadHighlightsEffect)) {
        next = RangeSet.of(effect.value.map(toRange), true);
      }
    }
    return next;
  },
});

function buildDecorations(marks: RangeSet<HighlightMark>): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursor = marks.iter();
  while (cursor.value) {
    builder.add(
      cursor.from,
      cursor.to,
      Decoration.mark({
        class: "cm-highlight",
        attributes: { "data-highlight-id": cursor.value.id },
      }),
    );
    cursor.next();
  }
  return builder.finish();
}

export const highlightDecorations = EditorView.decorations.compute([highlightField], (state) =>
  buildDecorations(state.field(highlightField)),
);

export function getHighlights(state: EditorState): Highlight[] {
  const marks = state.field(highlightField);
  const result: Highlight[] = [];
  const cursor = marks.iter();
  while (cursor.value) {
    result.push({ id: cursor.value.id, from: cursor.from, to: cursor.to, bucket: cursor.value.bucket, createdAt: cursor.value.createdAt });
    cursor.next();
  }
  return result;
}

export function findHighlightAt(state: EditorState, pos: number): Highlight | null {
  return getHighlights(state).find((highlight) => highlight.from <= pos && pos <= highlight.to) ?? null;
}

export function hasHighlightEffect(effects: readonly StateEffect<unknown>[]): boolean {
  return effects.some((effect) => effect.is(addHighlightEffect) || effect.is(removeHighlightEffect));
}
