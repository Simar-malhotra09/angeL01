import { isValidId } from "./id";

const STORAGE_KEY = "angel01";

const DB_NAME = "angel01";
const TEXT_STORE_NAME = "documents";
const DB_VERSION = 1;

export function getDocID(): string {
  const match = window.location.pathname.match(/^\/doc\/([^/]+)$/);
  const id = match?.[1];
  if (!id) {
    throw new Error(`No document ID in URL path: ${window.location.pathname}`);
  }
  if (!isValidId(id)) {
    throw new Error(`Document ID is not a valid UUID: ${id}`);
  }
  return id;
}

export enum Status {
  Draft,
  Published,
  Archived,
}

export const STATUS_LABELS: Record<Status, string> = {
  [Status.Draft]: "Draft",
  [Status.Published]: "Published",
  [Status.Archived]: "Archived",
};

export const ALL_STATUSES: Status[] = [
  Status.Draft,
  Status.Published,
  Status.Archived,
];

export interface Doc {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  status?: Status;
}

export type DocSummary = Pick<
  Doc,
  "id" | "title" | "createdAt" | "updatedAt" | "status"
>;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(TEXT_STORE_NAME);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
  return dbPromise;
}

export async function putText(id: string, doc: Doc): Promise<void> {
  const db = await openDb();
  const res = new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE_NAME, "readwrite");
    tx.objectStore(TEXT_STORE_NAME).put(doc, id);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
  });
  return res;
}

export async function getStatus(id: string): Promise<Status> {
  return openDb().then(
    (db) =>
      new Promise<Status>((resolve, reject) => {
        const tx = db.transaction(TEXT_STORE_NAME, "readonly");
        const request = tx.objectStore(TEXT_STORE_NAME).get(id);

        request.onsuccess = () => {
          const doc = request.result as Doc | undefined;
          resolve(doc?.status ?? Status.Draft);
        };

        request.onerror = () => {
          reject(request.error);
        };
      }),
  );
}

export async function setStatus(id: string, status: Status): Promise<void> {
  const doc = await getText(id);
  if (doc === null) {
    throw new Error(`Cannot set status: document ${id} not found`);
  }
  await putText(id, { ...doc, status });
}

async function getLocalText(id: string): Promise<Doc | null> {
  return openDb().then(
    (db) =>
      new Promise<Doc | null>((resolve, reject) => {
        const tx = db.transaction(TEXT_STORE_NAME, "readonly");
        const request = tx.objectStore(TEXT_STORE_NAME).get(id);

        request.onsuccess = () => {
          resolve((request.result as Doc | undefined) ?? null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      }),
  );
}

async function getRemoteText(id: string): Promise<Doc | null> {
  try {
    const res = await fetch(`/api/docs/${id}`);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as Doc;
  } catch {
    return null;
  }
}

export async function getText(id: string): Promise<Doc | null> {
  const [local, remote] = await Promise.all([getLocalText(id), getRemoteText(id)]);

  if (remote !== null && (local === null || remote.updatedAt > local.updatedAt)) {
    await putText(id, remote);
    return remote;
  }

  return local;
}

export async function pushDoc(doc: Doc): Promise<void> {
  const res = await fetch(`/api/docs/${doc.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: doc.title,
      content: doc.content,
      createdAt: doc.createdAt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to sync doc ${doc.id}: ${res.status}`);
  }
}

export async function deleteDoc(id: string): Promise<void> {
  const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete doc ${id}: ${res.status}`);
  }
  const db = await openDb();
  const result = new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE_NAME, "readwrite");
    tx.objectStore(TEXT_STORE_NAME).delete(id);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
  });
  return result;
}

export async function listDocs(): Promise<DocSummary[]> {
  const res = await fetch("/api/docs");
  if (!res.ok) {
    throw new Error(`Failed to list docs: ${res.status}`);
  }
  return (await res.json()) as DocSummary[];
}

export function loadDraft(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveDraft(text: string): void {
  localStorage.setItem(STORAGE_KEY, text);
}
