/**
 * Filename label prefix shared by every uploader. The presigned-upload flow
 * prepends a URL-safe base64 token so the stored object keeps a human-readable
 * document label; the detail view decodes it with `UPLOAD_LABEL_TOKEN_RE`.
 * Browser-only (uses `btoa`/`TextEncoder`) — call from client components.
 */
export const UPLOAD_LABEL_PREFIX = "__uplabel_";

function encodeUploadLabel(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const bytes = new TextEncoder().encode(trimmed);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function withUploadLabelPrefix(
  fileName: string,
  uploadLabel: string,
): string {
  const encodedLabel = encodeUploadLabel(uploadLabel);
  if (!encodedLabel) {
    return fileName;
  }

  return `${UPLOAD_LABEL_PREFIX}${encodedLabel}__${fileName}`;
}
