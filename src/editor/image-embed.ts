import { EditorState, RangeSetBuilder, StateField, type Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { getImage } from "../image/image-store";

const BLOCK_IMAGE_RE = /^!\[([^\]]*)\]\(image:([a-zA-Z0-9-]+)\)$/;

class ImageBlockWidget extends WidgetType {
  constructor(
    private readonly id: string,
    private readonly label: string,
  ) {
    super();
  }

  override eq(other: ImageBlockWidget): boolean {
    return other.id === this.id && other.label === this.label;
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-image-block";
    const img = document.createElement("img");
    img.alt = this.label;
    wrapper.appendChild(img);

    if (this.label.length > 0) {
      const caption = document.createElement("div");
      caption.className = "cm-image-caption";
      caption.textContent = this.label;
      wrapper.appendChild(caption);
    }

    void getImage(this.id).then((blob) => {
      if (blob === null) {
        return;
      }
      img.src = URL.createObjectURL(blob);
    });

    return wrapper;
  }

  override destroy(dom: HTMLElement): void {
    const img = dom.querySelector("img");
    if (img?.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
    }
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber);
    const match = BLOCK_IMAGE_RE.exec(line.text.trim());
    if (match !== null) {
      const widget = new ImageBlockWidget(match[2]!, match[1]!);
      builder.add(line.to, line.to, Decoration.widget({ widget, block: true, side: 1 }));
    }
  }

  return builder.finish();
}

export const imageEmbed = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, tr: Transaction) {
    if (!tr.docChanged) {
      return decorations;
    }
    return buildDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});
