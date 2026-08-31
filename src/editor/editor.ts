import {
  EditorView,
  keymap,
  drawSelection,
  placeholder,
  highlightActiveLine,
  scrollPastEnd,
  type ViewUpdate,
} from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { saveDraft, putText, pushDoc, Status, type Doc } from "../storage";
import { Vim, vim, getCM } from "@replit/codemirror-vim";
import { resolveTypographyInsert } from "../markdown/smart-typography";
import { urlHoverTooltip, findLinkAt } from "../tooltip/url-tooltip";
import { markdownDecorations } from "./formatting-decorations";
import { imageHoverTooltip } from "../tooltip/image-tooltip";
import { imageEmbed } from "./image-embed";
import {
  typstPreviewExtension,
  setTypstPreviews,
  currentTypstKeys,
} from "../tooltip/typst-preview";
import { insertImageFile } from "../image/image-insert";
import { getDocID } from "../storage";
import { isSupportedImageType, IMAGE_FILE_ACCEPT } from "../image/image-format";
import { createPaletteCommands, PaletteCommand } from "./commands";
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

type InputLang = "en" | "ja";

const INPUT_LANG_ATTRIBUTES: Record<InputLang, Record<string, string>> = {
  en: {
    spellcheck: "true",
    autocapitalize: "sentences",
    lang: "en",
  },
  ja: {
    spellcheck: "false",
    autocapitalize: "none",
    lang: "ja",
  },
};

// Manual override for testing Japanese input. Either flip this to "ja",
// or toggle live in the editor with Mod-Shift-l.
const DEFAULT_INPUT_LANG: InputLang = "en";

export interface EditorCallbacks {
  onChange: (text: string) => void;
  onUpdate: (update: ViewUpdate) => void;
  getTitle: () => string;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  initialHighlights: readonly Highlight[],
  createdAt: number,
  initialStatus: Status,
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

  const paletteEntries = createPaletteCommands(fileInput);
  const allPaletteCommands: PaletteCommand[] = paletteEntries.flatMap((entry) =>
    "commands" in entry ? entry.commands : [entry],
  );
  let palette: CommandPalette | null = null;

  let bufferTimeout: ReturnType<typeof setTimeout> | null = null;
  const BUFFER_DEBOUNCE_MS = 1500;

  let syncTimeout: ReturnType<typeof setTimeout> | null = null;
  const SYNC_DEBOUNCE_MS = 5000;

  let highlightBufferTimeout: ReturnType<typeof setTimeout> | null = null;

  let dirty = false;

  const inputLangCompartment = new Compartment();
  let inputLang: InputLang = DEFAULT_INPUT_LANG;

  const changeListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const text = update.state.doc.toString();
      saveDraft(text);
      callbacks.onChange(text);
      dirty = true;

      if (bufferTimeout !== null) {
        clearTimeout(bufferTimeout);
      }
      bufferTimeout = setTimeout(() => {
        const docID = getDocID();
        putText(docID, {
          id: docID,
          title: callbacks.getTitle(),
          content: text,
          createdAt,
          updatedAt: Date.now(),
          status: initialStatus,
        });
      }, BUFFER_DEBOUNCE_MS);

      if (syncTimeout !== null) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(() => {
        const docID = getDocID();
        dirty = false;
        pushDoc(
          {
            id: docID,
            title: callbacks.getTitle(),
            content: text,
            createdAt,
            updatedAt: Date.now(),
            status: initialStatus,
          },
          false,
        ).catch((error: unknown) => {
          console.error(`Failed to autosync doc ${docID} to server`, error);
          dirty = true;
        });
      }, SYNC_DEBOUNCE_MS);
    }

    const highlightsTouched =
      update.docChanged ||
      update.transactions.some((tr) => hasHighlightEffect(tr.effects));
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

  const smartTypographyHandler = EditorView.inputHandler.of(
    (view, from, to, text) => {
      if (from !== to || text.length !== 1) {
        return false;
      }
      const docBefore = view.state.doc.sliceString(0, from);
      const replacement = resolveTypographyInsert(docBefore, from, text);
      if (replacement === null) {
        return false;
      }
      view.dispatch({
        changes: {
          from: replacement.from,
          to: replacement.to,
          insert: replacement.text,
        },
        selection: { anchor: replacement.from + replacement.text.length },
        userEvent: "input.type",
      });
      return true;
    },
  );

  async function saveDoc(cm: { getValue: () => string }): Promise<Doc> {
    const docID = getDocID();
    const content = cm.getValue();
    const doc: Doc = {
      id: docID,
      title: callbacks.getTitle(),
      content,
      createdAt,
      updatedAt: Date.now(),
      status: initialStatus,
    };
    setTypstPreviews(view, currentTypstKeys(content));

    if (bufferTimeout !== null) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
    if (syncTimeout !== null) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }

    await putText(docID, doc);
    dirty = false;
    try {
      await pushDoc(doc, false);
    } catch (error) {
      console.error(
        `Failed to sync doc ${docID} to server; edit is still saved locally`,
        error,
      );
      dirty = true;
    }
    return doc;
  }

  Vim.defineEx("write", "w", (cm) => {
    void saveDoc(cm);
  });

  Vim.defineEx("quit", "q", (cm) => {
    void saveDoc(cm).then(() => {
      window.location.href = "/";
    });
  });

  Vim.defineEx("wq", "wq", (cm) => {
    void saveDoc(cm).then(() => {
      window.location.href = "/";
    });
  });

  const extensions: Extension[] = [
    vim(),
    history(),
    keymap.of([
      ...allPaletteCommands.map((command) => ({
        key: command.keys,
        run: command.run,
      })),
      {
        key: "Mod-Shift-p",
        run: () => {
          palette?.toggle();
          return true;
        },
      },
      {
        key: "Mod-Shift-l",
        run: () => {
          inputLang = inputLang === "en" ? "ja" : "en";
          view.dispatch({
            effects: inputLangCompartment.reconfigure(
              EditorView.contentAttributes.of(INPUT_LANG_ATTRIBUTES[inputLang]),
            ),
          });
          console.log(`Input language: ${inputLang}`);
          return true;
        },
      },
    ]),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
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
    typstPreviewExtension,
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
        const inNormalMode =
          !vimState || (!vimState.insertMode && !vimState.visualMode);
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
      },
    }),
    inputLangCompartment.of(
      EditorView.contentAttributes.of(INPUT_LANG_ATTRIBUTES[inputLang]),
    ),
    EditorView.theme({ "&": { backgroundColor: "transparent" } }),
  ];

  const state = EditorState.create({ doc: initialDoc, extensions });

  const view = new EditorView({ state, parent });
  palette = createCommandPalette(view, paletteEntries);

  if (initialHighlights.length > 0) {
    view.dispatch({ effects: loadHighlightsEffect.of(initialHighlights) });
  }

  const initialTypstKeys = currentTypstKeys(initialDoc);
  if (initialTypstKeys.size > 0) {
    setTypstPreviews(view, initialTypstKeys);
  }

  function flushPending(): void {
    if (!dirty) {
      return;
    }
    dirty = false;
    const docID = getDocID();
    const doc: Doc = {
      id: docID,
      title: callbacks.getTitle(),
      content: view.state.doc.toString(),
      createdAt,
      updatedAt: Date.now(),
      status: initialStatus,
    };
    putText(docID, doc);
    pushDoc(doc, true).catch((error: unknown) => {
      console.error(`Failed to flush doc ${docID} to server on exit`, error);
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPending();
    }
  });
  window.addEventListener("pagehide", flushPending);

  return view;
}
