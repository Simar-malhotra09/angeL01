import "./style.css";
import { createEditor } from "./editor/editor";
import { getText, getDocID, Status } from "./storage";
import { countWords, formatWordCount } from "./word-count";
import { createToc, type Toc } from "./toc";
import { exportDocumentAsHtml } from "./export";
import { parseHeading } from "./markdown/headings";
import { stripInlineMarkdown } from "./markdown/markdown-to-html";
import { getHighlightRecords } from "./highlights/highlight-store";
import {
  createHighlightSidebar,
  type HighlightSidebar,
} from "./highlights/highlight-sidebar";

function titleFromContent(content: string): string {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0);
  if (!firstLine) {
    return "";
  }
  return stripInlineMarkdown(parseHeading(firstLine)?.text ?? firstLine).trim();
}

async function main(): Promise<void> {
  const shell = document.getElementById("editor-shell");
  const wordCountEl = document.getElementById("word-count");
  const tocEl = document.getElementById("toc");
  const exportButton = document.getElementById("export-button");
  const copyButton = document.getElementById("copy-button");
  const docTitleEl = document.querySelector<HTMLInputElement>("#doc-title");
  const highlightPanelEl = document.getElementById("highlight-panel");
  const widthRangeEl = document.querySelector<HTMLInputElement>("#width-range");

  if (
    !shell ||
    !wordCountEl ||
    !tocEl ||
    !exportButton ||
    !copyButton ||
    !docTitleEl ||
    !highlightPanelEl ||
    !widthRangeEl
  ) {
    throw new Error(
      "Missing required DOM mount points: #editor-shell, #word-count, #toc, #export-button, #copy-button, #doc-title, #highlight-panel, and/or #width-range",
    );
  }

  const id = getDocID();
  const doc = await getText(id);
  const initialDoc = doc?.content ?? "";
  const initialHighlights = await getHighlightRecords(id);

  wordCountEl.textContent = formatWordCount(countWords(initialDoc));

  const savedTitle = doc?.title?.trim() ?? "";
  const autoTitle = titleFromContent(initialDoc);
  let titleIsExplicit =
    savedTitle.length > 0 && savedTitle !== (autoTitle || "untitled");

  docTitleEl.value =
    savedTitle.length > 0 ? savedTitle : autoTitle || "untitled";

  docTitleEl.addEventListener("input", () => {
    titleIsExplicit = true;
  });

  docTitleEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      docTitleEl.blur();
    }
  });

  let toc: Toc | null = null;
  let highlightSidebar: HighlightSidebar | null = null;

  const view = createEditor(
    shell,
    initialDoc,
    initialHighlights,
    doc?.createdAt ?? Date.now(),
    doc?.status ?? Status.Draft,
    {
      onChange: (text) => {
        wordCountEl.textContent = formatWordCount(countWords(text));
        if (!titleIsExplicit) {
          docTitleEl.value = titleFromContent(text) || "untitled";
        }
      },
      onUpdate: (update) => {
        toc?.update();
        highlightSidebar?.update();
        if (update.selectionSet) {
          const { state } = update;
          for (const range of state.selection.ranges) {
            const count =
              range.from === range.to
                ? countWords(state.doc.toString())
                : countWords(state.sliceDoc(range.from, range.to));
            wordCountEl.textContent = formatWordCount(count);
          }
        }
      },
      getTitle: () => {
        const title = docTitleEl.value.trim();
        return title.length > 0 ? title : "untitled";
      },
    },
  );

  toc = createToc(tocEl, view);
  highlightSidebar = createHighlightSidebar(highlightPanelEl, view);

  let scrollUpdateScheduled = false;
  const scheduleHighlightUpdate = (): void => {
    if (scrollUpdateScheduled) {
      return;
    }
    scrollUpdateScheduled = true;
    requestAnimationFrame(() => {
      scrollUpdateScheduled = false;
      highlightSidebar?.update();
    });
  };
  view.scrollDOM.addEventListener("scroll", scheduleHighlightUpdate);
  window.addEventListener("resize", scheduleHighlightUpdate);

  // keep the centred text column clear of the fixed sidebars: the toc needs
  // 220px on the left (40 offset + 180 wide) and the highlight panel 240px
  // on the right, plus 80px of breathing room. Below 1100px the sidebars
  // are hidden, so nothing is reserved.
  const sliderMin = Number(widthRangeEl.min);
  const sliderMax = Number(widthRangeEl.max);
  const SIDEBAR_RESERVE = Math.max(40 + 180, 40 + 200) * 2 + 80;
  const allowedMaxWidth = (): number =>
    window.innerWidth < 1100
      ? sliderMax
      : Math.min(sliderMax, window.innerWidth - SIDEBAR_RESERVE);

  const storedWidth = Number(localStorage.getItem("angel01-editor-width"));
  if (storedWidth > 0) {
    widthRangeEl.value = String(
      Math.min(sliderMax, Math.max(sliderMin, storedWidth)),
    );
  }
  const applyWidth = (): void => {
    // cap the slider itself so it never offers a width that would collide
    widthRangeEl.max = String(allowedMaxWidth());
    shell.style.maxWidth = `${Math.max(sliderMin, Number(widthRangeEl.value))}px`;
  };
  applyWidth();
  widthRangeEl.addEventListener("input", () => {
    applyWidth();
    localStorage.setItem("angel01-editor-width", widthRangeEl.value);
  });
  window.addEventListener("resize", applyWidth);

  exportButton.addEventListener("click", () => {
    const title = docTitleEl.value.trim();
    void exportDocumentAsHtml(view, title.length > 0 ? title : "untitled");
  });

  copyButton.addEventListener("click", () => {
    void navigator.clipboard.writeText(view.state.doc.toString()).then(() => {
      const original = copyButton.textContent;
      copyButton.textContent = "Copied!";
      setTimeout(() => {
        copyButton.textContent = original;
      }, 1500);
    });
  });

  view.focus();
}

void main();
