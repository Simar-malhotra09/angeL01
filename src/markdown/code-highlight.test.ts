import { expect, test } from "bun:test";
import {
  codeColorSpecs,
  codeHighlightCss,
  codeHighlightStyle,
  highlightCodeHtml,
} from "./code-highlight";

test("python code picks up the shared token classes", async () => {
  const html = await highlightCodeHtml("python", "def hello():\n    return 'hi'");
  expect(html).not.toBeNull();
  expect(html).toContain('<span class="tok-keyword">def</span>');
  expect(html).toContain('<span class="tok-string">');
});

test("numbers, plain text, and line breaks survive highlighting", async () => {
  const html = await highlightCodeHtml("python", "x = 1\ny = 2");
  expect(html).not.toBeNull();
  expect(html).toContain('<span class="tok-number">1</span>');
  expect(html).toContain('<span class="tok-operator">=</span>');
  expect(html).toContain("\n");
});

test("html inside code stays escaped after highlighting", async () => {
  const html = await highlightCodeHtml("js", 'const s = "<b>&"');
  expect(html).not.toBeNull();
  expect(html).not.toContain("<b>");
  expect(html).toContain("&lt;b&gt;");
});

test("unknown or missing languages are left unhighlighted", async () => {
  expect(await highlightCodeHtml("nosuchlang", "hello")).toBeNull();
  expect(await highlightCodeHtml("", "hello")).toBeNull();
});

test("export css and editor style both come from the shared specs", () => {
  expect(codeHighlightCss()).toContain(
    ".code-block .tok-keyword { color: var(--accent, #b5624a); }",
  );
  expect(codeHighlightStyle.specs).toHaveLength(codeColorSpecs.length);
});
