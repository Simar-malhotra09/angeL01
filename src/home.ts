import "./style.css";
import { listDocs, type DocSummary } from "./storage";

function formatUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function openDoc(doc: DocSummary): void {
  window.location.href = `/doc/${doc.id}`;
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

  docs.forEach((doc, index) => {
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
    row.addEventListener("mouseenter", () => selectIndex(index));
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
