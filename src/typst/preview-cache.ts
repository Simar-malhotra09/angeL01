import type { TypstDiagnostic } from "./diagnostics";

// IndexedDB persistence for compiled typst previews. The in-memory cache in
// tooltip/typst-preview.ts dies with every page load, so without this every
// document open re-fetches every snippet from the dev server. Mirrors the
// two-layer pattern images already use (image/image-store.ts).
export interface CachedPreview {
  readonly ok: boolean;
  readonly body: string;
  readonly at: number;
  readonly diagnostics?: readonly TypstDiagnostic[];
}

const DB_NAME = "angel01-typst-previews";
const STORE_NAME = "previews";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
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

export function getPersistedPreview(
  key: string,
): Promise<CachedPreview | null> {
  return openDb().then(
    (db) =>
      new Promise<CachedPreview | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => {
          resolve((request.result as CachedPreview | undefined) ?? null);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }),
  );
}

export function putPersistedPreview(
  key: string,
  entry: CachedPreview,
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(entry, key);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error);
        };
      }),
  );
}
