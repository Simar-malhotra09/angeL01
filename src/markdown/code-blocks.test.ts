import { expect, test } from "bun:test";
import { extractCodeBlocks, maskCodeFences, substituteCodeBlocks } from "./code-blocks";
import { extractTypstSnippets, findTypstMarkers } from "../typst/extract";
import { renderMarkdownToHtml } from "./markdown-to-html";

test("fenced code becomes a token and renders as a pre block", () => {
  const { template, blocks } = extractCodeBlocks(
    "Before\n```python\ndef hello():\n    pass\n```\nAfter",
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0]!.lang).toBe("python");
  expect(blocks[0]!.src).toBe("def hello():\n    pass");
  expect(template).toBe(`Before\n\n${blocks[0]!.token}\n\nAfter`);

  const { html } = renderMarkdownToHtml(template, () => null);
  const result = substituteCodeBlocks(html, blocks);
  expect(result).toContain(
    '<pre class="code-block"><code class="language-python">def hello():\n    pass</code></pre>',
  );
});

test("dollar signs inside a code fence are not typst-extracted", () => {
  const { template } = extractCodeBlocks("```sh\nprice $5 over $2, check $$x$$\n```");
  const { snippets } = extractTypstSnippets(template);
  expect(snippets).toHaveLength(0);
});

test("typst fences are left for the typst pipeline", () => {
  const { template, blocks } = extractCodeBlocks("```typst\n#strong[hi]\n```");
  expect(blocks).toHaveLength(0);
  expect(template).toContain("```typst\n#strong[hi]\n```");
});

test("html inside code is escaped on substitution", () => {
  const { blocks } = extractCodeBlocks("```html\n<div>a & b</div>\n```");
  const result = substituteCodeBlocks(`<p>${blocks[0]!.token}</p>`, blocks);
  expect(result).toContain("&lt;div&gt;a &amp; b&lt;/div&gt;");
});

test("typst markers skip math inside code fences", () => {
  const markers = findTypstMarkers("```js\nconst a = $x$ + $y$;\n```\nreal $math$ here");
  expect(markers).toHaveLength(1);
  expect(markers[0]!.src).toBe("math");
});

test("maskCodeFences keeps line count and blanks fence content", () => {
  const masked = maskCodeFences("text\n```js\nlet a = 1;\n```\nmore");
  expect(masked.split("\n")).toHaveLength(5);
  expect(masked).not.toContain("let");
  expect(masked.startsWith("text\n")).toBe(true);
  expect(masked.endsWith("\nmore")).toBe(true);
});

test("trailing spaces after the info string still match", () => {
  const { template, blocks } = extractCodeBlocks(
    "Before\n```python \ndef hello_world(s: str):\n    print(f'Hello world @{s}')\n```\nAfter",
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0]!.lang).toBe("python");

  const { html } = renderMarkdownToHtml(template, () => null);
  const result = substituteCodeBlocks(html, blocks);
  expect(result).toContain('<pre class="code-block"><code class="language-python">');
  expect(result).not.toContain("```python");
});

test("fences indented up to three spaces still match", () => {
  const { blocks } = extractCodeBlocks("  ```js\nlet a = 1;\n  ```");
  expect(blocks).toHaveLength(1);
  expect(blocks[0]!.lang).toBe("js");
  expect(blocks[0]!.src).toBe("let a = 1;");
});

test("trailing-space typst fence still reaches the typst pipeline", () => {
  const { template, blocks } = extractCodeBlocks("```typst \n#strong[hi]\n```");
  expect(blocks).toHaveLength(0);

  const { snippets } = extractTypstSnippets(template);
  expect(snippets).toHaveLength(1);
  expect(snippets[0]!.mode).toBe("doc");
  expect(snippets[0]!.src).toBe("#strong[hi]");
});
