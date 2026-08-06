import {TocHeading} from "./markdown-to-html.ts"; 

const STORAGE_KEY = "angel01";
const TITLE_KEY = "angel01-title";

const DB_NAME = "angel01";
const TEXT_STORE_NAME = "documents";
const IMG_STORE_NAME = "images";
const DB_VERSION = 1;

const DOC_ID_KEY = "doc-id";

export function getDocID(): string {
  let id = localStorage.getItem(DOC_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DOC_ID_KEY, id);
  }
  return id;
}

export interface Doc {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(TEXT_STORE_NAME);
      request.result.createObjectStore(IMG_STORE_NAME);
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

export async function putText(id: string, doc:Doc):Promise<void> {
  const db = await openDb(); 
  const res = new Promise((resolve, reject)=> {
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

export async function getText(id: string): Promise<Doc | null> {
  const db = await openDb();

  return new Promise<Doc | null>((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE_NAME, "readonly");
    const request = tx.objectStore(TEXT_STORE_NAME).get(id);

    request.onsuccess = () => {
      resolve((request.result as Doc | undefined) ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function putImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE_NAME, "readwrite");
    tx.objectStore(IMG_STORE_NAME).put(blob, id);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
  });
}

export async function getImage(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE_NAME, "readonly");
    const request = tx.objectStore(IMG_STORE_NAME).get(id);
    request.onsuccess = () => {
      resolve((request.result as Blob | undefined) ?? null);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}
export function loadDraft(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveDraft(text: string): void {
  localStorage.setItem(STORAGE_KEY, text);
}

export function loadTitle(): string {
  return localStorage.getItem(TITLE_KEY) ?? "";
}

export function saveTitle(title: string): void {
  localStorage.setItem(TITLE_KEY, title);
}
