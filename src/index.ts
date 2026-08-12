import { Database } from "bun:sqlite";
import home from "../index.html";
import editor from "../editor.html";
import type { Doc, DocSummary } from "./storage";

const db = new Database("angel01.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

interface DocRow {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

type DocSummaryRow = Omit<DocRow, "content">;

type DocWrite = Pick<Doc, "title" | "content" | "createdAt">;

const getDocStmt = db.query<DocRow, [string]>("SELECT * FROM docs WHERE id = ?");
const listDocsStmt = db.query<DocSummaryRow, []>(
  "SELECT id, title, created_at, updated_at FROM docs ORDER BY updated_at DESC",
);
const upsertDocStmt = db.query<null, [string, string, string, number, number]>(`
  INSERT INTO docs (id, title, content, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    content = excluded.content,
    updated_at = excluded.updated_at
`);

function rowToDoc(row: DocRow): Doc {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDocSummary(row: DocSummaryRow): DocSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
        const body = (await req.json()) as DocWrite;
        const now = Date.now();
        upsertDocStmt.run(req.params.id, body.title, body.content, body.createdAt, now);
        return Response.json({ ok: true });
      },
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);
