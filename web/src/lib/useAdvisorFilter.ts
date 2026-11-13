"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "kipucontrol-crm-advisor";
const CHANGE_EVENT = "kipucontrol-advisor";

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function useAdvisorFilter(): [string, (advisor: string) => void] {
  const advisor = useSyncExternalStore(subscribe, read, () => "");
  const set = useCallback((value: string) => {
    try {
      if (value) sessionStorage.setItem(KEY, value);
      else sessionStorage.removeItem(KEY);
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [advisor, set];
}
