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
  let selectedIndex = 0;
  let pendingG = false;

  const overlay = document.createElement("div");
  overlay.className = "command-palette-overlay";

  const panel = document.createElement("div");
  panel.className = "command-palette";
  panel.tabIndex = -1;
  overlay.appendChild(panel);

  const rows: HTMLButtonElement[] = [];

  function selectIndex(index: number): void {
    const clamped = Math.max(0, Math.min(commands.length - 1, index));
    rows[selectedIndex]?.classList.remove("is-selected");
    selectedIndex = clamped;
    rows[selectedIndex]?.classList.add("is-selected");
    rows[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }

  function hide(): void {
    isOpen = false;
    overlay.classList.remove("is-open");
  }

  function show(): void {
    isOpen = true;
    pendingG = false;
    overlay.classList.add("is-open");
    rows.forEach((row) => row.classList.remove("is-selected"));
    selectedIndex = 0;
    rows[0]?.classList.add("is-selected");
    panel.focus();
  }

  function activate(command: PaletteCommand): void {
    hide();
    view.focus();
    command.run(view);
  }

  commands.forEach((command, index) => {
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
    row.addEventListener("mouseenter", () => selectIndex(index));
    panel.appendChild(row);
    rows.push(row);
  });

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) {
      hide();
      view.focus();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "g") {
      event.preventDefault();
      if (pendingG) {
        pendingG = false;
        selectIndex(0);
      } else {
        pendingG = true;
      }
      return;
    }
    pendingG = false;

    switch (event.key) {
      case "j":
        event.preventDefault();
        selectIndex(selectedIndex + 1);
        break;
      case "k":
        event.preventDefault();
        selectIndex(selectedIndex - 1);
        break;
      case "G":
        event.preventDefault();
        selectIndex(commands.length - 1);
        break;
      case "Enter": {
        event.preventDefault();
        const command = commands[selectedIndex];
        if (command) {
          activate(command);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        hide();
        view.focus();
        break;
      default:
        break;
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
