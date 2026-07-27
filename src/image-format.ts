const SUPPORTED_IMAGE_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType);
}

export function generateImageId(): string {
  return crypto.randomUUID();
}

export const IMAGE_FILE_ACCEPT = SUPPORTED_IMAGE_TYPES.join(",");
