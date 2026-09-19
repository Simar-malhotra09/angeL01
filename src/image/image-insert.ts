import type { EditorView } from "@codemirror/view";
import { generateImageId, isSupportedImageType } from "./image-format";
import { putImageSize } from "./image-size";
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
  // measure before the text lands so the embed can reserve the final box
  // from its first render; failures fall back to learning the size on load
  try {
    const bitmap = await createImageBitmap(file);
    putImageSize(id, bitmap.width, bitmap.height);
    bitmap.close();
  } catch {
    // dimensions unknown — the embed will learn them on first load
  }
  await putImage(id, file);

  const label = deriveLabel(file);
  const insertText = `![${label}](image:${id})`;

  view.dispatch({
    changes: { from: pos, insert: insertText },
    selection: { anchor: pos + insertText.length },
  });
}
