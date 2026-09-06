import { HighlightStyle, LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightCode, tags, type Highlighter, type Tag } from "@lezer/highlight";
import { escapeHtml } from "./markdown-to-html";

// One list feeds both the editor (a HighlightStyle) and the static export
// (spans + CSS with var fallbacks, since exported pages stand alone).
export interface CodeColorSpec {
  tag: Tag | readonly Tag[];
  className: string;
  color: string;
}

export const codeColorSpecs: readonly CodeColorSpec[] = [
  { tag: tags.comment, className: "tok-comment", color: "var(--faint, #a39f92)" },
  { tag: tags.keyword, className: "tok-keyword", color: "var(--accent, #b5624a)" },
  { tag: tags.string, className: "tok-string", color: "#6a7a43" },
  { tag: tags.regexp, className: "tok-regexp", color: "#8a5a68" },
  { tag: tags.number, className: "tok-number", color: "#2f6f8f" },
  { tag: [tags.bool, tags.atom, tags.null], className: "tok-atom", color: "#8a5a2b" },
  { tag: tags.function(tags.variableName), className: "tok-function", color: "#4d5b8f" },
  { tag: [tags.typeName, tags.className], className: "tok-typeName", color: "#8a6d3b" },
  { tag: tags.propertyName, className: "tok-propertyName", color: "#50706a" },
  { tag: tags.operator, className: "tok-operator", color: "#6b6353" },
  { tag: tags.labelName, className: "tok-labelName", color: "#8a5db0" },
];

export const codeHighlightStyle = HighlightStyle.define(
  codeColorSpecs.map(({ tag, color }) => ({ tag, color })),
);

export function codeHighlightCss(): string {
  return (
    codeColorSpecs
      .map((spec) => `.code-block .${spec.className} { color: ${spec.color}; }`)
      .join("\n") + "\n"
  );
}

const exportHighlighter: Highlighter = {
  style(held: readonly Tag[]): string {
    for (const spec of codeColorSpecs) {
      const wanted: readonly Tag[] = Array.isArray(spec.tag) ? spec.tag : [spec.tag];
      if (wanted.some((w) => held.some((h) => h.set.includes(w)))) {
        return spec.className;
      }
    }
    return "";
  },
};

export async function highlightCodeHtml(lang: string, src: string): Promise<string | null> {
  if (lang === "") {
    return null;
  }
  const description = LanguageDescription.matchLanguageName(languages, lang);
  if (description === null) {
    return null;
  }
  const support = await description.load();
  const tree = support.language.parser.parse(src);
  let html = "";
  highlightCode(
    src,
    tree,
    exportHighlighter,
    (text, classes) => {
      html += classes !== "" ? `<span class="${classes}">${escapeHtml(text)}</span>` : escapeHtml(text);
    },
    () => {
      html += "\n";
    },
  );
  return html;
}
