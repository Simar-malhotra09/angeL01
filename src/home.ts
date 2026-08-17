import "./style.css";
import {
  deleteDoc,
  listDocs,
  reconcileStatus,
  setStatus,
  STATUS_LABELS,
  ALL_STATUSES,
  Status,
  type DocSummary,
} from "./storage";
import { stripInlineMarkdown } from "./markdown/markdown-to-html";

function formatUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function openDoc(doc: DocSummary): void {
  window.location.href = `/doc/${doc.id}`;
}

function createDocContextMenu(onDelete: (doc: DocSummary) => void): {
  open: (doc: DocSummary, x: number, y: number) => void;
} {
  const menu = document.createElement("div");
  menu.className = "doc-context-menu";

  const deleteRow = document.createElement("button");
  deleteRow.type = "button";
  deleteRow.className = "doc-context-menu-row doc-context-menu-delete";
  deleteRow.textContent = "Delete";
  menu.appendChild(deleteRow);

  document.body.appendChild(menu);

  let target: DocSummary | null = null;

  function close(): void {
    menu.classList.remove("is-open");
    target = null;
  }

  deleteRow.addEventListener("click", () => {
    if (
      target &&
      confirm(
        `Delete "${target.title.trim() || "untitled"}"? This cannot be undone.`,
      )
    ) {
      onDelete(target);
    }
    close();
  });

  document.addEventListener("mousedown", (event) => {
    if (
      menu.classList.contains("is-open") &&
      !menu.contains(event.target as Node)
    ) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  window.addEventListener("scroll", close, true);

  function open(doc: DocSummary, x: number, y: number): void {
    target = doc;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add("is-open");
  }

  return { open };
}

function createStatusMenu(onSelect: (doc: DocSummary, status: Status) => void): {
  open: (doc: DocSummary, currentStatus: Status, x: number, y: number) => void;
} {
  const menu = document.createElement("div");
  menu.className = "doc-context-menu doc-status-menu";

  const statusRows = ALL_STATUSES.map((status) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "doc-context-menu-row";
    row.textContent = STATUS_LABELS[status];
    menu.appendChild(row);
    return { status, row };
  });

  document.body.appendChild(menu);

  let target: DocSummary | null = null;

  function close(): void {
    menu.classList.remove("is-open");
    target = null;
  }

  statusRows.forEach(({ status, row }) => {
    row.addEventListener("click", () => {
      if (target) {
        onSelect(target, status);
      }
      close();
    });
  });

  document.addEventListener("mousedown", (event) => {
    if (
      menu.classList.contains("is-open") &&
      !menu.contains(event.target as Node)
    ) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  window.addEventListener("scroll", close, true);

  function open(
    doc: DocSummary,
    currentStatus: Status,
    x: number,
    y: number,
  ): void {
    target = doc;
    statusRows.forEach(({ status, row }) => {
      row.classList.toggle("is-active", status === currentStatus);
    });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add("is-open");
  }

  return { open };
}

function attachSpriteFloat(spriteEl: HTMLElement, onClick: () => void): void {
  let isDragging = false;
  let dragMoved = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let floatX = 0;
  let floatY = 0;
  let floatVX = 0;
  let floatVY = 0;
  let floatRAF = 0;

  function stopFloating(): void {
    if (floatRAF) {
      cancelAnimationFrame(floatRAF);
      floatRAF = 0;
    }
  }

  function floatStep(): void {
    const width = spriteEl.offsetWidth;
    const height = spriteEl.offsetHeight;
    floatX += floatVX;
    floatY += floatVY;

    if (floatX <= 0) {
      floatX = 0;
      floatVX = Math.abs(floatVX);
    } else if (floatX >= window.innerWidth - width) {
      floatX = window.innerWidth - width;
      floatVX = -Math.abs(floatVX);
    }

    if (floatY <= 0) {
      floatY = 0;
      floatVY = Math.abs(floatVY);
    } else if (floatY >= window.innerHeight - height) {
      floatY = window.innerHeight - height;
      floatVY = -Math.abs(floatVY);
    }

    spriteEl.style.left = `${floatX}px`;
    spriteEl.style.top = `${floatY}px`;

    floatRAF = requestAnimationFrame(floatStep);
  }

  function startFloating(centerX: number, centerY: number): void {
    spriteEl.classList.add("is-floating");
    spriteEl.style.position = "fixed";
    spriteEl.style.visibility = "visible";

    const rect = spriteEl.getBoundingClientRect();
    floatX = Math.max(
      0,
      Math.min(window.innerWidth - rect.width, centerX - rect.width / 2),
    );
    floatY = Math.max(
      0,
      Math.min(window.innerHeight - rect.height, centerY - rect.height / 2),
    );

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 0.9;
    floatVX = Math.cos(angle) * speed;
    floatVY = Math.sin(angle) * speed;

    floatStep();
  }

  spriteEl.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    stopFloating();

    const rect = spriteEl.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    dragMoved = false;

    isDragging = true;
    spriteEl.classList.add("is-dragging");
    spriteEl.setPointerCapture(event.pointerId);
  });

  spriteEl.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    if (!dragMoved) {
      const dx = event.clientX - dragStartClientX;
      const dy = event.clientY - dragStartClientY;
      if (Math.hypot(dx, dy) > 4) {
        dragMoved = true;
      }
    }

    if (dragMoved) {
      spriteEl.style.left = `${event.clientX - dragOffsetX}px`;
      spriteEl.style.top = `${event.clientY - dragOffsetY}px`;
    }
  });

  spriteEl.addEventListener("pointerup", (event) => {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    spriteEl.releasePointerCapture(event.pointerId);
    spriteEl.classList.remove("is-dragging");

    if (!dragMoved) {
      onClick();
    }

    startFloating(event.clientX, event.clientY);
  });

  startFloating(window.innerWidth / 2, window.innerHeight / 2);
}

