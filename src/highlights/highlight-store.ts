import type { Highlight } from "./highlight-field";

const DB_NAME = "angel01-highlights";
const STORE_NAME = "highlights";
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

export function getHighlightRecords(docId: string): Promise<Highlight[]> {
  return openDb().then(
    (db) =>
      new Promise<Highlight[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(docId);
        request.onsuccess = () => {
          resolve((request.result as Highlight[] | undefined) ?? []);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }),
  );
}

export async function putHighlightRecords(docId: string, records: readonly Highlight[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(records, docId);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
  });
}
