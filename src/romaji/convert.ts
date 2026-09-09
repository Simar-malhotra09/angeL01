export interface RomajiOk {
  ok: true;
  romaji: string;
}

export interface RomajiErr {
  ok: false;
  detail: string;
}

export type RomajiResult = RomajiOk | RomajiErr;

const MAX_TEXT_BYTES = 2_048;
const NOT_FOUND_DETAIL =
  "cutlet not found — install it once with: pipx install cutlet && pipx inject cutlet unidic-lite";

function spawnCutlet() {
  try {
    return Bun.spawn(["cutlet", "hepburn"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    return null;
  }
}

export async function convertToRomaji(text: string): Promise<RomajiResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, detail: "empty text" };
  }
  if (Buffer.byteLength(trimmed, "utf8") > MAX_TEXT_BYTES) {
    return { ok: false, detail: "selection too long (2 KB max)" };
  }

  const proc = spawnCutlet();
  if (proc === null) {
    return { ok: false, detail: NOT_FOUND_DETAIL };
  }

  proc.stdin.write(trimmed);
  proc.stdin.end();

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    const detail = stderr.trim();
    return {
      ok: false,
      detail: detail.length > 0 ? detail : NOT_FOUND_DETAIL,
    };
  }

  const romaji = stdout.trim().replace(/\n+/g, " ");
  if (romaji.length === 0) {
    return { ok: false, detail: "cutlet returned nothing" };
  }
  return { ok: true, romaji };
}
