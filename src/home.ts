import "./style.css";
import { deleteDoc, listDocs, type DocSummary } from "./storage";

function formatUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
    if (target && confirm(`Delete "${target.title.trim() || "untitled"}"? This cannot be undone.`)) {
      onDelete(target);
    }
    close();
  });

  document.addEventListener("mousedown", (event) => {
    if (menu.classList.contains("is-open") && !menu.contains(event.target as Node)) {
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

function getTableBounds(rows: HTMLButtonElement[]): DOMRect | null {
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  if (!firstRow || !lastRow) {
    return null;
  }
  const first = firstRow.getBoundingClientRect();
  const last = lastRow.getBoundingClientRect();
  return new DOMRect(
    Math.min(first.left, last.left),
    first.top,
    Math.max(first.right, last.right) - Math.min(first.left, last.left),
    last.bottom - first.top,
  );
}

function attachSpriteDrag(spriteEl: HTMLElement, rows: HTMLButtonElement[], dock: () => void): void {
  let isDragging = false;
  let isFloating = false;
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
    isFloating = false;
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

  function startFloating(clientX: number, clientY: number): void {
    isFloating = true;
    spriteEl.classList.add("is-floating");
    spriteEl.style.position = "fixed";

    const rect = spriteEl.getBoundingClientRect();
    floatX = Math.max(0, Math.min(window.innerWidth - rect.width, clientX - dragOffsetX));
    floatY = Math.max(0, Math.min(window.innerHeight - rect.height, clientY - dragOffsetY));

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 0.6;
    floatVX = Math.cos(angle) * speed;
    floatVY = Math.sin(angle) * speed;

    floatStep();
  }

  function returnToDock(): void {
    stopFloating();
    spriteEl.classList.remove("is-floating", "is-dragging");
    spriteEl.style.position = "";
    spriteEl.style.left = "";
    spriteEl.style.top = "";
    dock();
  }

  spriteEl.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (isFloating) {
      stopFloating();
    }

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
        spriteEl.style.position = "fixed";
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
      returnToDock();
      return;
    }

    const tableBounds = getTableBounds(rows);
    const draggedOut =
      !tableBounds ||
      event.clientX < tableBounds.left ||
      event.clientX > tableBounds.right ||
      event.clientY < tableBounds.top ||
      event.clientY > tableBounds.bottom;

    if (draggedOut) {
      startFloating(event.clientX, event.clientY);
    } else {
      returnToDock();
    }
  });
}

async function main(): Promise<void> {
  const listEl = document.getElementById("doc-list");
  const newDocButton = document.getElementById("new-doc-button");
  const spriteEl = document.getElementById("doc-sprite");

  if (!listEl || !newDocButton || !spriteEl) {
    throw new Error("Missing required DOM mount points: #doc-list, #new-doc-button, and/or #doc-sprite");
  }

  newDocButton.addEventListener("click", () => {
    window.location.href = `/doc/${crypto.randomUUID()}`;
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

    if (row && spriteEl) {
      spriteEl.style.visibility = "visible";
      spriteEl.style.top = `${row.offsetTop + row.offsetHeight / 2 - spriteEl.offsetHeight / 2}px`;
    }
  }

  attachSpriteDrag(spriteEl, rows, () => selectIndex(selectedIndex));

  function removeDoc(doc: DocSummary): void {
    const index = docs.findIndex((d) => d.id === doc.id);
    if (index === -1) {
      return;
    }
    docs.splice(index, 1);
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

  docs.forEach((doc) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "doc-row";

    const title = document.createElement("span");
    title.className = "doc-row-title";
    title.textContent = doc.title.trim().length > 0 ? doc.title : "untitled";

    const date = document.createElement("span");
    date.className = "doc-row-date";
    date.textContent = formatUpdatedAt(doc.updatedAt);

    row.append(title, date);
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

  selectIndex(0);
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
        const doc = docs[selectedIndex];
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
