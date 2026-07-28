import type { EditorView } from "@codemirror/view";
import type { PaletteCommand } from "./commands";

const MAC_MODIFIER_SYMBOLS: Record<string, string> = {
  Mod: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Ctrl: "⌃",
};

const OTHER_MODIFIER_NAMES: Record<string, string> = {
  Mod: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Ctrl: "Ctrl",
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function formatKeyLabel(keys: string): string {
  const parts = keys.split("-");
  const key = parts.pop() ?? "";
  if (isMac) {
    return [...parts.map((mod) => MAC_MODIFIER_SYMBOLS[mod] ?? mod), key.toUpperCase()].join("");
  }
  return [...parts.map((mod) => OTHER_MODIFIER_NAMES[mod] ?? mod), key.toUpperCase()].join("+");
}

export interface CommandPalette {
  toggle: () => void;
}

export function createCommandPalette(view: EditorView, commands: PaletteCommand[]): CommandPalette {
  let isOpen = false;

  const overlay = document.createElement("div");
  overlay.className = "command-palette-overlay";

  const panel = document.createElement("div");
  panel.className = "command-palette";
  overlay.appendChild(panel);

  function hide(): void {
    isOpen = false;
    overlay.classList.remove("is-open");
  }

  function show(): void {
    isOpen = true;
    overlay.classList.add("is-open");
  }

  function activate(command: PaletteCommand): void {
    hide();
    view.focus();
    command.run(view);
  }

  for (const command of commands) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "command-palette-row";

    const label = document.createElement("span");
    label.className = "command-palette-label";
    label.textContent = command.label;

    const keys = document.createElement("span");
    keys.className = "command-palette-keys";
    keys.textContent = formatKeyLabel(command.keys);

    row.append(label, keys);
    row.addEventListener("click", () => activate(command));
    panel.appendChild(row);
  }

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) {
      hide();
      view.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      hide();
      view.focus();
    }
  });

  document.body.appendChild(overlay);

  function toggle(): void {
    if (isOpen) {
      hide();
      view.focus();
    } else {
      show();
    }
  }

  return { toggle };
}