async function main(): Promise<void> {
  const listEl = document.getElementById("doc-list");
  const newDocButton = document.getElementById("new-doc-button");
  const spriteEl = document.getElementById("doc-sprite");

  if (!listEl || !newDocButton || !spriteEl) {
    throw new Error(
      "Missing required DOM mount points: #doc-list, #new-doc-button, and/or #doc-sprite",
    );
  }

  newDocButton.addEventListener("click", () => {
    window.location.href = `/doc/${crypto.randomUUID()}`;
  });

  attachSpriteFloat(spriteEl, () => {
    window.open("https://www.youtube.com/watch?v=nlLhw1mtCFA", "_blank");
  });

  const docs = await listDocs();

  if (docs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "doc-list-empty";
    empty.textContent = "No documents yet.";
    listEl.appendChild(empty);
    listEl.focus();
    return;
  }

  const statuses = await Promise.all(
    docs.map((doc) => reconcileStatus(doc.id, doc.status)),
  );

  interface Entry {
    doc: DocSummary;
    status: Status;
  }

  const entries: Entry[] = docs.map((doc, index) => ({
    doc,
    status: statuses[index] ?? Status.Draft,
  }));

  function sortEntries(): void {
    entries.sort((a, b) => a.status - b.status);
  }

  sortEntries();

  let selectedIndex = 0;
  let pendingG = false;
  const rows: HTMLButtonElement[] = [];

  function selectIndex(index: number): void {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    rows[selectedIndex]?.classList.remove("is-selected");
    selectedIndex = clamped;
    const row = rows[selectedIndex];
    row?.classList.add("is-selected");
    row?.scrollIntoView({ block: "nearest" });
  }

  function removeDoc(doc: DocSummary): void {
    const index = entries.findIndex((e) => e.doc.id === doc.id);
    if (index === -1) {
      return;
    }
    entries.splice(index, 1);
    rows[index]?.remove();
    rows.splice(index, 1);

    if (rows.length === 0 && listEl) {
      listEl.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "doc-list-empty";
      empty.textContent = "No documents yet.";
      listEl.appendChild(empty);
      listEl.focus();
      return;
    }

    selectIndex(Math.min(index, rows.length - 1));
  }

  const contextMenu = createDocContextMenu((doc) => {
    deleteDoc(doc.id)
      .then(() => removeDoc(doc))
      .catch(() => {
        alert("Failed to delete document. Please try again.");
      });
  });

  const statusMenu = createStatusMenu((doc, status) => {
    setStatus(doc.id, status)
      .then(() => {
        const entry = entries.find((e) => e.doc.id === doc.id);
        if (entry) {
          entry.status = status;
        }
        renderRows();
      })
      .catch(() => {
        alert("Failed to update status. Please try again.");
      });
  });

  function renderRows(): void {
    if (!listEl) {
      return;
    }
    const selectedId = entries[selectedIndex]?.doc.id;

    sortEntries();
    listEl.replaceChildren();
    rows.length = 0;

    entries.forEach(({ doc, status }) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "doc-row";

      const main = document.createElement("div");
      main.className = "doc-row-main";

      const title = document.createElement("span");
      title.className = "doc-row-title";
      title.textContent =
        doc.title.trim().length > 0
          ? stripInlineMarkdown(doc.title)
          : "untitled";

      const date = document.createElement("span");
      date.className = "doc-row-date";
      date.textContent = formatUpdatedAt(doc.updatedAt);

      main.append(title, date);

      const statusLabel = document.createElement("span");
      statusLabel.className = "doc-row-status";
      statusLabel.setAttribute("role", "button");
      statusLabel.textContent = STATUS_LABELS[status];
      statusLabel.addEventListener("click", (event) => {
        event.stopPropagation();
        const rect = statusLabel.getBoundingClientRect();
        statusMenu.open(doc, status, rect.left, rect.bottom + 4);
      });

      row.append(main, statusLabel);

      row.addEventListener("click", () => openDoc(doc));
      row.addEventListener("mouseenter", () => selectIndex(rows.indexOf(row)));
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        selectIndex(rows.indexOf(row));
        contextMenu.open(doc, event.clientX, event.clientY);
      });

      listEl.appendChild(row);
      rows.push(row);
    });

    const restoredIndex = entries.findIndex((e) => e.doc.id === selectedId);
    selectIndex(restoredIndex === -1 ? 0 : restoredIndex);
  }

  renderRows();
  listEl.focus();

  listEl.addEventListener("keydown", (event) => {
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
        selectIndex(rows.length - 1);
        break;
      case "Enter": {
        event.preventDefault();
        const doc = entries[selectedIndex]?.doc;
        if (doc) {
          openDoc(doc);
        }
        break;
      }
      default:
        break;
    }
  });
}

void main();
