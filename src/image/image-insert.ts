import type { EditorView } from "@codemirror/view";
import { generateImageId, isSupportedImageType } from "./image-format";
import { putImage } from "./image-store";

function deriveLabel(file: File): string {
  const withoutExtension = file.name.replace(/\.[^/.]+$/, "");
  return withoutExtension.length > 0 ? withoutExtension : "image";
}

export async function insertImageFile(view: EditorView, file: File, pos: number): Promise<void> {
  if (!isSupportedImageType(file.type)) {
    return;
  }

  const id = generateImageId();
  await putImage(id, file);

  const label = deriveLabel(file);
  const insertText = `![${label}](image:${id})`;

  view.dispatch({
    changes: { from: pos, insert: insertText },
    selection: { anchor: pos + insertText.length },
  });
}
