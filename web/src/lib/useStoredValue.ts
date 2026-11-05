"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "qhapaq-storage";

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredValue<T>(key: string, parse: (raw: string | null) => T, serialize: (value: T) => string): [T, (value: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback(
    (value: T) => {
      try {
        localStorage.setItem(key, serialize(value));
      } catch {}
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, serialize],
  );
  return [parse(raw), set];
}
