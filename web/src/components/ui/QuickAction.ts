"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "./Toast";

interface QuickResult {
  message: string | null;
  done: boolean;
}

export function useQuickAction<S extends QuickResult>(action: (state: S, form: FormData) => Promise<S>, initial: S) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (values: Record<string, string | number>, successToast: string) =>
    start(async () => {
      const form = new FormData();
      Object.entries(values).forEach(([name, value]) => form.set(name, String(value)));
      const result = await action(initial, form);
      toast(result.done ? successToast : (result.message ?? "No pudimos completar la acción."), result.done ? "ok" : "bad");
      if (result.done) router.refresh();
    });
  return { run, pending };
}
