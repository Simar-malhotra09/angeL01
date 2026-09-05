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
import { scaleSvgForPreview } from "../typst/svg-size";
import type { TypstDiagnostic } from "../typst/diagnostics";

interface PreviewState {
  readonly keys: ReadonlySet<string>;
  readonly seq: number;
}

interface PreviewEntry {
  readonly ok: boolean;
  readonly body: string;
  readonly at: number;
  readonly diagnostics?: readonly TypstDiagnostic[];
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
    const entry: PreviewEntry = {
      ok: result.ok,
      body: result.body,
      at: result.at,
      ...(result.diagnostics !== undefined ? { diagnostics: result.diagnostics } : {}),
    };
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

function formatStamp(at: number): string {
  const time = new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `api call made ${time}`;
}

function appendDiagnostic(tip: HTMLElement, diagnostic: TypstDiagnostic, srcLines: readonly string[]): void {
  const block = document.createElement("div");
  block.className = "cm-typst-diag";

  const message = document.createElement("div");
  message.className = "cm-typst-diag-msg";
  message.textContent = `${diagnostic.severity}: ${diagnostic.message}`;
  block.appendChild(message);

  if (diagnostic.line !== null) {
    const where = document.createElement("div");
    where.className = "cm-typst-diag-loc";
    where.textContent =
      diagnostic.column !== null
        ? `line ${diagnostic.line}, column ${diagnostic.column} of your snippet`
        : `line ${diagnostic.line} of your snippet`;
    block.appendChild(where);

    const text = srcLines[diagnostic.line - 1];
    if (text !== undefined) {
      const pre = document.createElement("pre");
      pre.className = "cm-typst-diag-src";
      pre.textContent = text;
      if (diagnostic.column !== null) {
        const caretCount =
          diagnostic.length !== null && diagnostic.length > 0 ? diagnostic.length : 1;
        const caret = document.createElement("span");
        caret.className = "cm-typst-diag-caret";
        caret.textContent = `\n${" ".repeat(Math.max(diagnostic.column - 1, 0))}${"^".repeat(caretCount)}`;
        pre.appendChild(caret);
      }
      block.appendChild(pre);
    }
  }

  for (const hint of diagnostic.hints) {
    const hintEl = document.createElement("div");
    hintEl.className = "cm-typst-diag-hint";
    hintEl.textContent = `hint: ${hint}`;
    block.appendChild(hintEl);
  }

  tip.appendChild(block);
}

function fillTip(
  badge: HTMLElement,
  tip: HTMLElement,
  entry: PreviewEntry,
  mode: TypstSnippetMode,
  src: string,
): void {
  tip.textContent = "";
  const label = badge.querySelector(".cm-typst-preview-label");
  if (label !== null) {
    label.textContent = entry.ok ? "preview" : "error";
  }
  badge.classList.toggle("cm-typst-preview-has-error", !entry.ok);

  if (entry.ok) {
    const holder = document.createElement("span");
    holder.className = "cm-typst-preview-svg";
    holder.innerHTML = scaleSvgForPreview(entry.body, mode);
    tip.appendChild(holder);
  } else if (entry.diagnostics !== undefined && entry.diagnostics.length > 0) {
    const srcLines = src.split("\n");
    for (const diagnostic of entry.diagnostics) {
      appendDiagnostic(tip, diagnostic, srcLines);
    }
  } else {
    const err = document.createElement("pre");
    err.className = "cm-typst-preview-error";
    err.textContent = entry.body;
    tip.appendChild(err);
  }

  const stamp = document.createElement("div");
  stamp.className = "cm-typst-preview-stamp";
  stamp.textContent = formatStamp(entry.at);
  tip.appendChild(stamp);
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

    const label = document.createElement("span");
    label.className = "cm-typst-preview-label";
    label.textContent = "preview";
    badge.appendChild(label);

    const tip = document.createElement("span");
    tip.className = "cm-typst-preview-tip";
    badge.appendChild(tip);

    const key = this.marker.key;
    const cached = previewCache.get(key);
    if (cached !== undefined) {
      fillTip(badge, tip, cached, this.marker.mode, this.marker.src);
    } else {
      tip.textContent = "compiling\u2026";
      void compileSnippet(this.marker.src, this.marker.mode).then((entry) => {
        if (badge.isConnected) {
          fillTip(badge, tip, entry, this.marker.mode, this.marker.src);
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
    maxWidth: "90vw",
    maxHeight: "70vh",
    overflow: "auto",
    whiteSpace: "nowrap",
    fontSize: "19px",
    boxShadow: "0 2px 8px rgba(43, 40, 34, 0.15)",
  },
  ".cm-typst-preview:hover .cm-typst-preview-tip": {
    display: "block",
  },
  ".cm-typst-preview-svg svg": {
    display: "block",
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
  ".cm-typst-preview-has-error": {
    color: "#a03c28",
    border: "1px solid #a03c28",
    fontWeight: "600",
  },
  ".cm-typst-diag": {
    maxWidth: "420px",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "11px",
    color: "#2b2822",
    whiteSpace: "normal",
  },
  ".cm-typst-diag + .cm-typst-diag": {
    marginTop: "8px",
    paddingTop: "6px",
    borderTop: "1px solid #e3ded2",
  },
  ".cm-typst-diag-msg": {
    color: "#a03c28",
    fontWeight: "600",
    whiteSpace: "pre-wrap",
  },
  ".cm-typst-diag-loc": {
    marginTop: "2px",
    color: "#6f6a5e",
  },
  ".cm-typst-diag-src": {
    margin: "4px 0 0",
    padding: "4px 6px",
    background: "#f1ede2",
    borderRadius: "3px",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "11px",
    whiteSpace: "pre",
    overflowX: "auto",
  },
  ".cm-typst-diag-caret": {
    color: "#a03c28",
    fontWeight: "600",
  },
  ".cm-typst-diag-hint": {
    marginTop: "3px",
    color: "#6f6a5e",
    whiteSpace: "pre-wrap",
  },
  ".cm-typst-preview-stamp": {
    marginTop: "6px",
    paddingTop: "4px",
    borderTop: "1px solid #e3ded2",
    color: "#8a8578",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "10px",
    whiteSpace: "normal",
  },
});

export const typstPreviewExtension: Extension = [
  previewKeysField,
  typstPreviewTheme,
  typstPreviewDecorations,
];
