import {
  EditorView,
  keymap,
  drawSelection,
  placeholder,
  highlightActiveLine,
  scrollPastEnd,
} from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { saveDraft } from "./storage";
import { vim } from "@replit/codemirror-vim";
import { resolveTypographyInsert } from "./smart-typography";
import { urlHoverTooltip } from "./url-tooltip";

export interface EditorCallbacks {
  onChange: (text: string) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  callbacks: EditorCallbacks,
): EditorView {
  const changeListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return;
    }
    const text = update.state.doc.toString();
    saveDraft(text);
    callbacks.onChange(text);
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
    EditorView.theme({ "&": { backgroundColor: "transparent" } }),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions });

  return new EditorView({ state, parent });
}
