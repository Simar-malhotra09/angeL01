import {
  EditorView,
  keymap,
  drawSelection,
  placeholder,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { saveDraft } from "./storage";
import { vim } from "@replit/codemirror-vim";

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

  const extensions: Extension[] = [
    vim(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    placeholder("Start writing..."),
    EditorView.lineWrapping,
    changeListener,
    drawSelection(),
    highlightActiveLine(),
    search(),
    EditorView.theme({ "&": { backgroundColor: "transparent" } }),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions });

  return new EditorView({ state, parent });
}
