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
import { saveDraft, putText} from "../storage";
import { Vim, vim, getCM} from "@replit/codemirror-vim";
import { resolveTypographyInsert } from "../markdown/smart-typography";
import { urlHoverTooltip, findLinkAt } from "../tooltip/url-tooltip";
import { markdownDecorations } from "./formatting-decorations";
import { imageHoverTooltip } from "../tooltip/image-tooltip";
import { insertImageFile } from "../image/image-insert";
import { generateImageId} from "../image/image-format.ts";
import { isSupportedImageType, IMAGE_FILE_ACCEPT } from "../image/image-format";
import { createPaletteCommands } from "./commands";
import { createCommandPalette, type CommandPalette } from "./command-palette";

export interface EditorCallbacks {
  onChange: (text: string) => void;
  onUpdate: (update: ViewUpdate) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  callbacks: EditorCallbacks,
): EditorView {

  const id = generateImageId();
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

  const paletteCommands = createPaletteCommands(fileInput);
  let palette: CommandPalette | null = null;

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

  Vim.defineEx("save", "sa", (cm) => {
    console.log("[INFO]: Saving to indexedDB!");

    const text = "Getting for indexedDB: " + cm.getValue();

    putText(id, text);
  });

  const extensions: Extension[] = [
    vim(),
    history(),
    keymap.of([
      ...paletteCommands.map((command) => ({ key: command.keys, run: command.run })),
      {
        key: "Mod-Shift-p",
        run: () => {
          palette?.toggle();
          return true;
        },
      },
    ]),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    placeholder("You mustn't run away..."),
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
      click: (event, view) => {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) {
          return false;
        }
        const line = view.state.doc.lineAt(pos);
        const link = findLinkAt(line.text, line.from, pos);
        if (link === null) {
          return false;
        }
        event.preventDefault();
        window.open(link.url, "_blank", "noopener,noreferrer");
        return true;
      }
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
  palette = createCommandPalette(view, paletteCommands);

  return view;
}
