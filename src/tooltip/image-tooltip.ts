import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { getImage } from "../image/image-store";
import { getCoordsAtEnd } from "./tooltip-anchor";

const IMAGE_REF_RE = /!\[([^\]]*)\]\(image:([a-zA-Z0-9-]+)\)/g;

interface ImageRef {
  from: number;
  to: number;
  id: string;
}

function findImageRefAt(lineText: string, lineFrom: number, pos: number): ImageRef | null {
  IMAGE_REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMAGE_REF_RE.exec(lineText)) !== null) {
    const start = lineFrom + match.index;
    const end = start + match[0].length;
    if (pos >= start && pos <= end) {
      return { from: start, to: end, id: match[2]! };
    }
  }
  return null;
}

export const imageHoverTooltip = hoverTooltip(
  async (view: EditorView, pos: number): Promise<Tooltip | null> => {
    const line = view.state.doc.lineAt(pos);
    const ref = findImageRefAt(line.text, line.from, pos);
    if (ref === null) {
      return null;
    }

    const blob = await getImage(ref.id);
    if (blob === null) {
      return null;
    }

    return {
      pos: ref.from,
      end: ref.to,
      above: true,
      create: (tooltipView) => {
        const objectUrl = URL.createObjectURL(blob);
        const dom = document.createElement("img");
        dom.className = "cm-image-tooltip";
        dom.src = objectUrl;
        return {
          dom,
          getCoords: (p) => getCoordsAtEnd(tooltipView, ref.to, p),
          destroy: () => {
            URL.revokeObjectURL(objectUrl);
          },
        };
      },
    };
  },
);
