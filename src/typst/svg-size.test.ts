import { expect, test } from "bun:test";
import { scaleSvgForPreview, scaleSvgToText } from "./svg-size";

const SVG =
  '<svg viewBox="0 0 56.565333333 11.513" width="56.565333333pt" height="11.513pt" xmlns="http://www.w3.org/2000/svg"><g/></svg>';

test("inline svgs scale by height in em so glyphs match text size", () => {
  const out = scaleSvgToText(SVG, "inline");
  expect(out).toContain('<svg style="height:1.047em;width:auto"');
  expect(out).toContain("viewBox");
  expect(out).toContain("</svg>");
});

test("display and doc svgs scale by width in em and stay inside the column", () => {
  for (const mode of ["display", "doc"] as const) {
    const out = scaleSvgToText(SVG, mode);
    expect(out).toContain('<svg style="width:5.142em;height:auto;max-width:100%"');
  }
});

test("svgs without pt sizes pass through unchanged", () => {
  expect(scaleSvgToText("<svg><g/></svg>", "inline")).toBe("<svg><g/></svg>");
});

test("svgs that already carry a style are left alone", () => {
  const styled = '<svg style="width:1em" width="56pt" height="11pt"><g/></svg>';
  expect(scaleSvgToText(styled, "display")).toBe(styled);
});

test("preview sizing never clamps display/doc width to a column", () => {
  for (const mode of ["display", "doc"] as const) {
    const out = scaleSvgForPreview(SVG, mode);
    expect(out).toContain('<svg style="width:5.142em;height:auto"');
    expect(out).not.toContain("max-width");
  }
});

test("preview sizing matches export sizing for inline svgs", () => {
  expect(scaleSvgForPreview(SVG, "inline")).toBe(scaleSvgToText(SVG, "inline"));
});
