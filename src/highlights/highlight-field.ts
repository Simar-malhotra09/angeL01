import {
  RangeSet,
  RangeSetBuilder,
  RangeValue,
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Range,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { BucketId } from "./buckets";

export interface Highlight {
  id: string;
  from: number;
  to: number;
  bucket: BucketId;
  createdAt: number;
  note?: string;
}

class HighlightMark extends RangeValue {
  constructor(
    readonly id: string,
    readonly bucket: BucketId,
    readonly createdAt: number,
    readonly note: string | undefined = undefined,
  ) {
    super();
  }

  override eq(other: RangeValue): boolean {
    return other instanceof HighlightMark && other.id === this.id;
  }
}

function toRange(highlight: Highlight) {
  return new HighlightMark(
    highlight.id,
    highlight.bucket,
    highlight.createdAt,
    highlight.note,
  ).range(highlight.from, highlight.to);
}

export const addHighlightEffect = StateEffect.define<Highlight>();
export const removeHighlightEffect = StateEffect.define<string>();
export const loadHighlightsEffect = StateEffect.define<readonly Highlight[]>();
export const updateHighlightNoteEffect = StateEffect.define<{ id: string; note: string }>();

function withNote(marks: RangeSet<HighlightMark>, id: string, note: string): RangeSet<HighlightMark> {
  const replacements: Range<HighlightMark>[] = [];
  const cursor = marks.iter();
  while (cursor.value) {
    if (cursor.value.id === id) {
      replacements.push(
        new HighlightMark(
          id,
          cursor.value.bucket,
          cursor.value.createdAt,
          note.length > 0 ? note : undefined,
        ).range(cursor.from, cursor.to),
      );
    }
    cursor.next();
  }
  if (replacements.length === 0) {
    return marks;
  }
  return marks.update({ filter: (_from, _to, value) => value.id !== id, add: replacements });
}

function mapMarksThrough(marks: RangeSet<HighlightMark>, changes: ChangeDesc): RangeSet<HighlightMark> {
  if (changes.empty) {
    return marks;
  }
  const mapped: Range<HighlightMark>[] = [];
  const cursor = marks.iter();
  while (cursor.value) {
    const from = changes.mapPos(cursor.from, 1);
    const to = changes.mapPos(cursor.to, -1);
    if (from < to) {
      mapped.push(cursor.value.range(from, to));
    }
    cursor.next();
  }
  return RangeSet.of(mapped, true);
}

export const highlightField = StateField.define<RangeSet<HighlightMark>>({
  create() {
    return RangeSet.empty;
  },
  update(marks, tr) {
    let next = mapMarksThrough(marks, tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addHighlightEffect)) {
        next = next.update({ add: [toRange(effect.value)] });
      } else if (effect.is(removeHighlightEffect)) {
        const id = effect.value;
        next = next.update({ filter: (_from, _to, value) => value.id !== id });
      } else if (effect.is(loadHighlightsEffect)) {
        next = RangeSet.of(effect.value.map(toRange), true);
      } else if (effect.is(updateHighlightNoteEffect)) {
        next = withNote(next, effect.value.id, effect.value.note);
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
    const highlight: Highlight = {
      id: cursor.value.id,
      from: cursor.from,
      to: cursor.to,
      bucket: cursor.value.bucket,
      createdAt: cursor.value.createdAt,
    };
    if (cursor.value.note !== undefined) {
      highlight.note = cursor.value.note;
    }
    result.push(highlight);
    cursor.next();
  }
  return result;
}

export function findHighlightAt(state: EditorState, pos: number): Highlight | null {
  return getHighlights(state).find((highlight) => highlight.from <= pos && pos < highlight.to) ?? null;
}

export function hasHighlightEffect(effects: readonly StateEffect<unknown>[]): boolean {
  return effects.some(
    (effect) =>
      effect.is(addHighlightEffect) ||
      effect.is(removeHighlightEffect) ||
      effect.is(updateHighlightNoteEffect),
  );
}
