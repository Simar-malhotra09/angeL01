import type { TypstSnippetMode } from "./extract";

const SVG_TAG_RE = /<svg\b([^>]*)>/;
const WIDTH_RE = /\bwidth="([\d.]+)pt"/;
const HEIGHT_RE = /\bheight="([\d.]+)pt"/;

// compile.ts typesets every snippet at 11pt, so 11 svg pt is one em. Sizing
// the svg in em makes the glyphs inside come out at exactly the surrounding
// font size, both in the editor preview and on export.
const PT_PER_EM = 11;

function em(pt: number): string {
  return `${(pt / PT_PER_EM).toFixed(3)}em`;
}

function scale(svg: string, styleFor: (widthPt: number, heightPt: number) => string): string {
  const tag = SVG_TAG_RE.exec(svg);
  if (tag === null || tag[1] === undefined || tag[1].includes("style=")) {
    return svg;
  }
  const width = WIDTH_RE.exec(tag[1]);
  const height = HEIGHT_RE.exec(tag[1]);
  if (width === null || height === null || width[1] === undefined || height[1] === undefined) {
    return svg;
  }
  const style = styleFor(Number(width[1]), Number(height[1]));
  return `${svg.slice(0, tag.index)}<svg style="${style}"${tag[1]}>${svg.slice(tag.index + tag[0].length)}`;
}

export function scaleSvgToText(svg: string, mode: TypstSnippetMode): string {
  return scale(svg, (widthPt, heightPt) =>
    mode === "inline"
      ? `height:${em(heightPt)};width:auto`
      : `width:${em(widthPt)};height:auto;max-width:100%`,
  );
}

// The preview tooltip has no page column to fit into, so unlike the export
// sizing this never clamps width: the svg keeps its natural text size and the
// tooltip itself scrolls when the content is too big for the viewport.
export function scaleSvgForPreview(svg: string, mode: TypstSnippetMode): string {
  return scale(svg, (widthPt, heightPt) =>
    mode === "inline"
      ? `height:${em(heightPt)};width:auto`
      : `width:${em(widthPt)};height:auto`,
  );
}
