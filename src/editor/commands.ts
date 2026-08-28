import { EditorSelection } from "@codemirror/state";
import type { Command } from "@codemirror/view";
import {
  toggleBold,
  toggleItalic,
  makeToggleHeading,
  insertLink,
} from "./formatting-commands";
import { BUCKETS, type BucketId } from "../highlights/buckets";
import {
  addHighlightEffect,
  findHighlightAt,
  removeHighlightEffect,
} from "../highlights/highlight-field";

export interface PaletteCommand {
  id: string;
  label: string;
  keys: string;
  run: Command;
}

export interface PaletteTab {
  label: string;
  commands: PaletteCommand[];
}

function highlightSelection(bucket: BucketId): Command {
  return (view) => {
    const range = view.state.selection.main;
    if (range.empty) {
      return false;
    }
    view.dispatch({
      effects: addHighlightEffect.of({
        id: crypto.randomUUID(),
        from: range.from,
        to: range.to,
        bucket,
        createdAt: Date.now(),
      }),
      selection: EditorSelection.cursor(range.from),
    });
    return true;
  };
}

const removeHighlight: Command = (view) => {
  const highlight = findHighlightAt(view.state, view.state.selection.main.head);
  if (!highlight) {
    return false;
  }
  view.dispatch({ effects: removeHighlightEffect.of(highlight.id) });
  return true;
};

function highlightPaletteCommands(): PaletteCommand[] {
  const bucketCommands = BUCKETS.map((bucket, index) => ({
    id: `highlight-${bucket.id}`,
    label: `Highlight: ${bucket.label}`,
    keys: `Mod-Alt-Shift-${index + 1}`,
    run: highlightSelection(bucket.id),
  }));
  return [
    ...bucketCommands,
    {
      id: "highlight-remove",
      label: "Remove Highlight",
      keys: "Mod-Alt-Shift-0",
      run: removeHighlight,
    },
  ];
}

export function createPaletteCommands(
  fileInput: HTMLInputElement,
): (PaletteCommand | PaletteTab)[] {
  return [
    { id: "bold", label: "Bold", keys: "Mod-b", run: toggleBold },
    { id: "italic", label: "Italic", keys: "Mod-i", run: toggleItalic },
    {
      id: "heading-1",
      label: "Heading 1",
      keys: "Mod-Alt-1",
      run: makeToggleHeading(1),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      keys: "Mod-Alt-2",
      run: makeToggleHeading(2),
    },
    {
      id: "heading-3",
      label: "Heading 3",
      keys: "Mod-Alt-3",
      run: makeToggleHeading(3),
    },
    {
      id: "insert-link",
      label: "Insert Link",
      keys: "Mod-Alt-k",
      run: insertLink,
    },
    {
      id: "insert-image",
      label: "Insert Image",
      keys: "Mod-Shift-m",
      run: () => {
        fileInput.click();
        return true;
      },
    },
    { label: "Highlights", commands: highlightPaletteCommands() },
  ];
}
