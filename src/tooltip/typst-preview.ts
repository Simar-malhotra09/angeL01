import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type EditorState,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { findTypstMarkers, type TypstMarker, type TypstSnippetMode } from "../typst/extract";
import { fetchTypstSvg } from "../typst/client";

interface PreviewState {
  readonly keys: ReadonlySet<string>;
  readonly seq: number;
}

interface PreviewEntry {
  readonly ok: boolean;
  readonly body: string;
}

const previewCache = new Map<string, PreviewEntry>();
const pending = new Map<string, Promise<PreviewEntry>>();

function cacheKey(mode: TypstSnippetMode, src: string): string {
  return `${mode}:${src}`;
}

async function compileSnippet(src: string, mode: TypstSnippetMode): Promise<PreviewEntry> {
  const key = cacheKey(mode, src);
  const cached = previewCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const inFlight = pending.get(key);
  if (inFlight !== undefined) {
    return inFlight;
  }
  const job = fetchTypstSvg(src, mode).then((result) => {
    const entry: PreviewEntry = { ok: result.ok, body: result.body };
    previewCache.set(key, entry);
    pending.delete(key);
    return entry;
  });
  pending.set(key, job);
  return job;
}

export const setTypstPreviewsEffect = StateEffect.define<ReadonlySet<string>>();

export const previewKeysField = StateField.define<PreviewState>({
  create() {
    return { keys: new Set<string>(), seq: 0 };
  },
  update(state, tr) {
    let next = state;
    for (const effect of tr.effects) {
      if (effect.is(setTypstPreviewsEffect)) {
        next = { keys: effect.value, seq: next.seq };
      }
    }
    if (tr.docChanged) {
      next = { keys: next.keys, seq: next.seq + 1 };
    }
    return next;
  },
});

function fillTip(tip: HTMLElement, entry: PreviewEntry): void {
  tip.textContent = "";
  if (entry.ok) {
    const holder = document.createElement("span");
    holder.className = "cm-typst-preview-svg";
    holder.innerHTML = entry.body;
    tip.appendChild(holder);
  } else {
    const err = document.createElement("pre");
    err.className = "cm-typst-preview-error";
    err.textContent = entry.body;
    tip.appendChild(err);
  }
}

class TypstPreviewWidget extends WidgetType {
  constructor(private readonly marker: TypstMarker) {
    super();
  }

  override eq(other: TypstPreviewWidget): boolean {
    return other.marker.key === this.marker.key;
  }

  override toDOM(): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "cm-typst-preview";
    badge.textContent = "preview";

    const tip = document.createElement("span");
    tip.className = "cm-typst-preview-tip";
    badge.appendChild(tip);

    const key = this.marker.key;
    const cached = previewCache.get(key);
    if (cached !== undefined) {
      fillTip(tip, cached);
    } else {
      tip.textContent = "compiling\u2026";
      void compileSnippet(this.marker.src, this.marker.mode).then((entry) => {
        if (badge.isConnected) {
          fillTip(tip, entry);
        }
      });
    }
    return badge;
  }

  override ignoreEvent(event: Event): boolean {
    return event.type === "mousedown";
  }
}

function buildPreviewDecorations(state: EditorState): DecorationSet {
  const { keys } = state.field(previewKeysField);
  if (keys.size === 0) {
    return Decoration.none;
  }
  const markers = findTypstMarkers(state.doc.toString());
  const builder = new RangeSetBuilder<Decoration>();
  for (const marker of markers) {
    if (keys.has(marker.key)) {
      builder.add(
        marker.markTo,
        marker.markTo,
        Decoration.widget({ widget: new TypstPreviewWidget(marker), side: 1 }),
      );
    }
  }
  return builder.finish();
}

export const typstPreviewDecorations = EditorView.decorations.compute(
  [previewKeysField],
  (state) => buildPreviewDecorations(state),
);

export function setTypstPreviews(view: EditorView, keys: ReadonlySet<string>): void {
  view.dispatch({ effects: setTypstPreviewsEffect.of(keys) });
}

export function currentTypstKeys(docText: string): Set<string> {
  const keys = new Set<string>();
  for (const marker of findTypstMarkers(docText)) {
    keys.add(marker.key);
  }
  return keys;
}

const typstPreviewTheme: Extension = EditorView.baseTheme({
  ".cm-typst-preview": {
    position: "relative",
    display: "inline-block",
    marginLeft: "6px",
    padding: "0 5px",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "11px",
    lineHeight: "1.4",
    color: "#b5624a",
    border: "1px dotted #b5624a",
    borderRadius: "4px",
    cursor: "default",
    userSelect: "none",
    verticalAlign: "baseline",
  },
  ".cm-typst-preview-tip": {
    display: "none",
    position: "absolute",
    bottom: "100%",
    left: "0",
    marginBottom: "4px",
    zIndex: "50",
    padding: "6px 8px",
    background: "#faf8f4",
    border: "1px solid #a39f92",
    borderRadius: "4px",
    maxWidth: "420px",
    maxHeight: "320px",
    overflow: "auto",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(43, 40, 34, 0.15)",
  },
  ".cm-typst-preview:hover .cm-typst-preview-tip": {
    display: "block",
  },
  ".cm-typst-preview-svg svg": {
    display: "block",
    maxWidth: "400px",
    height: "auto",
  },
  ".cm-typst-preview-error": {
    margin: "0",
    color: "#b5624a",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "11px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxWidth: "380px",
  },
});

export const typstPreviewExtension: Extension = [
  previewKeysField,
  typstPreviewTheme,
  typstPreviewDecorations,
];
