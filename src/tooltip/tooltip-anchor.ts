import type { EditorView, Rect } from "@codemirror/view";

const FALLBACK_RECT: Rect = { left: 0, right: 0, top: 0, bottom: 0 };

export function getCoordsAtEnd(view: EditorView, end: number, fallbackPos: number): Rect {
  return view.coordsAtPos(end) ?? view.coordsAtPos(fallbackPos) ?? FALLBACK_RECT;
}
