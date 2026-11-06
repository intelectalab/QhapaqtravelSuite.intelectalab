"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { payOrder } from "@/app/(sitio)/sitio/[agencia]/actions";
import { useSite } from "./SiteContext";

export function PayButton({ code, label }: { code: string; label: string }) {
  const { agencia } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const message = await payOrder(agencia, code);
            setError(message);
            router.refresh();
          })
        }
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
        {label}
      </button>
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
