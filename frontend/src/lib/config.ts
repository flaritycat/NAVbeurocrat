function normalizeBasePath(rawPath: string) {
  if (!rawPath || rawPath === "/") {
    return "/";
  }

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export const appBasePath = normalizeBasePath(import.meta.env.VITE_APP_BASE_PATH || "/nav/");
export const sessionStorageKey = import.meta.env.VITE_SESSION_STORAGE_KEY || "nav.guide.session.v1";
export const contentDraftStorageKey = import.meta.env.VITE_CONTENT_DRAFT_STORAGE_KEY || "nav.content.draft.v1";
