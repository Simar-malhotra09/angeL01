import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { TypstSnippetMode } from "./extract";

export interface TypstCompileOk {
  ok: true;
  svg: string;
}

export interface TypstCompileErr {
  ok: false;
  detail: string;
}

export type TypstCompileResult = TypstCompileOk | TypstCompileErr;

const CACHE_DIR = join(import.meta.dir, "..", "..", ".typst-cache");
const MAX_SNIPPET_BYTES = 10_000;

const PAGE_PREAMBLE = `#set page(width: auto, height: auto, margin: (x: 6pt, y: 6pt), fill: none)
#set text(size: 11pt, fill: rgb("#2b2822"))
`;

export function buildTypstSource(src: string, mode: TypstSnippetMode): string {
  switch (mode) {
    case "inline":
      return `${PAGE_PREAMBLE}#math.equation(block: false, $${src.trim()}$)`;
    case "display":
      return `${PAGE_PREAMBLE}#math.equation(block: true, $${src.trim()}$)`;
    case "doc":
      return `${PAGE_PREAMBLE}${src}`;
  }
}

export async function compileTypst(src: string, mode: TypstSnippetMode): Promise<TypstCompileResult> {
  if (src.trim().length === 0) {
    return { ok: false, detail: "empty snippet" };
  }
  if (Buffer.byteLength(src, "utf8") > MAX_SNIPPET_BYTES) {
    return { ok: false, detail: "snippet too large" };
  }

  const hash = createHash("sha256")
    .update(mode)
    .update("\0")
    .update(src)
    .digest("hex");
  const svgPath = join(CACHE_DIR, `${hash}.svg`);
  if (existsSync(svgPath)) {
    return { ok: true, svg: readFileSync(svgPath, "utf8") };
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const typPath = join(CACHE_DIR, `${hash}.typ`);
  writeFileSync(typPath, buildTypstSource(src, mode));

  const proc = Bun.spawn(
    [
      "typst",
      "compile",
      "--format",
      "svg",
      "--diagnostic-format",
      "short",
      typPath,
      svgPath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0 || !existsSync(svgPath)) {
    unlinkSync(typPath);
    const detail = stderr.trim().replaceAll(typPath, "snippet");
    return {
      ok: false,
      detail: detail.length > 0 ? detail : `typst exited with code ${exitCode}`,
    };
  }

  unlinkSync(typPath);
  return { ok: true, svg: readFileSync(svgPath, "utf8") };
}
