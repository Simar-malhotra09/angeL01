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
import { saveDraft, putText, pushDoc, type Doc } from "../storage";
import { Vim, vim, getCM} from "@replit/codemirror-vim";
import { resolveTypographyInsert } from "../markdown/smart-typography";
import { urlHoverTooltip, findLinkAt } from "../tooltip/url-tooltip";
import { markdownDecorations } from "./formatting-decorations";
import { imageHoverTooltip } from "../tooltip/image-tooltip";
import { imageEmbed } from "./image-embed";
import { insertImageFile } from "../image/image-insert";
import { getDocID } from "../storage";
import { isSupportedImageType, IMAGE_FILE_ACCEPT } from "../image/image-format";
import { createPaletteCommands } from "./commands";
import { createCommandPalette, type CommandPalette } from "./command-palette";
import {
  getHighlights,
  hasHighlightEffect,
  highlightDecorations,
  highlightField,
  loadHighlightsEffect,
  type Highlight,
} from "../highlights/highlight-field";
import { putHighlightRecords } from "../highlights/highlight-store";

export interface EditorCallbacks {
  onChange: (text: string) => void;
  onUpdate: (update: ViewUpdate) => void;
  getTitle: () => string;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  initialHighlights: readonly Highlight[],
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

  const paletteCommands = createPaletteCommands(fileInput);
  let palette: CommandPalette | null = null;

  let bufferTimeout: ReturnType<typeof setTimeout> | null = null;
  const BUFFER_DEBOUNCE_MS = 1500;

  let highlightBufferTimeout: ReturnType<typeof setTimeout> | null = null;

  const changeListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const text = update.state.doc.toString();
      saveDraft(text);
      callbacks.onChange(text);

      if (bufferTimeout !== null) {
        clearTimeout(bufferTimeout);
      }
      bufferTimeout = setTimeout(() => {
        const docID = getDocID();
        const now = Date.now();
        putText(docID, {
          id: docID,
          title: callbacks.getTitle(),
          content: text,
          createdAt: now,
          updatedAt: now,
        });
      }, BUFFER_DEBOUNCE_MS);
    }

    const highlightsTouched =
      update.docChanged || update.transactions.some((tr) => hasHighlightEffect(tr.effects));
    if (highlightsTouched) {
      if (highlightBufferTimeout !== null) {
        clearTimeout(highlightBufferTimeout);
      }
      highlightBufferTimeout = setTimeout(() => {
        void putHighlightRecords(getDocID(), getHighlights(update.state));
      }, BUFFER_DEBOUNCE_MS);
    }

    if (
      update.docChanged ||
      update.selectionSet ||
      update.transactions.some((tr) => hasHighlightEffect(tr.effects))
    ) {
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

  function saveDoc(cm: { getValue: () => string }): Doc {
    const docID = getDocID();
    const now = Date.now();
    const doc: Doc = {
      id: docID,
      title: callbacks.getTitle(),
      content: cm.getValue(),
      createdAt: now,
      updatedAt: now,
    };

    if (bufferTimeout !== null) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }

    putText(docID, doc);
    void pushDoc(doc);
    return doc;
  }

  Vim.defineEx("write", "w", (cm) => {
    saveDoc(cm);
  });

  Vim.defineEx("quit", "q", (cm) => {
    saveDoc(cm);
    window.location.href = "/";
  });

  Vim.defineEx("wq", "wq", (cm) => {
    saveDoc(cm);
    window.location.href = "/";
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
    imageEmbed,
    highlightField,
    highlightDecorations,
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
        const vimState = getCM(view)?.state.vim;
        const inNormalMode = !vimState || (!vimState.insertMode && !vimState.visualMode);
        if (!inNormalMode) {
          return false;
        }
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

  if (initialHighlights.length > 0) {
    view.dispatch({ effects: loadHighlightsEffect.of(initialHighlights) });
  }

  return view;
}
