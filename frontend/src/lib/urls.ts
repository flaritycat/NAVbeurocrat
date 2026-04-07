const allowedProtocols = new Set(["http:", "https:"]);

export function sanitizeHttpUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return allowedProtocols.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
