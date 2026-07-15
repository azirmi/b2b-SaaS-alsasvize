const UUID_PREFIX_RE = /^[0-9a-fA-F-]{32,}-/;

function sanitizeFilename(raw: string): string {
  const normalized = raw.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return normalized || "dosya";
}

function extractPathTail(source: string): string {
  const normalized = source.trim();
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    const tail = url.pathname.split("/").pop() ?? "";
    return decodeURIComponent(tail);
  } catch {
    const tail = normalized.split("/").pop() ?? "";
    return decodeURIComponent(tail);
  }
}

export function deriveDownloadFileName(source: string, fallback: string): string {
  const tail = extractPathTail(source);
  if (!tail) {
    return sanitizeFilename(fallback);
  }

  const withoutPrefix = tail.replace(UUID_PREFIX_RE, "");
  return sanitizeFilename(withoutPrefix || fallback);
}

export async function handleDownload(url: string, filename: string): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error("Dosya indirilemedi.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = sanitizeFilename(filename);
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
