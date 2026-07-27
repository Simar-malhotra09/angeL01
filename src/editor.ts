import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { saveDraft } from "./storage";

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
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    placeholder("Start writing..."),
    EditorView.lineWrapping,
    changeListener,
    EditorView.theme({ "&": { backgroundColor: "transparent" } }),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions });

  return new EditorView({ state, parent });
}
