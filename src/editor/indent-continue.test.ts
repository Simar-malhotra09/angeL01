import { describe, expect, test } from "bun:test";
import { EditorState, type StateCommand } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  continueIndentEnter,
  deleteIndentLevelBackspace,
} from "./indent-continue";

const MARK = "@";

function makeState(doc: string): EditorState {
  const pos = doc.indexOf(MARK);
  const text = doc.slice(0, pos) + doc.slice(pos + MARK.length);
  return EditorState.create({
    doc: text,
    selection: { anchor: pos },
    extensions: [
      markdown({
        codeLanguages: languages,
        pasteURLAsLink: false,
        addKeymap: false,
      }),
    ],
  });
}

function run(
  command: StateCommand,
  doc: string,
): { handled: boolean; text: string; cursor: number } {
  let state = makeState(doc);
  const handled = command({
    state,
    dispatch: (tr) => {
      state = tr.state;
    },
  });
  return {
    handled,
    text: state.doc.toString(),
    cursor: state.selection.main.head,
  };
}

const enter = (doc: string) => run(continueIndentEnter, doc);
const backspace = (doc: string) => run(deleteIndentLevelBackspace, doc);

describe("continueIndentEnter", () => {
  test("numbered heading line continues with the next number", () => {
    const r = enter("10. some heading\n 10.1. first point@");
    expect(r.handled).toBe(true);
    expect(r.text).toBe(
      "10. some heading\n 10.1. first point\n 10.2. ",
    );
    expect(r.cursor).toBe(r.text.length);
  });

  test("single-segment marker bumps at column zero too", () => {
    const r = enter("10. some heading@");
    expect(r.handled).toBe(true);
    expect(r.text).toBe("10. some heading\n11. ");
  });

  test("deep indentation is carried to the numbered continuation", () => {
    const r = enter("intro\n      10.1. sub point@");
    expect(r.text).toBe("intro\n      10.1. sub point\n      10.2. ");
  });

  test("plain indented line keeps its literal indentation", () => {
    const r = enter("a paragraph\n          continuation words@");
    expect(r.handled).toBe(true);
    expect(r.text).toBe(
      "a paragraph\n          continuation words\n          ",
    );
  });

  test("blank indented line drops the indent and starts clean", () => {
    const r = enter("10. head\n 10.1. point\n      @");
    expect(r.handled).toBe(true);
    expect(r.text).toBe("10. head\n 10.1. point\n\n");
    expect(r.cursor).toBe(r.text.length);
  });

  test("lone numbered marker is cancelled instead of bumped", () => {
    const r = enter("10. head\n 10.2. @");
    expect(r.handled).toBe(true);
    expect(r.text).toBe("10. head\n\n");
    expect(r.cursor).toBe(r.text.length);
  });

  test("mid-line split on a numbered line inserts the next marker", () => {
    const r = enter(" 10.1. alpha@beta");
    expect(r.handled).toBe(true);
    expect(r.text).toBe(" 10.1. alpha\n 10.2. beta");
  });

  test("plain line with no indent falls through", () => {
    const r = enter("just a heading@");
    expect(r.handled).toBe(false);
  });

  test("empty line falls through", () => {
    const r = enter("text\n@");
    expect(r.handled).toBe(false);
  });

  test("code fences fall through to normal code newline", () => {
    const r = enter("```js\n    let x = 1@\n```");
    expect(r.handled).toBe(false);
  });

  test("bullet lines are not renumbered", () => {
    const r = enter("  - item@");
    expect(r.handled).toBe(true);
    expect(r.text).toBe("  - item\n  ");
  });
});

describe("deleteIndentLevelBackspace", () => {
  test("deletes one indent unit at a time", () => {
    const r = backspace("text\n      @");
    expect(r.handled).toBe(true);
    expect(r.text).toBe("text\n    ");
  });

  test("odd leftover indentation deletes only the remainder", () => {
    const r = backspace("text\n     @");
    expect(r.handled).toBe(true);
    expect(r.text).toBe("text\n    ");
    const again = run(deleteIndentLevelBackspace, "text\n     @");
    expect(again.text.replace(/ /g, "·")).toBe("text\n····");
  });

  test("text before the cursor falls through to normal backspace", () => {
    const r = backspace("    word@");
    expect(r.handled).toBe(false);
  });

  test("cursor at line start falls through", () => {
    const r = backspace("line one\n@");
    expect(r.handled).toBe(false);
  });
});
