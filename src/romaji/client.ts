const TIMEOUT_MS = 20_000;

export interface RomajiFetchResult {
  ok: boolean;
  body: string;
  network: boolean;
}

export async function fetchRomaji(text: string): Promise<RomajiFetchResult> {
  let res: Response;
  try {
    res = await fetch("/api/romaji", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, body: `could not reach the dev server: ${message}`, network: true };
  }
  const data = (await res.json()) as { romaji?: unknown; detail?: unknown };
  if (!res.ok) {
    return {
      ok: false,
      body: typeof data.detail === "string" ? data.detail : `server error ${res.status}`,
      network: false,
    };
  }
  if (typeof data.romaji !== "string") {
    return { ok: false, body: "server returned no romaji", network: false };
  }
  return { ok: true, body: data.romaji, network: false };
}
