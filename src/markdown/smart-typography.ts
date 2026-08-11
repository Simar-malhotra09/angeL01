export interface TypographyReplacement {
  from: number;
  to: number;
  text: string;
}

const OPENING_CONTEXT = /[\s([{—–-]/;

function isOpeningContext(precedingChar: string): boolean {
  return precedingChar.length === 0 || OPENING_CONTEXT.test(precedingChar);
}

export function resolveTypographyInsert(
  docBefore: string,
  insertPos: number,
  typed: string,
): TypographyReplacement | null {
  if (typed === '"' || typed === "'") {
    const precedingChar = docBefore.slice(Math.max(0, insertPos - 1), insertPos);
    const openQuote = typed === '"' ? "“" : "‘";
    const closeQuote = typed === '"' ? "”" : "’";
    const text = isOpeningContext(precedingChar) ? openQuote : closeQuote;
    return { from: insertPos, to: insertPos, text };
  }

  if (typed === "-" && docBefore.slice(Math.max(0, insertPos - 1), insertPos) === "-") {
    return { from: insertPos - 1, to: insertPos, text: "—" };
  }

  if (typed === "." && docBefore.slice(Math.max(0, insertPos - 2), insertPos) === "..") {
    return { from: insertPos - 2, to: insertPos, text: "…" };
  }

  return null;
}
