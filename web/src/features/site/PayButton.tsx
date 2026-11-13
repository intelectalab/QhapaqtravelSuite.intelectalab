"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { payOrder, payReceivable } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { trackSiteEvent } from "@/lib/site-analytics";
import type { CheckoutTerms } from "@/lib/site";
import { PaymentFields, type PaymentValue } from "./PaymentFields";
import { useSite } from "./SiteContext";

export function OrderPayment({ code, label, methods, accounts, walletPhone, target = "order" }: { code: string; label: string; methods: CheckoutTerms["methods"]; accounts: CheckoutTerms["bank_accounts"]; walletPhone: string | null; target?: "order" | "receivable" }) {
  const { agencia } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string | null } | null>(null);
  const [payment, setPayment] = useState<PaymentValue>({ method: "tarjeta", ready: false });
  const onPayment = useCallback((value: PaymentValue) => setPayment(value), []);

  return (
    <div className="grid gap-4">
      <PaymentFields methods={methods} accounts={accounts} walletPhone={walletPhone} onChange={onPayment} />
      <div>
        <button
          type="button"
          disabled={pending || !payment.ready}
          onClick={() =>
            start(async () => {
              const body = Object.fromEntries(Object.entries(payment).filter(([key, value]) => key !== "ready" && typeof value === "string")) as Record<string, string>;
              trackSiteEvent("add_payment_info", { transaction_id: code, payment_type: payment.method });
              const response = await (target === "receivable" ? payReceivable : payOrder)(agencia, code, body);
              if (!response.ok) trackSiteEvent("payment_failed", { transaction_id: code, payment_type: payment.method });
              setResult(response);
              router.refresh();
            })
          }
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 sm:w-auto"
        >
          {pending ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
          {label}
        </button>
        {result?.message && <p className={cn("mt-2 text-[13px]", result.ok ? "text-ok" : "text-bad")}>{result.message}</p>}
      </div>
    </div>
  );
}
