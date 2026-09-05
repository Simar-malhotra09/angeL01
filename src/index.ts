import { Database } from "bun:sqlite";
import home from "../index.html";
import editor from "../editor.html";
import { Status, type Doc, type DocSummary } from "./storage";
import { isSupportedImageType } from "./image/image-format";
import { isValidId } from "./id";
import { compileTypst } from "./typst/compile";

const db = new Database("angel01.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    status INTEGER NOT NULL DEFAULT 0
  )
`);

// Non-destructive migration for databases created before the status column
// existed. CREATE TABLE IF NOT EXISTS above won't add columns to an existing
// table, so add the column explicitly when it is missing.
const docColumns = db.query("PRAGMA table_info(docs)").all() as Array<{ name: string }>;
if (!docColumns.some((column) => column.name === "status")) {
  db.exec("ALTER TABLE docs ADD COLUMN status INTEGER NOT NULL DEFAULT 0");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

interface DocRow {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
  status: Status;
}

type DocSummaryRow = Omit<DocRow, "content">;

type DocWrite = Pick<Doc, "title" | "content" | "createdAt" | "status">;

const getDocStmt = db.query<DocRow, [string]>("SELECT * FROM docs WHERE id = ?");
const listDocsStmt = db.query<DocSummaryRow, []>(
  "SELECT id, title, created_at, updated_at, status FROM docs ORDER BY updated_at DESC",
);
const upsertDocStmt = db.query<null, [string, string, string, number, number, number]>(`
  INSERT INTO docs (id, title, content, created_at, updated_at, status)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    content = excluded.content,
    updated_at = excluded.updated_at,
    status = excluded.status
`);
const deleteDocStmt = db.query<null, [string]>("DELETE FROM docs WHERE id = ?");

interface ImageRow {
  id: string;
  mime_type: string;
  data: Uint8Array;
}

const getImageStmt = db.query<ImageRow, [string]>(
  "SELECT id, mime_type, data FROM images WHERE id = ?",
);
const insertImageStmt = db.query<null, [string, string, Uint8Array, number]>(`
  INSERT INTO images (id, mime_type, data, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

function rowToDoc(row: DocRow): Doc {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  };
}

function rowToDocSummary(row: DocSummaryRow): DocSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  };
}

const server = Bun.serve({
  routes: {
    "/": home,
    "/doc/:id": editor,
    "/api/docs": {
      GET: () => {
        return Response.json(listDocsStmt.all().map(rowToDocSummary));
      },
    },
    "/api/docs/:id": {
      GET: (req) => {
        const row = getDocStmt.get(req.params.id);
        if (row === null) {
          return new Response(null, { status: 404 });
        }
        return Response.json(rowToDoc(row));
      },
      PUT: async (req) => {
        if (!isValidId(req.params.id)) {
          return new Response(null, { status: 400 });
        }
        const body = (await req.json()) as DocWrite;
        const now = Date.now();
        // Preserve the stored status when an older client omits it, so a
        // content-only save never resets a document back to Draft.
        const existing = getDocStmt.get(req.params.id);
        const status = body.status ?? existing?.status ?? Status.Draft;
        upsertDocStmt.run(req.params.id, body.title, body.content, body.createdAt, now, status);
        return Response.json({ ok: true });
      },
      DELETE: (req) => {
        if (!isValidId(req.params.id)) {
          return new Response(null, { status: 400 });
        }
        deleteDocStmt.run(req.params.id);
        return Response.json({ ok: true });
      },
    },
    "/api/images/:id": {
      GET: (req) => {
        const row = getImageStmt.get(req.params.id);
        if (row === null) {
          return new Response(null, { status: 404 });
        }
        return new Response(new Blob([new Uint8Array(row.data)], { type: row.mime_type }));
      },
      PUT: async (req) => {
        if (!isValidId(req.params.id)) {
          return new Response(null, { status: 400 });
        }
        const mimeType = req.headers.get("content-type") ?? "";
        if (!isSupportedImageType(mimeType)) {
          return new Response(null, { status: 415 });
        }
        const data = new Uint8Array(await req.arrayBuffer());
        insertImageStmt.run(req.params.id, mimeType, data, Date.now());
        return Response.json({ ok: true });
      },
    },
    "/api/typst-svg": {
      POST: async (req) => {
        const body = (await req.json()) as { src?: unknown; mode?: unknown };
        const mode = body.mode;
        if (
          typeof body.src !== "string" ||
          (mode !== "inline" && mode !== "display" && mode !== "doc")
        ) {
          return new Response("Expected { src: string, mode: inline|display|doc }", {
            status: 400,
          });
        }
        const result = await compileTypst(body.src, mode);
        if (!result.ok) {
          return Response.json(
            { detail: result.detail, diagnostics: result.diagnostics },
            { status: 422 },
          );
        }
        return new Response(result.svg, {
          headers: { "content-type": "image/svg+xml" },
        });
      },
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);
