import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { bucketLabel } from "./buckets";
import {
  getHighlights,
  removeHighlightEffect,
  updateHighlightNoteEffect,
  type Highlight,
} from "./highlight-field";

const TOP_BOUND_VH = 14;
const BOTTOM_MARGIN_PX = 80;
const CARD_GAP_PX = 8;
const SNIPPET_MAX_LENGTH = 90;

export interface HighlightSidebar {
  update: () => void;
}

function truncate(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > SNIPPET_MAX_LENGTH
    ? `${collapsed.slice(0, SNIPPET_MAX_LENGTH)}…`
    : collapsed;
}

export function createHighlightSidebar(container: HTMLElement, view: EditorView): HighlightSidebar {
  function jumpTo(pos: number): void {
    view.dispatch({ selection: EditorSelection.cursor(pos), scrollIntoView: true });
    view.focus();
  }

  function remove(id: string): void {
    view.dispatch({ effects: removeHighlightEffect.of(id) });
  }

  function commitNote(id: string, value: string): void {
    view.dispatch({ effects: updateHighlightNoteEffect.of({ id, note: value.trim() }) });
  }

  function startNoteEdit(card: HTMLElement, highlight: Highlight): void {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "highlight-card-note-input";
    input.value = highlight.note ?? "";
    input.placeholder = "Add a note…";
    const body = card.querySelector(".highlight-card-snippet, .highlight-card-note");
    body?.replaceWith(input);
    input.focus();

    let cancelled = false;
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        commitNote(highlight.id, input.value);
      } else if (event.key === "Escape") {
        cancelled = true;
        render();
        return;
      }
      event.stopPropagation();
    });
    input.addEventListener("blur", () => {
      if (!cancelled) {
        commitNote(highlight.id, input.value);
      }
    });
  }

  function render(): void {
    const highlights = getHighlights(view.state);
    container.replaceChildren();

    if (highlights.length === 0) {
      return;
    }

    const topBound = window.innerHeight * (TOP_BOUND_VH / 100);
    const bottomBound = window.innerHeight - BOTTOM_MARGIN_PX;

    const visible: { highlight: Highlight; top: number }[] = [];
    for (const highlight of highlights) {
      const coords = view.coordsAtPos(highlight.from);
      if (!coords || coords.top < topBound || coords.top > bottomBound) {
        continue;
      }
      visible.push({ highlight, top: coords.top });
    }

    visible.sort((a, b) => a.top - b.top);

    let prevBottom = -Infinity;
    for (const { highlight, top } of visible) {
      const card = document.createElement("div");
      card.className = "highlight-card";
      card.style.top = `${Math.max(top, prevBottom + CARD_GAP_PX)}px`;

      const label = document.createElement("span");
      label.className = "highlight-card-label";
      label.textContent = bucketLabel(highlight.bucket);

      const body = document.createElement("p");
      if (highlight.note !== undefined) {
        body.className = "highlight-card-note";
        body.textContent = highlight.note;
      } else {
        body.className = "highlight-card-snippet";
        body.textContent = truncate(view.state.sliceDoc(highlight.from, highlight.to));
      }

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "highlight-card-edit";
      editButton.textContent = "✎";
      editButton.setAttribute("aria-label", "Edit note");
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startNoteEdit(card, highlight);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "highlight-card-remove";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", "Remove highlight");
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        remove(highlight.id);
      });

      card.append(label, body, editButton, removeButton);
      card.addEventListener("click", () => jumpTo(highlight.from));
      container.appendChild(card);

      prevBottom = card.offsetTop + card.offsetHeight;
    }
  }

  render();

  return { update: render };
}
