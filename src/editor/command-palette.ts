import type { EditorView } from "@codemirror/view";
import type { PaletteCommand, PaletteTab } from "./commands";

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

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function formatKeyLabel(keys: string): string {
  const parts = keys.split("-");
  const key = parts.pop() ?? "";
  if (isMac) {
    return [
      ...parts.map((mod) => MAC_MODIFIER_SYMBOLS[mod] ?? mod),
      key.toUpperCase(),
    ].join("");
  }
  return [
    ...parts.map((mod) => OTHER_MODIFIER_NAMES[mod] ?? mod),
    key.toUpperCase(),
  ].join("+");
}

export interface CommandPalette {
  toggle: () => void;
}

type PaletteEntry = PaletteCommand | PaletteTab;

type CommandRow = { kind: "command"; command: PaletteCommand };
type TabRow = { kind: "tab"; tab: PaletteTab };
type Row = CommandRow | TabRow;

export function createCommandPalette(
  view: EditorView,
  entries: PaletteEntry[],
): CommandPalette {
  let isOpen = false;
  let selectedIndex = 0;
  let pendingG = false;
  let activeTab: PaletteTab | null = null;
  let mainSelectedIndex = 0;

  let rows: HTMLButtonElement[] = [];
  let currentRows: Row[] = [];

  const overlay = document.createElement("div");
  overlay.className = "command-palette-overlay";

  const panel = document.createElement("div");
  panel.className = "command-palette";
  panel.tabIndex = -1;
  overlay.appendChild(panel);

  function items(): Row[] {
    if (activeTab !== null) {
      return activeTab.commands.map((command) => ({
        kind: "command",
        command,
      }));
    }
    return entries.map((entry): Row =>
      "commands" in entry
        ? { kind: "tab", tab: entry }
        : { kind: "command", command: entry },
    );
  }

  function render(): void {
    panel.replaceChildren();
    currentRows = items();
    const rowElements: HTMLButtonElement[] = [];

    currentRows.forEach((item, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "command-palette-row";
      if (item.kind === "tab") {
        row.classList.add("command-palette-row-tab");
      }

      const label = document.createElement("span");
      label.className = "command-palette-label";
      label.textContent =
        item.kind === "tab" ? item.tab.label : item.command.label;

      const keys = document.createElement("span");
      keys.className = "command-palette-keys";
      keys.textContent =
        item.kind === "tab" ? "↗" : formatKeyLabel(item.command.keys);

      row.append(label, keys);
      row.addEventListener("click", () => activate(item));
      row.addEventListener("mouseenter", () => selectIndex(index));
      panel.appendChild(row);
      rowElements.push(row);
    });

    rows = rowElements;
  }

  function selectIndex(index: number): void {
    const clamped = Math.max(0, Math.min(currentRows.length - 1, index));
    rows[selectedIndex]?.classList.remove("is-selected");
    selectedIndex = clamped;
    rows[selectedIndex]?.classList.add("is-selected");
    rows[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }

  function renderSelect(index: number): void {
    render();
    selectedIndex = Math.max(0, Math.min(currentRows.length - 1, index));
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
    activeTab = null;
    renderSelect(0);
    panel.focus();
  }

  function openTab(tab: PaletteTab): void {
    mainSelectedIndex = selectedIndex;
    activeTab = tab;
    renderSelect(0);
    panel.focus();
  }

  function backToMain(): void {
    activeTab = null;
    renderSelect(mainSelectedIndex);
    panel.focus();
  }

  function activate(item: Row): void {
    if (item.kind === "tab") {
      openTab(item.tab);
      return;
    }
    hide();
    view.focus();
    item.command.run(view);
  }

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) {
      hide();
      view.focus();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        if (activeTab !== null) {
          backToMain();
        }
      } else {
        const item = currentRows[selectedIndex];
        if (item?.kind === "tab") {
          openTab(item.tab);
        }
      }
      return;
    }

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
        selectIndex(currentRows.length - 1);
        break;
      case "Enter": {
        event.preventDefault();
        const item = currentRows[selectedIndex];
        if (item) {
          activate(item);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        if (activeTab !== null) {
          backToMain();
        } else {
          hide();
          view.focus();
        }
        break;
      default:
        break;
    }
  });

  render();
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
