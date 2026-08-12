const DB_NAME = "angel01-images";
const STORE_NAME = "images";
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

function putLocalImage(id: string, blob: Blob): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(blob, id);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error);
        };
      }),
  );
}

function getLocalImage(id: string): Promise<Blob | null> {
  return openDb().then(
    (db) =>
      new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => {
          resolve((request.result as Blob | undefined) ?? null);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }),
  );
}

async function pushImage(id: string, blob: Blob): Promise<void> {
  const res = await fetch(`/api/images/${id}`, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Failed to sync image ${id}: ${res.status}`);
  }
}

export async function putImage(id: string, blob: Blob): Promise<void> {
  await putLocalImage(id, blob);
  await pushImage(id, blob);
}

export async function getImage(id: string): Promise<Blob | null> {
  const local = await getLocalImage(id);
  if (local !== null) {
    return local;
  }

  const res = await fetch(`/api/images/${id}`);
  if (!res.ok) {
    return null;
  }
  const blob = await res.blob();
  await putLocalImage(id, blob);
  return blob;
}
