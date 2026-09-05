import type { TypstSnippetMode } from "./extract";

export interface TypstDiagnostic {
  severity: "error" | "warning";
  message: string;
  // 1-based position in the user's snippet text, not the compiled wrapper.
  // null when typst pointed somewhere we can't map back (e.g. the preamble).
  line: number | null;
  column: number | null;
  // width of the ^^^ span, when typst printed one.
  length: number | null;
  hints: string[];
}

export const TYPST_PAGE_PREAMBLE = `#set page(width: auto, height: auto, margin: (x: 2pt, y: 2pt), fill: none)
#set text(size: 11pt, fill: rgb("#2b2822"))
`;

const PREAMBLE_LINE_COUNT = 2;

export function typstEquationPrefix(mode: TypstSnippetMode): string | null {
  switch (mode) {
    case "inline":
      return "#math.equation(block: false, $";
    case "display":
      return "#math.equation(block: true, $";
    case "doc":
      return null;
  }
}

const HEAD_RE = /^(error|warning): ?(.*)$/;
const LOCATION_RE = /^\s*┌─ .*:(\d+):(\d+)\s*$/;
const SOURCE_LINE_RE = /^\s*\d+ │ /;
const CARET_RE = /^\s*│\s*(\^+)\s*$/;
const HINT_RE = /^\s*=\s*hint: ?(.*)$/;
const BAR_RE = /^\s*│/;

interface RawDiagnostic {
  severity: "error" | "warning";
  message: string;
  wrapperLine: number | null;
  wrapperColumn: number | null;
  length: number | null;
  hints: string[];
}

// typst's diagnostics columns are 0-based character offsets; we show the
// user a normal 1-based column, so everything below adds 1 back on.
function userCoordinates(
  src: string,
  mode: TypstSnippetMode,
  wrapperLine: number,
  wrapperColumn: number,
): { line: number | null; column: number | null } {
  const line = wrapperLine - PREAMBLE_LINE_COUNT;
  if (line < 1) {
    return { line: null, column: null };
  }
  const prefix = typstEquationPrefix(mode);
  if (prefix !== null && line === 1) {
    const column = wrapperColumn - prefix.length;
    if (column < 0) {
      return { line, column: null };
    }
    // compile.ts trims the snippet before wrapping, so a column inside the
    // trimmed text shifts right by however many spaces the user typed first.
    const leadingWhitespace = /^\s*/.exec(src)![0].length;
    return { line, column: column + leadingWhitespace + 1 };
  }
  return { line, column: wrapperColumn + 1 };
}

// Parses `typst compile --diagnostic-format human` stderr. Diagnostics come
// out referring to the wrapped snippet file; everything is remapped to the
// user's own snippet coordinates so the editor can point at their text.
export function parseTypstDiagnostics(
  stderr: string,
  src: string,
  mode: TypstSnippetMode,
): TypstDiagnostic[] {
  const raws: RawDiagnostic[] = [];
  let current: RawDiagnostic | null = null;
  let lastHint = -1;

  for (const line of stderr.split("\n")) {
    const head = HEAD_RE.exec(line);
    if (head !== null) {
      current = {
        severity: head[1] === "warning" ? "warning" : "error",
        message: head[2] ?? "",
        wrapperLine: null,
        wrapperColumn: null,
        length: null,
        hints: [],
      };
      raws.push(current);
      lastHint = -1;
      continue;
    }
    if (current === null) {
      continue;
    }

    const location = LOCATION_RE.exec(line);
    if (location !== null) {
      if (current.wrapperLine === null) {
        current.wrapperLine = Number(location[1]);
        current.wrapperColumn = Number(location[2]);
      }
      lastHint = -1;
      continue;
    }
    const caret = CARET_RE.exec(line);
    if (caret !== null) {
      if (current.length === null) {
        current.length = caret[1]!.length;
      }
      lastHint = -1;
      continue;
    }
    const hint = HINT_RE.exec(line);
    if (hint !== null) {
      current.hints.push(hint[1]!);
      lastHint = current.hints.length - 1;
      continue;
    }
    if (BAR_RE.test(line) || SOURCE_LINE_RE.test(line) || line.trim() === "") {
      lastHint = -1;
      continue;
    }
    const trimmed = line.trim();
    if (lastHint >= 0) {
      current.hints[lastHint] += ` ${trimmed}`;
    } else if (current.wrapperLine === null) {
      current.message += ` ${trimmed}`;
    }
  }

  return raws.map((raw) => {
    const base =
      raw.wrapperLine !== null && raw.wrapperColumn !== null
        ? userCoordinates(src, mode, raw.wrapperLine, raw.wrapperColumn)
        : { line: null, column: null };
    return {
      severity: raw.severity,
      message: raw.message,
      line: base.line,
      column: base.column,
      length: raw.length,
      hints: raw.hints,
    };
  });
}

export function formatTypstDiagnostics(
  diagnostics: readonly TypstDiagnostic[],
  src: string,
): string {
  const srcLines = src.split("\n");
  const blocks = diagnostics.map((diagnostic) => {
    const parts = [`${diagnostic.severity}: ${diagnostic.message}`];
    if (diagnostic.line !== null) {
      const where =
        diagnostic.column !== null
          ? `line ${diagnostic.line}, column ${diagnostic.column}`
          : `line ${diagnostic.line}`;
      parts.push(`  at ${where}`);
      const text = srcLines[diagnostic.line - 1];
      if (text !== undefined) {
        parts.push(`  ${text}`);
        if (diagnostic.column !== null) {
          const caretCount =
            diagnostic.length !== null && diagnostic.length > 0 ? diagnostic.length : 1;
          parts.push(`  ${" ".repeat(Math.max(diagnostic.column - 1, 0))}${"^".repeat(caretCount)}`);
        }
      }
    }
    for (const hint of diagnostic.hints) {
      parts.push(`hint: ${hint}`);
    }
    return parts.join("\n");
  });
  return blocks.join("\n\n");
}
