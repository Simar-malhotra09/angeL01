import type { Command } from "@codemirror/view";
import { toggleBold, toggleItalic, makeToggleHeading, insertLink } from "./formatting-commands";

export interface PaletteCommand {
  id: string;
  label: string;
  keys: string;
  run: Command;
}

export function createPaletteCommands(fileInput: HTMLInputElement): PaletteCommand[] {
  return [
    { id: "bold", label: "Bold", keys: "Mod-b", run: toggleBold },
    { id: "italic", label: "Italic", keys: "Mod-i", run: toggleItalic },
    { id: "heading-1", label: "Heading 1", keys: "Mod-Alt-1", run: makeToggleHeading(1) },
    { id: "heading-2", label: "Heading 2", keys: "Mod-Alt-2", run: makeToggleHeading(2) },
    { id: "heading-3", label: "Heading 3", keys: "Mod-Alt-3", run: makeToggleHeading(3) },
    { id: "insert-link", label: "Insert Link", keys: "Mod-Alt-k", run: insertLink },
    {
      id: "insert-image",
      label: "Insert Image",
      keys: "Mod-Shift-m",
      run: () => {
        fileInput.click();
        return true;
      },
    },
  ];
}
