import type { TypstSnippetMode } from "./extract";

const TIMEOUT_MS = 20_000;

export interface TypstSvgResult {
  ok: boolean;
  body: string;
  network: boolean;
}

export async function fetchTypstSvg(src: string, mode: TypstSnippetMode): Promise<TypstSvgResult> {
  let res: Response;
  try {
    res = await fetch("/api/typst-svg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ src, mode }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, body: `could not reach the dev server: ${message}`, network: true };
  }
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, body: body || `server error ${res.status}`, network: false };
  }
  return { ok: true, body, network: false };
}
