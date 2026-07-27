export interface Heading {
  level: 1 | 2 | 3;
  text: string;
}

const HEADING_PATTERN = /^(#{1,3}) (.*)$/;

export function parseHeading(lineText: string): Heading | null {
  const match = HEADING_PATTERN.exec(lineText);
  if (!match) {
    return null;
  }
  return { level: match[1]!.length as 1 | 2 | 3, text: match[2]!.trim() };
}
