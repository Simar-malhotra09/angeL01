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

export function scaleSvgToText(svg: string, mode: TypstSnippetMode): string {
  const tag = SVG_TAG_RE.exec(svg);
  if (tag === null || tag[1] === undefined || tag[1].includes("style=")) {
    return svg;
  }
  const width = WIDTH_RE.exec(tag[1]);
  const height = HEIGHT_RE.exec(tag[1]);
  if (width === null || height === null || width[1] === undefined || height[1] === undefined) {
    return svg;
  }
  const style =
    mode === "inline"
      ? `height:${em(Number(height[1]))};width:auto`
      : `width:${em(Number(width[1]))};height:auto;max-width:100%`;
  return `${svg.slice(0, tag.index)}<svg style="${style}"${tag[1]}>${svg.slice(tag.index + tag[0].length)}`;
}
