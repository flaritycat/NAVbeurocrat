import { useEffect, useState } from "react";
import { contentDraftStorageKey } from "./config";
import { defaultContentBundle, isGuideContentBundle } from "./contentBundle";
import type { GuideContentBundle } from "./types";

const updateEventName = "nav-content-updated";

function readDraftFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(contentDraftStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isGuideContentBundle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function emitUpdate() {
  window.dispatchEvent(new Event(updateEventName));
}

export function loadContentBundle() {
  return readDraftFromStorage() ?? defaultContentBundle;
}

export function saveContentBundleDraft(bundle: GuideContentBundle) {
  window.localStorage.setItem(contentDraftStorageKey, JSON.stringify(bundle, null, 2));
  emitUpdate();
}

export function resetContentBundleDraft() {
  window.localStorage.removeItem(contentDraftStorageKey);
  emitUpdate();
}

export function exportContentBundleJson(bundle: GuideContentBundle) {
  return JSON.stringify(bundle, null, 2);
}

export function hasLocalContentDraft() {
  return Boolean(readDraftFromStorage());
}

export function useContentBundle() {
  const [bundle, setBundle] = useState<GuideContentBundle>(loadContentBundle());

  useEffect(() => {
    function handleUpdate() {
      setBundle(loadContentBundle());
    }

    window.addEventListener(updateEventName, handleUpdate);
    return () => window.removeEventListener(updateEventName, handleUpdate);
  }, []);

  return bundle;
}
