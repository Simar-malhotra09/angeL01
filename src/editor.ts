import {
  EditorView,
  keymap,
  drawSelection,
  placeholder,
  highlightActiveLine,
  scrollPastEnd,
  type ViewUpdate,
} from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { saveDraft } from "./storage";
import { vim } from "@replit/codemirror-vim";
import { resolveTypographyInsert } from "./smart-typography";
import { urlHoverTooltip } from "./url-tooltip";
import { toggleBold, toggleItalic, makeToggleHeading } from "./formatting-commands";
import { markdownDecorations } from "./formatting-decorations";

export interface EditorCallbacks {
  onChange: (text: string) => void;
  onUpdate: (update: ViewUpdate) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  callbacks: EditorCallbacks,
): EditorView {
  const changeListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const text = update.state.doc.toString();
      saveDraft(text);
      callbacks.onChange(text);
    }
    if (update.docChanged || update.selectionSet) {
      callbacks.onUpdate(update);
    }
  });

  const smartTypographyHandler = EditorView.inputHandler.of((view, from, to, text) => {
    if (from !== to || text.length !== 1) {
      return false;
    }
    const docBefore = view.state.doc.sliceString(0, from);
    const replacement = resolveTypographyInsert(docBefore, from, text);
    if (replacement === null) {
      return false;
    }
    view.dispatch({
      changes: { from: replacement.from, to: replacement.to, insert: replacement.text },
      selection: { anchor: replacement.from + replacement.text.length },
      userEvent: "input.type",
    });
    return true;
  });

  const extensions: Extension[] = [
    vim(),
    history(),
    keymap.of([
      { key: "Mod-b", run: toggleBold },
      { key: "Mod-i", run: toggleItalic },
      { key: "Mod-Alt-1", run: makeToggleHeading(1) },
      { key: "Mod-Alt-2", run: makeToggleHeading(2) },
      { key: "Mod-Alt-3", run: makeToggleHeading(3) },
    ]),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    placeholder("Start writing..."),
    EditorView.lineWrapping,
    changeListener,
    drawSelection(),
    highlightActiveLine(),
    scrollPastEnd(),
    search(),
    urlHoverTooltip,
    smartTypographyHandler,
    markdownDecorations,
    EditorView.contentAttributes.of({
      spellcheck: "true",
      autocapitalize: "sentences",
      lang: "en",
    }),
    EditorView.theme({ "&": { backgroundColor: "transparent" } }),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions });

  return new EditorView({ state, parent });
}
