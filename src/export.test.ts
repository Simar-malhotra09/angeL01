import { expect, test } from "bun:test";
import { buildHtmlDocument } from "./export";

const html = buildHtmlDocument("My Doc", "<p>hi</p>", "", "# hi");

test("styles include a lightbox overlay and zoom cursors", () => {
  expect(html).toContain(".x-lightbox");
  expect(html).toContain(".x-lightbox.open");
  expect(html).toContain("cursor: zoom-in");
});

test("script wires click-to-zoom for images and block typst svgs", () => {
  expect(html).toContain(".x-image-block img, .typst-display svg, .typst-doc svg");
  expect(html).toContain("viewBox");
  expect(html).toContain("naturalWidth");
});

test("zoom clone is deep so svg children render in the popup", () => {
  expect(html).toContain("cloneNode(true)");
});

test("clicking away or pressing escape closes the zoom", () => {
  expect(html).toContain('event.key === "Escape"');
  expect(html).toContain("closeZoom");
});

test("copy-all-text button still works alongside the zoom script", () => {
  expect(html).toContain('id="x-copy-btn"');
  expect(html).toContain("clipboard.writeText");
});
