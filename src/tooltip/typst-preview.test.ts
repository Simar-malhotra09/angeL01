import { expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";
import { currentTypstKeys, previewKeysField, setTypstPreviewsEffect } from "./typst-preview";

test("currentTypstKeys collects mode:src keys for every snippet", () => {
  const keys = currentTypstKeys("inline $x = y$ and\n$$\na / b\n$$\n```typst\n#strong[hi]\n```");
  expect(keys.has("inline:x = y")).toBe(true);
  expect(keys.has("display:a / b")).toBe(true);
  expect(keys.has("doc:#strong[hi]")).toBe(true);
  expect(keys.size).toBe(3);
});

test("preview field stores keys set via effect", () => {
  let state = EditorState.create({ doc: "$x$", extensions: previewKeysField });
  expect(state.field(previewKeysField).keys.size).toBe(0);

  state = state.update({ effects: setTypstPreviewsEffect.of(new Set(["inline:x"])) }).state;
  expect(state.field(previewKeysField).keys.has("inline:x")).toBe(true);
});

test("doc changes bump seq so decorations re-map but keys stay", () => {
  let state = EditorState.create({ doc: "$x$", extensions: previewKeysField });
  state = state.update({ effects: setTypstPreviewsEffect.of(new Set(["inline:x"])) }).state;
  const before = state.field(previewKeysField);

  state = state.update({ changes: { from: 0, insert: "pp " } }).state;
  const after = state.field(previewKeysField);
  expect(after.seq).toBe(before.seq + 1);
  expect(after.keys.has("inline:x")).toBe(true);
});
