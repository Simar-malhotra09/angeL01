import type { TypstSnippetMode } from "./extract";
import type { TypstDiagnostic } from "./diagnostics";

const TIMEOUT_MS = 20_000;

export interface TypstSvgResult {
  ok: boolean;
  body: string;
  network: boolean;
  // when the api call was made (ms epoch) — shown in the preview tooltip so a
  // stale svg or error can be told apart from a fresh one
  at: number;
  diagnostics?: TypstDiagnostic[];
}

export async function fetchTypstSvg(src: string, mode: TypstSnippetMode): Promise<TypstSvgResult> {
  const at = Date.now();
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
    return { ok: false, body: `could not reach the dev server: ${message}`, network: true, at };
  }
  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { detail?: unknown; diagnostics?: unknown };
      return {
        ok: false,
        body: typeof data.detail === "string" ? data.detail : `server error ${res.status}`,
        network: false,
        at,
        ...(Array.isArray(data.diagnostics)
          ? { diagnostics: data.diagnostics as TypstDiagnostic[] }
          : {}),
      };
    }
    const body = await res.text();
    return { ok: false, body: body || `server error ${res.status}`, network: false, at };
  }
  return { ok: true, body: await res.text(), network: false, at };
}
