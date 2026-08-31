import { expect, test } from "bun:test";
import { renderMarkdownToHtml } from "./markdown-to-html";

const noImages = (): null => null;

test("bold and italic on one line complete and render", () => {
  const { html } = renderMarkdownToHtml("a **bold** and *ital* word", noImages);
  expect(html).toBe("<p>a <strong>bold</strong> and <em>ital</em> word</p>");
});

test("underscore italic completes", () => {
  const { html } = renderMarkdownToHtml("an _italic_ phrase", noImages);
  expect(html).toBe("<p>an <em>italic</em> phrase</p>");
});

test("several bold spans on one line all render", () => {
  const { html } = renderMarkdownToHtml("**one** then **two** then **three**", noImages);
  expect(html).toBe(
    "<p><strong>one</strong> then <strong>two</strong> then <strong>three</strong></p>",
  );
});

test("nested emphasis-style content does not hang", () => {
  const { html } = renderMarkdownToHtml("**bold with words** then _em_ then *em2*", noImages);
  expect(html).toBe("<p><strong>bold with words</strong> then <em>em</em> then <em>em2</em></p>");
});

test("plain lines and links still render", () => {
  const { html } = renderMarkdownToHtml("see [docs](https://example.com) now", noImages);
  expect(html).toContain('href="https://example.com"');
});
