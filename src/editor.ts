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
import { imageHoverTooltip } from "./image-tooltip";
import { insertImageFile } from "./image-insert";
import { isSupportedImageType, IMAGE_FILE_ACCEPT } from "./image-format";

export interface EditorCallbacks {
  onChange: (text: string) => void;
  onUpdate: (update: ViewUpdate) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  callbacks: EditorCallbacks,
): EditorView {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = IMAGE_FILE_ACCEPT;
  fileInput.style.display = "none";
  parent.appendChild(fileInput);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) {
      void insertImageFile(view, file, view.state.selection.main.head);
    }
  });

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
      {
        key: "Mod-Shift-i",
        run: () => {
          fileInput.click();
          return true;
        },
      },
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
    imageHoverTooltip,
    smartTypographyHandler,
    markdownDecorations,
    EditorView.domEventHandlers({
      paste: (event, view) => {
        const file = event.clipboardData?.files[0];
        if (!file || !isSupportedImageType(file.type)) {
          return false;
        }
        event.preventDefault();
        void insertImageFile(view, file, view.state.selection.main.head);
        return true;
      },
      dragover: (event) => {
        if (event.dataTransfer?.types.includes("Files")) {
          event.preventDefault();
        }
      },
      drop: (event, view) => {
        const file = event.dataTransfer?.files[0];
        if (!file || !isSupportedImageType(file.type)) {
          return false;
        }
        event.preventDefault();
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        void insertImageFile(view, file, pos ?? view.state.selection.main.head);
        return true;
      },
    }),
    EditorView.contentAttributes.of({
      spellcheck: "true",
      autocapitalize: "sentences",
      lang: "en",
    }),
    EditorView.theme({ "&": { backgroundColor: "transparent" } }),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions });

  const view = new EditorView({ state, parent });
  return view;
}
