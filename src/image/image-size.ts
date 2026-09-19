// Width/height of embedded images, kept in localStorage so the editor can
// reserve the exact box an image will occupy before its blob has loaded —
// without it every image reflows the page when it pops in. Dimensions are
// recorded at insert time and re-learned on first render for images this
// device has never seen.
const STORAGE_KEY = "angel01-image-sizes";

type ImageSizeMap = Record<string, [number, number]>;

let cache: ImageSizeMap | null = null;

function load(): ImageSizeMap {
  if (cache === null) {
    try {
      cache = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "{}",
      ) as ImageSizeMap;
    } catch {
      cache = {};
    }
  }
  return cache;
}

export function getImageSize(
  id: string,
): { width: number; height: number } | null {
  const entry = load()[id];
  if (entry === undefined) {
    return null;
  }
  const [width, height] = entry;
  return { width, height };
}

export function putImageSize(id: string, width: number, height: number): void {
  const map = load();
  const existing = map[id];
  if (existing !== undefined && existing[0] === width && existing[1] === height) {
    return;
  }
  map[id] = [width, height];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota exceeded — the embed just falls back to learning sizes on load
  }
}
