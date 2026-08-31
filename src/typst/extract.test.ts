import { expect, test } from "bun:test";
import { extractTypstSnippets, substituteTypst } from "./extract";

test("extracts a fenced typst block as a doc snippet", () => {
  const { template, snippets } = extractTypstSnippets(
    "Before\n```typst\n#set text(size: 20pt)\nHello $x$\n```\nAfter",
  );
  expect(snippets).toHaveLength(1);
  expect(snippets[0]!.mode).toBe("doc");
  expect(snippets[0]!.src).toBe("#set text(size: 20pt)\nHello $x$");
  expect(template).toBe(`Before\n\n${snippets[0]!.token}\n\nAfter`);
});

test("extracts display math spanning multiple lines", () => {
  const { template, snippets } = extractTypstSnippets(
    "Intro\n$$\narithmetic_intensity = 2 / bytes_per_weight\n$$\nOutro",
  );
  expect(snippets).toHaveLength(1);
  expect(snippets[0]!.mode).toBe("display");
  expect(snippets[0]!.src).toBe("arithmetic_intensity = 2 / bytes_per_weight");
  expect(template).toContain(snippets[0]!.token);
  expect(template).not.toContain("$$");
});

test("extracts inline math on one line only", () => {
  const { template, snippets } = extractTypstSnippets(
    "roughly $x = y / z$ per token\na lone $ stays\nstays",
  );
  expect(snippets).toHaveLength(1);
  expect(snippets[0]!.mode).toBe("inline");
  expect(snippets[0]!.src).toBe("x = y / z");
  expect(template).toBe(`roughly ${snippets[0]!.token} per token\na lone $ stays\nstays`);
});

test("dollar signs inside fenced blocks are untouched", () => {
  const { snippets } = extractTypstSnippets("```typst\ncost: $100 and $200\n```");
  expect(snippets).toHaveLength(1);
  expect(snippets[0]!.mode).toBe("doc");
});

test("keeps each snippet's src and unique tokens", () => {
  const { snippets } = extractTypstSnippets("$$a$$ text $b$ text\n```typst\nc\n```");
  const byMode = Object.fromEntries(snippets.map((s) => [s.mode, s.src]));
  expect(byMode["display"]).toBe("a");
  expect(byMode["inline"]).toBe("b");
  expect(byMode["doc"]).toBe("c");
  expect(new Set(snippets.map((s) => s.token)).size).toBe(3);
});

test("doc with no snippets is unchanged", () => {
  const { template, snippets } = extractTypstSnippets("plain **markdown** only");
  expect(template).toBe("plain **markdown** only");
  expect(snippets).toHaveLength(0);
});

test("substitute swaps a lone paragraph token and an inline token", () => {
  const html = "<h1>Title</h1>\n<p>@tt0@</p>\n<p>see @tt1@ here</p>";
  const result = substituteTypst(html, [
    { token: "@tt0@", html: '<div class="typst-display"><svg></svg></div>' },
    { token: "@tt1@", html: '<span class="typst-inline"><svg></svg></span>' },
  ]);
  expect(result).toBe(
    '<h1>Title</h1>\n<div class="typst-display"><svg></svg></div>\n<p>see <span class="typst-inline"><svg></svg></span> here</p>',
  );
});
