import { expect, test } from "bun:test";
import { compileTypst } from "./compile";
import { formatTypstDiagnostics, parseTypstDiagnostics } from "./diagnostics";

// fixtures use typst's real output: columns are 0-based offsets into the
// compiled wrapper file, which carries a 2-line preamble plus (for math
// snippets) a `#math.equation(block: ..., $` prefix on line 3
const INLINE_ERROR = `error: unknown variable: time
  ┌─ /some/cache/hash.typ:3:30
  │
3 │ #math.equation(block: false, $time_token$)
  │                               ^^^^
  │
  = hint: if you meant to display multiple letters as is, try adding spaces between each letter: \`t i m e\`
  = hint: or if you meant to display this as text, try placing it in quotes: \`"time"\`
`;

test("remaps inline errors to the user's own line and column", () => {
  const diagnostics = parseTypstDiagnostics(INLINE_ERROR, "time_token", "inline");
  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0]!;
  expect(diagnostic.message).toBe("unknown variable: time");
  expect(diagnostic.line).toBe(1);
  expect(diagnostic.column).toBe(1);
  expect(diagnostic.length).toBe(4);
  expect(diagnostic.hints).toHaveLength(2);
  expect(diagnostic.hints[1]).toContain("placing it in quotes");
});

test("accounts for leading spaces inside an inline snippet", () => {
  // compiled column 34 on the equation line: 30 prefix chars + "x + " (4)
  const stderr = `error: unknown variable: unknownvar
  ┌─ /some/cache/hash.typ:3:34
  │
3 │ #math.equation(block: false, $x + unknownvar$)
  │                                  ^^^^^^^^^^
`;
  const diagnostics = parseTypstDiagnostics(stderr, " x + unknownvar", "inline");
  expect(diagnostics[0]!.line).toBe(1);
  expect(diagnostics[0]!.column).toBe(6);
});

test("remaps doc-mode errors relative to the preamble", () => {
  const stderr = `error: unknown variable: oops
  ┌─ /some/cache/hash.typ:4:1
  │
4 │ #oops
  │  ^^^^
`;
  const diagnostics = parseTypstDiagnostics(stderr, "\n#oops", "doc");
  expect(diagnostics[0]!.line).toBe(2);
  expect(diagnostics[0]!.column).toBe(2);
});

test("drops locations that point into our own preamble", () => {
  const stderr = `error: unexpected token
  ┌─ /some/cache/hash.typ:1:1
`;
  const diagnostics = parseTypstDiagnostics(stderr, "x + 1", "doc");
  expect(diagnostics[0]!.line).toBeNull();
  expect(diagnostics[0]!.column).toBeNull();
});

test("collects more than one error block", () => {
  const stderr = `${INLINE_ERROR}
error: unclosed delimiter
  ┌─ /some/cache/hash.typ:5:11
`;
  const diagnostics = parseTypstDiagnostics(stderr, "time_token", "inline");
  expect(diagnostics).toHaveLength(2);
  expect(diagnostics[1]!.message).toBe("unclosed delimiter");
});

test("renders a plain-text block with the caret under the right column", () => {
  const text = formatTypstDiagnostics(
    [{ severity: "error", message: "boom", line: 1, column: 3, length: 2, hints: ["try quotes"] }],
    "ab cd\nef",
  );
  expect(text).toBe("error: boom\n  at line 1, column 3\n  ab cd\n    ^^\nhint: try quotes");
});

test("skips the location lines when typst gave none", () => {
  const text = formatTypstDiagnostics(
    [{ severity: "error", message: "boom", line: null, column: null, length: null, hints: [] }],
    "x",
  );
  expect(text).toBe("error: boom");
});

test("real compile maps inline math errors onto the user's snippet", async () => {
  const result = await compileTypst("time_token", "inline");
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.diagnostics.length).toBeGreaterThan(0);
  const diagnostic = result.diagnostics[0]!;
  expect(diagnostic.message).toContain("unknown variable: time");
  expect(diagnostic.line).toBe(1);
  expect(diagnostic.column).toBe(1);
  expect(diagnostic.hints.length).toBeGreaterThan(0);
  expect(result.detail).toContain("line 1, column 1");
});

test("real compile keeps hint text out of the svg cache path", async () => {
  const result = await compileTypst("#doesnotexist()", "doc");
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  const diagnostic = result.diagnostics[0]!;
  expect(diagnostic.message).toContain("doesnotexist");
  expect(diagnostic.line).toBe(1);
  expect(result.detail).not.toContain(".typ:");
});
